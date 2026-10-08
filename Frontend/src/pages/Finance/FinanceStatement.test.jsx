import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { StatementModal } from './FinanceStatement'
import { matchStatement, applyStatement } from '../../api/finance'

vi.mock('../../api/finance', () => ({ matchStatement: vi.fn(), applyStatement: vi.fn() }))

function csvFile(text) {
    const file = new File([text], 'statement.csv', { type: 'text/csv' })
    file.text = () => Promise.resolve(text)
    return file
}

const CSV = 'Narration,Txn ID,Credit\nFEES ADM002,MP1,"50,000"\nunknown,MP2,12000\nlunch,MP3,75000\n'

const MATCH = {
    results: [
        { row: 0, status: 'suggested', reason: 'Admission number in the narration.', candidates: [{ id: 'b', name: 'Eric Habimana', class_label: 'S3A', student_id: 'ADM002', outstanding: '50000' }] },
        { row: 1, status: 'unmatched', reason: 'Nothing points to a family.', candidates: [] },
        { row: 2, status: 'ambiguous', reason: 'Several families owe exactly this amount.', candidates: [
            { id: 'c', name: 'Joy Kamali', class_label: 'S4B', student_id: 'ADM010', outstanding: '75000' },
            { id: 'd', name: 'Ines Mukamana', class_label: 'S4B', student_id: 'ADM011', outstanding: '75000' }] },
    ],
    counts: {},
}

async function upload(text) {
    renderWithRouter(<StatementModal onClose={() => {}} onDone={() => {}} />)
    fireEvent.change(screen.getByLabelText('Statement file (CSV)'), { target: { files: [csvFile(text)] } })
}

describe('StatementModal', () => {
    beforeEach(() => vi.clearAllMocks())

    it('ticks what the server was sure of, leaves the rest for the bursar, and records only what is ticked', async () => {
        matchStatement.mockResolvedValue(MATCH)
        applyStatement.mockResolvedValue({ taken: [{}], skipped: [] })
        await upload(CSV)

        fireEvent.click(await screen.findByRole('button', { name: 'Match lines' }))
        expect(await screen.findByText('1 ready to record · 1 to choose · 1 will be skipped')).toBeInTheDocument()

        // The ambiguous line is chosen by hand and then joins the batch.
        fireEvent.change(screen.getByLabelText('Family 3'), { target: { value: 'd' } })
        fireEvent.click(screen.getByRole('button', { name: 'Record 2 payments' }))

        await waitFor(() => expect(applyStatement).toHaveBeenCalledWith({
            method: 'bank',
            rows: [
                { student: 'b', amount: '50,000', reference: 'MP1', date: undefined },
                { student: 'd', amount: '75000', reference: 'MP3', date: undefined },
            ],
        }))
    })

    it('can be told not to record a suggested line', async () => {
        matchStatement.mockResolvedValue(MATCH)
        await upload(CSV)
        fireEvent.click(await screen.findByRole('button', { name: 'Match lines' }))
        fireEvent.click(await screen.findByLabelText('Line 1'))
        expect(screen.getByRole('button', { name: 'Record 0 payments' })).toBeDisabled()
    })

    it('says so when the file has no amount column', async () => {
        await upload('Date,Narration\n2026-10-01,x\n')
        expect(await screen.findByText(/No amount column was found/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Match lines' })).toBeDisabled()
    })

    it('shows why the server refused', async () => {
        matchStatement.mockRejectedValue({ response: { data: { detail: 'Match at most 2,000 lines at a time.' } } })
        await upload(CSV)
        fireEvent.click(await screen.findByRole('button', { name: 'Match lines' }))
        expect(await screen.findByText('Match at most 2,000 lines at a time.')).toBeInTheDocument()
    })
})
