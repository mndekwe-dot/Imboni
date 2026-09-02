import client from './client'

/**
 * Downloading and printing what the server renders.
 *
 * Every finance and library list answers `?format=csv` and `?format=pdf` on the
 * SAME url the page is already reading. That is deliberate: an export built
 * from a second endpoint drifts away from the list it claims to represent, and
 * the first anybody notices is when a printed debtor list disagrees with the
 * screen it was printed from. So these helpers take the endpoint and the params
 * the page is already using, and add one more.
 *
 * The request goes through the authenticated client rather than a plain link:
 * `window.open` on an API url sends no Authorization header, so the school
 * would get a login page in a new tab instead of its document.
 */

/** Fetch a document as a blob, with the caller's own filters applied. */
async function fetchDocument(url, params, format) {
    const response = await client.get(url, {
        params: { ...params, format },
        responseType: 'blob',
    })
    // The interceptor unwraps `response.data` on success, so what comes back
    // here is already the Blob.
    return response instanceof Blob ? response : response?.data
}

/**
 * The filename the server chose, from Content-Disposition.
 *
 * Falls back to a sensible name rather than throwing: a download called
 * `debtors.csv` is better than no download because a header was missing.
 */
function nameFrom(blob, fallback) {
    const name = blob?._filename
    return name || fallback
}

function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Revoke on the next tick, not immediately: some browsers have not started
    // reading the blob by the time click() returns, and revoking underneath
    // them produces a zero-byte file.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Download a list as CSV. `stem` names the file the school ends up with. */
export async function exportCsv(url, params, stem = 'export') {
    const blob = await fetchDocument(url, params, 'csv')
    saveBlob(blob, nameFrom(blob, `${stem}.csv`))
}

/**
 * Open a PDF in a new tab so the browser's own print dialog can take over.
 *
 * Printing, not downloading: the school wants paper. A saved file is one more
 * click, and on a shared office machine it is one more file nobody deletes.
 */
export async function printPdf(url, params = {}) {
    const blob = await fetchDocument(url, params, 'pdf')
    const objectUrl = URL.createObjectURL(blob)
    const tab = window.open(objectUrl, '_blank')
    if (!tab) {
        // Pop-ups blocked. Fall back to a download rather than failing silently
        // -- the person pressed a button and something has to happen.
        saveBlob(blob, 'document.pdf')
    }
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
}

/** A document that is not a rendering of a list: a receipt, a payslip. */
export async function openDocument(url, params = {}) {
    const response = await client.get(url, { params, responseType: 'blob' })
    const blob = response instanceof Blob ? response : response?.data
    const objectUrl = URL.createObjectURL(blob)
    const tab = window.open(objectUrl, '_blank')
    if (!tab) saveBlob(blob, 'document.pdf')
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
}
