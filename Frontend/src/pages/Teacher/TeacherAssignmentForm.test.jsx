import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { TeacherAssignmentForm } from './TeacherAssignmentForm'
import {
    getTeacherMyClasses, getTeacherAssignment,
    createTeacherAssignment, updateTeacherAssignment,
} from '../../api/teacher'

const navigate = vi.fn()
let params = {}

vi.mock('react-router', async () => ({
    ...await vi.importActual('react-router'),
    useNavigate: () => navigate,
    useParams: () => params,
}))

vi.mock('../../api/teacher', () => ({
    getTeacherMyClasses:     vi.fn(),
    getTeacherAssignment:    vi.fn(),
    createTeacherAssignment: vi.fn(),
    updateTeacherAssignment: vi.fn(),
    saveToQuestionBank:      vi.fn(),
    getQuestionBank:         vi.fn(),
    patchQuestionBank:       vi.fn(),
    deleteFromQuestionBank:  vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
    getNotifications: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn(),
}))

const CLASSES = [
    { class_id: 1, class_name: 'S1A', subject_id: 10, subject_name: 'Mathematics' },
    { class_id: 1, class_name: 'S1A', subject_id: 11, subject_name: 'English'     },
    { class_id: 2, class_name: 'S2B', subject_id: 10, subject_name: 'Mathematics' },
]

const EXISTING = {
    id: 'a1', title: 'Chapter 6 Quiz', class_id: 1, subject_id: 10,
    due_date: '2026-09-01', max_score: 30, instructions: 'Show your working.',
    status: 'draft', mode: 'paper', time_limit_minutes: null,
    shuffle_questions: false, questions: [],
}

/* Fill the four fields every assignment needs before it can be saved. */
async function fillRequired() {
    /* By id, not by label text: the hand-in rules card also mentions "the due
       date", so a loose matcher now finds two controls. */
    fireEvent.change(document.querySelector('#asgn-title'), { target: { value: 'Homework 1' } })
    fireEvent.change(document.querySelector('#asgn-due'), { target: { value: '2026-09-01' } })
    fireEvent.change(document.querySelector('#asgn-max'), { target: { value: '20' } })

    fireEvent.click(screen.getByText(/Select class/))
    fireEvent.click(screen.getByText('S1A'))
    fireEvent.click(screen.getByText(/Select subject/))
    fireEvent.click(screen.getByText('Mathematics'))
}

describe('TeacherAssignmentForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        params = {}
        getTeacherMyClasses.mockResolvedValue(CLASSES)
    })

    it('renders as a page, not inside a dialog', async () => {
        /* The whole point of the move: a quiz builder needs the viewport. If
           this ever renders in a modal again, there will be a role=dialog. */
        renderWithRouter(<TeacherAssignmentForm />)

        await waitFor(() => expect(document.querySelector('#asgn-title')).toBeInTheDocument())
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /New Assignment/ })).toBeInTheDocument()
    })

    it('offers both paper and online, with paper chosen first', async () => {
        renderWithRouter(<TeacherAssignmentForm />)
        await waitFor(() => expect(document.querySelector('#asgn-title')).toBeInTheDocument())

        expect(screen.getByRole('button', { name: /Paper/ })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: /Online/ })).toHaveAttribute('aria-pressed', 'false')
    })

    it('will not publish until the required fields are filled', async () => {
        renderWithRouter(<TeacherAssignmentForm />)
        await waitFor(() => expect(document.querySelector('#asgn-title')).toBeInTheDocument())

        expect(screen.getByRole('button', { name: /Publish/ })).toBeDisabled()

        await fillRequired()

        await waitFor(() =>
            expect(screen.getByRole('button', { name: /Publish/ })).toBeEnabled())
    })

    it('creates the assignment as active when published', async () => {
        createTeacherAssignment.mockResolvedValue({ id: 'new' })
        renderWithRouter(<TeacherAssignmentForm />)
        await waitFor(() => expect(document.querySelector('#asgn-title')).toBeInTheDocument())

        await fillRequired()
        await waitFor(() => expect(screen.getByRole('button', { name: /Publish/ })).toBeEnabled())
        fireEvent.click(screen.getByRole('button', { name: /Publish/ }))

        await waitFor(() => expect(createTeacherAssignment).toHaveBeenCalled())
        expect(createTeacherAssignment.mock.calls[0][0]).toMatchObject({
            title: 'Homework 1', status: 'active', mode: 'paper', max_score: 20,
        })
    })

    it('saves as a draft without needing the publish button', async () => {
        createTeacherAssignment.mockResolvedValue({ id: 'new' })
        renderWithRouter(<TeacherAssignmentForm />)
        await waitFor(() => expect(document.querySelector('#asgn-title')).toBeInTheDocument())

        await fillRequired()
        fireEvent.click(screen.getByRole('button', { name: /Save as Draft/i }))

        await waitFor(() => expect(createTeacherAssignment).toHaveBeenCalled())
        expect(createTeacherAssignment.mock.calls[0][0]).toMatchObject({ status: 'draft' })
    })

    it('returns to the list once saved', async () => {
        createTeacherAssignment.mockResolvedValue({ id: 'new' })
        renderWithRouter(<TeacherAssignmentForm />)
        await waitFor(() => expect(document.querySelector('#asgn-title')).toBeInTheDocument())

        await fillRequired()
        fireEvent.click(screen.getByRole('button', { name: /Save as Draft/i }))

        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/teacher/assignments'))
    })

    it('keeps the teacher on the page when saving fails', async () => {
        /* Losing a half-written quiz to a failed request would be the worst
           possible moment to navigate away. */
        createTeacherAssignment.mockRejectedValue(new Error('server exploded'))
        renderWithRouter(<TeacherAssignmentForm />)
        await waitFor(() => expect(document.querySelector('#asgn-title')).toBeInTheDocument())

        await fillRequired()
        fireEvent.click(screen.getByRole('button', { name: /Save as Draft/i }))

        await waitFor(() => expect(createTeacherAssignment).toHaveBeenCalled())
        expect(navigate).not.toHaveBeenCalledWith('/teacher/assignments')
        expect(document.querySelector('#asgn-title')).toHaveValue('Homework 1')
    })

    describe('editing an existing assignment', () => {
        beforeEach(() => {
            params = { id: 'a1' }
            getTeacherAssignment.mockResolvedValue(EXISTING)
        })

        it('loads the assignment by id, so a pasted link works', async () => {
            renderWithRouter(<TeacherAssignmentForm />)

            await waitFor(() => expect(getTeacherAssignment).toHaveBeenCalledWith('a1'))
            expect(document.querySelector('#asgn-title')).toHaveValue('Chapter 6 Quiz')
            expect(screen.getByRole('heading', { name: /Edit Assignment/ })).toBeInTheDocument()
        })

        it('updates rather than creating a second assignment', async () => {
            updateTeacherAssignment.mockResolvedValue(EXISTING)
            renderWithRouter(<TeacherAssignmentForm />)
            await waitFor(() => expect(document.querySelector('#asgn-title')).toHaveValue('Chapter 6 Quiz'))

            fireEvent.click(screen.getByRole('button', { name: /Publish/ }))

            await waitFor(() => expect(updateTeacherAssignment).toHaveBeenCalled())
            expect(updateTeacherAssignment.mock.calls[0][0]).toBe('a1')
            expect(createTeacherAssignment).not.toHaveBeenCalled()
        })

        it('leaves straight away when nothing has been touched', async () => {
            renderWithRouter(<TeacherAssignmentForm />)
            await waitFor(() => expect(document.querySelector('#asgn-title')).toHaveValue('Chapter 6 Quiz'))

            fireEvent.click(screen.getByRole('button', { name: /Back to assignments/ }))

            expect(navigate).toHaveBeenCalledWith('/teacher/assignments')
        })

        it('asks before discarding an edit', async () => {
            const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
            renderWithRouter(<TeacherAssignmentForm />)
            await waitFor(() => expect(document.querySelector('#asgn-title')).toHaveValue('Chapter 6 Quiz'))

            fireEvent.change(document.querySelector('#asgn-title'), { target: { value: 'Changed' } })
            fireEvent.click(screen.getByRole('button', { name: /Back to assignments/ }))

            expect(confirm).toHaveBeenCalled()
            expect(navigate).not.toHaveBeenCalledWith('/teacher/assignments')
            confirm.mockRestore()
        })

        it('leaves when the teacher confirms they meant to', async () => {
            const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
            renderWithRouter(<TeacherAssignmentForm />)
            await waitFor(() => expect(document.querySelector('#asgn-title')).toHaveValue('Chapter 6 Quiz'))

            fireEvent.change(document.querySelector('#asgn-title'), { target: { value: 'Changed' } })
            fireEvent.click(screen.getByRole('button', { name: /Back to assignments/ }))

            expect(navigate).toHaveBeenCalledWith('/teacher/assignments')
            confirm.mockRestore()
        })
    })
})
