/**
 * Export and print for the tables the portals show.
 *
 * Every portal had "Export" and "Print" buttons that did nothing — they were
 * markup with no handler. Both are implemented here once, over the same
 * `{ columns, rows }` shape a DataTable already has, so a page wires a working
 * button by describing its table rather than by writing a downloader.
 *
 *     const table = { columns: ['Student', 'Class'], rows: [['Amina', 'S4A']] }
 *     downloadCsv('students', table)
 *     printTable({ ...table, title: 'Bisoke Students', schoolName })
 */

/**
 * One CSV field.
 *
 * Quoting is not optional here: student names carry commas ("Uwase, Amina" in
 * imported rolls) and a room can be an empty string, both of which shift every
 * later column if written raw. A field is quoted whenever it contains a comma,
 * a quote or a newline, and an embedded quote is doubled — RFC 4180.
 */
function csvField(value) {
    const s = value == null ? '' : String(value)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv({ columns = [], rows = [] }) {
    const head = columns.map(csvField).join(',')
    const body = rows.map(r => r.map(csvField).join(',')).join('\r\n')
    return rows.length ? `${head}\r\n${body}` : head
}

/** `Bisoke Students` → `bisoke-students-2026-08-28.csv` */
export function fileStamp(name, date = new Date()) {
    const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return `${slug || 'export'}-${date.toISOString().slice(0, 10)}`
}

/**
 * Save the table as a CSV file.
 *
 * The BOM is deliberate. Without it Excel on Windows reads the file as the
 * system codepage, and every Kinyarwanda and French name with an accent
 * arrives mojibake — which is most of the roll.
 */
export function downloadCsv(name, table) {
    const blob = new Blob(['﻿' + toCsv(table)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileStamp(name)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoking synchronously cancels the download in Safari; one turn is enough.
    setTimeout(() => URL.revokeObjectURL(url), 0)
}

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
))

/**
 * The printed sheet.
 *
 * A print stylesheet over the live page was the other option and was rejected:
 * the page it would print is a dashboard — sidebar, header, stat tiles, filter
 * chips, pagination — and hiding all of that per page is how each portal ends
 * up with its own idea of what a printout looks like. This builds the document
 * that should come out of the printer instead, so all seven portals print the
 * same sheet: school name, what the list is, when it was taken and by whom,
 * the rows, and a signature line.
 *
 * Returns false when the print window could not be opened (a popup blocker),
 * so the caller can say so rather than appearing to do nothing.
 */
export function printTable({
    title,
    subtitle = '',
    columns = [],
    rows = [],
    schoolName = 'Imboni',
    logo = '',
    preparedBy = '',
    footNote = '',
    signatureLabel = '',
} = {}) {
    const win = window.open('', '_blank', 'width=1024,height=768')
    if (!win) return false

    const printed = new Date().toLocaleString()
    const head = columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')
    const body = rows.length
        ? rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')
        : `<tr><td class="empty" colspan="${Math.max(columns.length, 1)}">Nothing to print.</td></tr>`

    win.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Inter", "Segoe UI", system-ui, sans-serif; color: #0f172a; margin: 0; font-size: 12px; }
  .sheet-head { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 6px; }
  .sheet-head img { width: 44px; height: 44px; object-fit: contain; }
  .sheet-school { font-size: 17px; font-weight: 800; letter-spacing: -0.01em; }
  .sheet-title { font-size: 13px; font-weight: 700; margin-top: 2px; }
  .sheet-sub { font-size: 11px; color: #475569; }
  .sheet-meta { margin-left: auto; text-align: right; font-size: 10px; color: #475569; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
  /* A long roll breaks across sheets, and a page of unlabelled columns is not
     a roll — repeat the header on every printed page. */
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  td.empty { text-align: center; color: #64748b; font-style: italic; }
  .sheet-foot { margin-top: 18px; display: flex; justify-content: space-between; gap: 24px; font-size: 10px; color: #475569; }
  .sign { border-top: 1px solid #94a3b8; padding-top: 4px; min-width: 200px; }
  @media print { .sheet-foot { position: fixed; bottom: 0; left: 0; right: 0; } }
</style></head>
<body>
  <div class="sheet-head">
    ${logo ? `<img src="${escapeHtml(logo)}" alt="">` : ''}
    <div>
      <div class="sheet-school">${escapeHtml(schoolName)}</div>
      <div class="sheet-title">${escapeHtml(title)}</div>
      ${subtitle ? `<div class="sheet-sub">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    <div class="sheet-meta">
      <div>Printed ${escapeHtml(printed)}</div>
      ${preparedBy ? `<div>Prepared by ${escapeHtml(preparedBy)}</div>` : ''}
      <div>${rows.length} record${rows.length === 1 ? '' : 's'}</div>
    </div>
  </div>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  <div class="sheet-foot">
    <div>${escapeHtml(footNote)}</div>
    <div class="sign">${escapeHtml(signatureLabel || 'Signature / Date')}</div>
  </div>
</body></html>`)
    win.document.close()
    win.focus()
    // The dialog has to wait for the logo, or it opens over a half-drawn sheet.
    // onload fires even with no images, so this is not conditional on there
    // being one.
    win.onload = () => { win.print() }
    return true
}
