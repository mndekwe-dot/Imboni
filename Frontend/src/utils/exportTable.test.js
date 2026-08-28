import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toCsv, fileStamp, downloadCsv, printTable } from './exportTable'

describe('toCsv', () => {
    it('writes the header and one line per row, CRLF separated', () => {
        expect(toCsv({ columns: ['Student', 'Class'], rows: [['Amina', 'S4A'], ['Eric', 'S1B']] }))
            .toBe('Student,Class\r\nAmina,S4A\r\nEric,S1B')
    })

    it('writes just the header when there are no rows', () => {
        expect(toCsv({ columns: ['Student', 'Class'], rows: [] })).toBe('Student,Class')
    })

    /* The reason quoting is not optional: imported rolls carry "Uwase, Amina".
       Unquoted, the comma opens a new column and every later field shifts, so
       the room number lands under Dormitory for the rest of the row. */
    it('quotes a field containing a comma', () => {
        expect(toCsv({ columns: ['Name'], rows: [['Uwase, Amina']] }))
            .toBe('Name\r\n"Uwase, Amina"')
    })

    it('doubles an embedded quote, per RFC 4180', () => {
        expect(toCsv({ columns: ['Note'], rows: [['said "hello"']] }))
            .toBe('Note\r\n"said ""hello"""')
    })

    it('quotes a field containing a newline', () => {
        expect(toCsv({ columns: ['Note'], rows: [['line one\nline two']] }))
            .toBe('Note\r\n"line one\nline two"')
    })

    it('writes an empty cell for null and undefined rather than the word', () => {
        expect(toCsv({ columns: ['A', 'B'], rows: [[null, undefined]] })).toBe('A,B\r\n,')
    })
})

describe('fileStamp', () => {
    it('slugs the name and appends the date', () => {
        expect(fileStamp('Bisoke Students', new Date('2026-08-28T09:00:00Z')))
            .toBe('bisoke-students-2026-08-28')
    })

    it('collapses punctuation and never leaves a leading or trailing dash', () => {
        expect(fileStamp('  S4A — Conduct / Records!  ', new Date('2026-01-02T00:00:00Z')))
            .toBe('s4a-conduct-records-2026-01-02')
    })

    it('falls back to a usable name when nothing survives slugging', () => {
        expect(fileStamp('!!!', new Date('2026-01-02T00:00:00Z'))).toBe('export-2026-01-02')
    })
})

describe('downloadCsv', () => {
    let click

    beforeEach(() => {
        click = vi.fn()
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake')
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click)
    })
    afterEach(() => vi.restoreAllMocks())

    it('names the file from the list and the date, and clicks it', () => {
        downloadCsv('Bisoke Students', { columns: ['A'], rows: [['1']] })
        expect(click).toHaveBeenCalled()
        expect(URL.createObjectURL).toHaveBeenCalled()
    })

    /* Without the BOM, Excel on Windows reads the file as the system codepage
       and every accented Rwandan or French name arrives mojibake.

       Asserted on the raw BYTES: Blob.text() decodes as UTF-8, and a UTF-8
       decoder consumes a leading BOM, so the string it returns looks identical
       whether the BOM is there or not. */
    it('prefixes a UTF-8 BOM so Excel does not mangle accented names', async () => {
        downloadCsv('roll', { columns: ['Name'], rows: [['Nyirahabimana Bénédicte']] })
        const blob = URL.createObjectURL.mock.calls[0][0]
        const bytes = new Uint8Array(await blob.arrayBuffer())
        expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    })

    it('leaves no anchor behind in the document', () => {
        downloadCsv('roll', { columns: ['A'], rows: [] })
        expect(document.querySelectorAll('a[download]')).toHaveLength(0)
    })
})

describe('printTable', () => {
    function fakeWindow() {
        return {
            document: { write: vi.fn(), close: vi.fn() },
            focus: vi.fn(),
            print: vi.fn(),
        }
    }

    afterEach(() => vi.restoreAllMocks())

    it('writes the school, the title and every row into the sheet', () => {
        const win = fakeWindow()
        vi.spyOn(window, 'open').mockReturnValue(win)

        const opened = printTable({
            title: 'Bisoke Students',
            columns: ['Student', 'Class'],
            rows: [['Amina Uwase', 'S4A']],
            schoolName: 'Green Hills',
            preparedBy: 'Grace Hakizimana',
        })

        expect(opened).toBe(true)
        const html = win.document.write.mock.calls[0][0]
        expect(html).toContain('Green Hills')
        expect(html).toContain('Bisoke Students')
        expect(html).toContain('<th>Student</th>')
        expect(html).toContain('<td>Amina Uwase</td>')
        expect(html).toContain('Grace Hakizimana')
        expect(html).toContain('1 record')
    })

    /* A name is data, not markup. Without escaping, a student recorded as
       `<script>` would execute in the print window. */
    it('escapes the content it is given', () => {
        const win = fakeWindow()
        vi.spyOn(window, 'open').mockReturnValue(win)

        printTable({ title: 'Roll', columns: ['Name'], rows: [['<script>alert(1)</script>']] })

        const html = win.document.write.mock.calls[0][0]
        expect(html).not.toContain('<script>alert(1)</script>')
        expect(html).toContain('&lt;script&gt;')
    })

    it('says so rather than printing an empty grid when there is nothing to print', () => {
        const win = fakeWindow()
        vi.spyOn(window, 'open').mockReturnValue(win)

        printTable({ title: 'Roll', columns: ['Name', 'Class'], rows: [] })

        const html = win.document.write.mock.calls[0][0]
        expect(html).toContain('Nothing to print.')
        expect(html).toContain('colspan="2"')
    })

    /* A blocked popup must be reported, not swallowed — otherwise pressing
       Print looks exactly like a button that does nothing, which is what these
       buttons were before. */
    it('returns false when the print window is blocked', () => {
        vi.spyOn(window, 'open').mockReturnValue(null)
        expect(printTable({ title: 'Roll', columns: [], rows: [] })).toBe(false)
    })
})
