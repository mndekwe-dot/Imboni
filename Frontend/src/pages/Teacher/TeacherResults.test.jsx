import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor } from '../../test/test-utils'
import { TeacherResults } from './TeacherResults'
import {
  getTeacherMyClasses, getTeacherStudents, getTeacherResultList, bulkSaveResults,
} from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
  getTeacherMyClasses: vi.fn(),
  getTeacherStudents: vi.fn(),
  getTeacherResultList: vi.fn(),
  bulkSaveResults: vi.fn(),
  getTeacherPerformanceTrends: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const CLASSES = [
  { class_id: 1, class_name: 'S1A', grade: '1', section: 'A', subject_name: 'Mathematics', subject_id: 10 },
]

describe('TeacherResults', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state while classes are fetched', () => {
    getTeacherMyClasses.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<TeacherResults />)
    expect(screen.getByText('Loading classes…')).toBeInTheDocument()
  })

  it('renders the Results page heading', async () => {
    getTeacherMyClasses.mockResolvedValue([])
    renderWithRouter(<TeacherResults />)
    await waitFor(() => expect(screen.getByRole('heading', { name: /Results/ })).toBeInTheDocument())
  })

  it('shows the section dropdown after classes load', async () => {
    getTeacherMyClasses.mockResolvedValue(CLASSES)
    renderWithRouter(<TeacherResults />)
    // ClassPicker renders <select> with <option> elements
    await waitFor(() => expect(screen.getByRole('option', { name: 'O-Level' })).toBeInTheDocument())
  })

  it('shows a prompt to select a class before results load', async () => {
    getTeacherMyClasses.mockResolvedValue(CLASSES)
    renderWithRouter(<TeacherResults />)
    await waitFor(() => expect(screen.getByText('Select a class first')).toBeInTheDocument())
    expect(screen.getByText('No class selected')).toBeInTheDocument()
  })
})
