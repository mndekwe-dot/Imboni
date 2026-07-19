import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ExamCalendar } from './ExamCalendar'

const EXAMS = [
    { id: 1, subject: 'Mathematics', class_id: 'c1', class_name: 'S4A',
      exam_date: '2026-08-10', start_time: '09:00', end_time: '11:00' },
    { id: 2, subject: 'Physics', class_id: 'c2', class_name: 'S4B',
      exam_date: '2026-08-11', start_time: '13:00', end_time: '15:00' },
    { id: 3, subject: 'Chemistry', class_id: 'c1', class_name: 'S4A',
      exam_date: '2026-08-11', start_time: '09:00', end_time: '11:00' },
]

/** Drag `cardText` onto the cell at (rowIndex, colIndex) of the grid body. */
function dragCardToCell(cardText, rowIndex, colIndex) {
    const card = screen.getByText(cardText).closest('.exam-cal-card')
    fireEvent.dragStart(card)
    const row = screen.getAllByRole('row').slice(1)[rowIndex]   // skip header
    const cell = within(row).getAllByRole('cell')[colIndex + 1] // skip day label
    fireEvent.dragOver(cell)
    fireEvent.drop(cell)
}

describe('ExamCalendar', () => {
    let onReschedule
    beforeEach(() => { onReschedule = vi.fn() })

    it('lays out exams by day and time slot', () => {
        render(<ExamCalendar exams={EXAMS} onReschedule={onReschedule} />)

        expect(screen.getByText('Mathematics')).toBeInTheDocument()
        expect(screen.getByText('Physics')).toBeInTheDocument()
        // Two distinct slots become two columns (plus the Day column).
        const headers = screen.getAllByRole('columnheader')
        expect(headers.map(h => h.textContent)).toEqual(
            expect.arrayContaining(['Day', '09:00–11:00', '13:00–15:00']),
        )
    })

    it('shows an empty state when nothing is dated', () => {
        render(<ExamCalendar exams={[]} onReschedule={onReschedule} />)
        expect(screen.getByText(/No dated exams/i)).toBeInTheDocument()
    })

    it('reschedules an exam when dropped on a free cell', () => {
        render(<ExamCalendar exams={EXAMS} onReschedule={onReschedule} />)

        // Move Mathematics (10 Aug, 09:00) to the afternoon slot of the same day.
        dragCardToCell('Mathematics', 0, 1)

        expect(onReschedule).toHaveBeenCalledWith(1, {
            exam_date: '2026-08-10',
            start_time: '13:00',
            end_time: '15:00',
        })
    })

    it('refuses a drop that would clash with the same class', () => {
        render(<ExamCalendar exams={EXAMS} onReschedule={onReschedule} />)

        // Chemistry (S4A) sits on 11 Aug 09:00. Dragging Mathematics (also S4A)
        // there would make one class sit two exams at once.
        dragCardToCell('Mathematics', 1, 0)

        expect(onReschedule).not.toHaveBeenCalled()
        expect(screen.getByRole('status')).toHaveTextContent(/already sits Chemistry/i)
    })

    it('ignores a drop back onto the original cell', () => {
        render(<ExamCalendar exams={EXAMS} onReschedule={onReschedule} />)
        dragCardToCell('Mathematics', 0, 0)
        expect(onReschedule).not.toHaveBeenCalled()
    })

    it('allows different classes to share a slot', () => {
        render(<ExamCalendar exams={EXAMS} onReschedule={onReschedule} />)

        // Physics (S4B) onto 11 Aug 09:00 where Chemistry (S4A) sits — different
        // classes, so no clash.
        dragCardToCell('Physics', 1, 0)

        expect(onReschedule).toHaveBeenCalledWith(2, {
            exam_date: '2026-08-11',
            start_time: '09:00',
            end_time: '11:00',
        })
    })
})
