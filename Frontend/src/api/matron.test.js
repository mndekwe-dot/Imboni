import { describe, it, expect, vi, beforeEach } from 'vitest'
import client from './client'
import * as matron from './matron'

vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

describe('matron api', () => {
  beforeEach(() => vi.resetAllMocks())

  it('dashboard and students', () => {
    matron.getMatronDashboard()
    expect(client.get).toHaveBeenCalledWith('/imboni/matron/dashboard/')

    matron.getMatronStudents({ page: 1 })
    expect(client.get).toHaveBeenCalledWith('/imboni/matron/students/', { params: { page: 1 } })

    matron.getMatronStudent(1)
    expect(client.get).toHaveBeenCalledWith('/imboni/matron/students/1/')
  })

  it('health records', () => {
    matron.getMatronHealth({ studentId: 1 })
    expect(client.get).toHaveBeenCalledWith('/imboni/matron/health/', { params: { studentId: 1 } })

    const data = { note: 'fever' }
    matron.createHealthRecord(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/matron/health/', data)

    matron.updateHealthRecord(2, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/matron/health/2/', data)
  })

  it('incidents', () => {
    matron.getMatronIncidents({ severity: 'high' })
    expect(client.get).toHaveBeenCalledWith('/imboni/matron/incidents/', { params: { severity: 'high' } })

    const data = { detail: 'fall' }
    matron.createMatronIncident(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/matron/incidents/', data)
  })

  it('schedule endpoints', () => {
    matron.getMatronSchedule()
    expect(client.get).toHaveBeenCalledWith('/imboni/matron/schedule/')

    matron.getMatronBoardingSchedule()
    expect(client.get).toHaveBeenCalledWith('/imboni/matron/boarding-schedule/')
  })

  it('night check', () => {
    matron.getMatronNightCheck({ date: '2026-06-29' })
    expect(client.get).toHaveBeenCalledWith('/imboni/matron/night-check/', { params: { date: '2026-06-29' } })

    const data = { present: 30 }
    matron.submitMatronNightCheck(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/matron/night-check/', data)
  })

  // Parent communications moved to the discipline API: contacting a family is
  // the office's decision, not the dormitory's. See api/discipline.js.
  it('does not reach parent communications from the matron portal', () => {
    expect(matron.getParentComms).toBeUndefined()
    expect(matron.sendParentComm).toBeUndefined()
  })

  it('searches students by the query the server actually reads', () => {
    matron.searchMatronStudents('Uwase')
    expect(client.get).toHaveBeenCalledWith('/imboni/matron/students/', {
      params: { search: 'Uwase' },
    })
  })

  it('messages', () => {
    matron.getMatronMessages()
    expect(client.get).toHaveBeenCalledWith('/imboni/matron/messages/')

    const data = { text: 'hi' }
    matron.sendMatronMessage(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/matron/messages/', data)
  })
})
