import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StudentConductModal } from './StudentConductModal'
import { getStudentBehaviorStats, getStudentBehaviorReports, createDisReport } from '../../api/discipline'

vi.mock('../../api/discipline')

const student = { id: 'u1', name: 'Aisha Kamau', student_id: 'ADM-1', grade: 'S1', section: 'A', incident_count: 2 }

describe('StudentConductModal', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getStudentBehaviorStats.mockResolvedValue({ conduct_grade: 'B', discipline_marks: 35 })
    getStudentBehaviorReports.mockResolvedValue([])
  })

  it('renders nothing when no student is given', () => {
    const { container } = render(<StudentConductModal student={null} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('loads and shows profile stats for the student', async () => {
    render(<StudentConductModal student={student} onClose={() => {}} />)
    expect(screen.getAllByText('Aisha Kamau').length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.getByText('Good')).toBeInTheDocument())
    expect(screen.getByText('35')).toBeInTheDocument()
  })

  it('shows empty conduct history message when there are no records', async () => {
    render(<StudentConductModal student={student} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('No conduct records yet')).toBeInTheDocument())
  })

  it('switches to the Log Incident tab and disables submit until required fields are filled', async () => {
    render(<StudentConductModal student={student} onClose={() => {}} />)
    await waitFor(() => expect(getStudentBehaviorStats).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Log Incident'))
    const submitBtn = screen.getByText('Submit Report').closest('button')
    expect(submitBtn).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText('Brief title of the report…'), { target: { value: 'Late to class' } })
    fireEvent.change(screen.getByPlaceholderText('Describe what happened in detail…'), { target: { value: 'Was 10 min late.' } })
    expect(submitBtn).not.toBeDisabled()
  })

  it('submits a new report and shows the saved confirmation', async () => {
    createDisReport.mockResolvedValue({})
    render(<StudentConductModal student={student} onClose={() => {}} />)
    await waitFor(() => expect(getStudentBehaviorStats).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Log Incident'))
    fireEvent.change(screen.getByPlaceholderText('Brief title of the report…'), { target: { value: 'Late to class' } })
    fireEvent.change(screen.getByPlaceholderText('Describe what happened in detail…'), { target: { value: 'Was 10 min late.' } })
    fireEvent.click(screen.getByText('Submit Report').closest('button'))

    await waitFor(() => expect(screen.getByText('Report Saved')).toBeInTheDocument())
    expect(createDisReport).toHaveBeenCalledWith(expect.objectContaining({
      student_id: 'u1',
      report_type: 'incident',
      title: 'Late to class',
      description: 'Was 10 min late.',
    }))
  })
})
