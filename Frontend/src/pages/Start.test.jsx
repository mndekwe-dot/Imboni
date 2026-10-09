import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Routes, Route } from 'react-router'
import { renderWithRouter, screen, fireEvent, waitFor, setSessionUser } from '../test/test-utils'
import { Start } from './Start'

const mockLookup = vi.fn()
const mockIdentity = vi.fn()
vi.mock('../api/discovery', () => ({
  lookupSchoolByCode: (...a) => mockLookup(...a),
  getSchoolIdentity: (...a) => mockIdentity(...a),
}))

// Navigating to another host would end the test run; record it instead.
const mockGo = vi.fn()
vi.mock('../utils/schoolHost', async (importActual) => ({
  ...(await importActual()),
  goToSchool: (...a) => mockGo(...a),
}))

const notFound = () => Object.assign(new Error('nope'), { response: { status: 404 } })
const offline = () => new Error('Network Error') // no .response: never reached the server

function renderStart(route = '/start') {
  return renderWithRouter(
    <Routes>
      <Route path="/start" element={<Start />} />
      <Route path="/login" element={<p>login page</p>} />
      <Route path="/teacher" element={<p>teacher home</p>} />
    </Routes>,
    { route },
  )
}

describe('Start (the installed app\'s first screen)', () => {
  beforeEach(() => {
    localStorage.clear()
    mockLookup.mockReset()
    mockGo.mockReset()
    mockIdentity.mockReset()
    mockIdentity.mockResolvedValue({ name: null }) // the bare domain
  })

  describe('with no school remembered', () => {
    it('asks for the school code', async () => {
      renderStart()
      expect(await screen.findByLabelText('School code')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    })

    it('looks the code up and hands over to that school\'s host', async () => {
      mockLookup.mockResolvedValueOnce({ name: 'Green Hills', domain: 'greenhills.imboni.tech' })
      renderStart()

      fireEvent.change(await screen.findByLabelText('School code'), { target: { value: '  GreenHills ' } })
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() => expect(mockGo).toHaveBeenCalledTimes(1))
      expect(mockLookup).toHaveBeenCalledWith('GreenHills')
      expect(mockGo.mock.calls[0][0]).toMatch(/\/\/greenhills\.imboni\.tech(:\d+)?\/start$/)
    })

    it('remembers the school for next time, in lower case', async () => {
      mockLookup.mockResolvedValueOnce({ name: 'Green Hills', domain: 'greenhills.imboni.tech' })
      renderStart()

      fireEvent.change(await screen.findByLabelText('School code'), { target: { value: 'GreenHills' } })
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

      await waitFor(() => expect(mockGo).toHaveBeenCalled())
      expect(JSON.parse(localStorage.getItem('imboni_school'))).toEqual({
        code: 'greenhills', name: 'Green Hills', domain: 'greenhills.imboni.tech',
      })
    })

    it('says so when no school has that code, and does not navigate', async () => {
      mockLookup.mockRejectedValueOnce(notFound())
      renderStart()

      fireEvent.change(await screen.findByLabelText('School code'), { target: { value: 'nothere' } })
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/could not find a school/i)
      expect(mockGo).not.toHaveBeenCalled()
      expect(localStorage.getItem('imboni_school')).toBeNull()
    })

    it('reports a connection problem as that, not as a wrong code', async () => {
      /* A flat connection must not read "we couldn't find your school": the code
         may be perfectly right and the person would retype it for nothing. */
      mockLookup.mockRejectedValueOnce(offline())
      renderStart()

      fireEvent.change(await screen.findByLabelText('School code'), { target: { value: 'greenhills' } })
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

      const alert = await screen.findByRole('alert')
      expect(alert).not.toHaveTextContent(/could not find a school/i)
      expect(mockGo).not.toHaveBeenCalled()
    })

    it('lets the person try again after a failure', async () => {
      mockLookup.mockRejectedValueOnce(notFound())
      renderStart()
      fireEvent.change(await screen.findByLabelText('School code'), { target: { value: 'typo' } })
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
      await screen.findByRole('alert')

      expect(screen.getByLabelText('School code')).not.toBeDisabled()
      expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled()
    })

    it('links to find-school for someone who does not know their code', async () => {
      renderStart()
      const link = await screen.findByRole('link', { name: /don't know your school code/i })
      expect(link).toHaveAttribute('href', '/find-school')
    })
  })

  describe('with a school remembered', () => {
    const remember = () => localStorage.setItem('imboni_school', JSON.stringify({
      code: 'greenhills', name: 'Green Hills', domain: 'greenhills.imboni.tech',
    }))

    it('re-checks it with the server, then goes straight there', async () => {
      remember()
      mockLookup.mockResolvedValueOnce({ name: 'Green Hills Academy', domain: 'greenhills.imboni.tech' })
      renderStart()

      await waitFor(() => expect(mockGo).toHaveBeenCalledTimes(1))
      expect(mockLookup).toHaveBeenCalledWith('greenhills')
      expect(mockGo.mock.calls[0][0]).toMatch(/\/\/greenhills\.imboni\.tech(:\d+)?\/start$/)
      // The fresh name replaces the remembered one.
      expect(JSON.parse(localStorage.getItem('imboni_school')).name).toBe('Green Hills Academy')
    })

    it('says which school it is opening, with a way out', async () => {
      remember()
      mockLookup.mockReturnValue(new Promise(() => {})) // never settles
      renderStart()

      expect(await screen.findByText('Opening Green Hills…')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Not your school?' })).toBeInTheDocument()
    })

    it('"Not your school?" forgets it and shows the code form', async () => {
      remember()
      mockLookup.mockReturnValue(new Promise(() => {}))
      renderStart()

      fireEvent.click(await screen.findByRole('button', { name: 'Not your school?' }))

      expect(await screen.findByLabelText('School code')).toBeInTheDocument()
      expect(localStorage.getItem('imboni_school')).toBeNull()
    })

    it('forgets a school that no longer exists and asks again', async () => {
      remember()
      mockLookup.mockRejectedValueOnce(notFound())
      renderStart()

      expect(await screen.findByLabelText('School code')).toBeInTheDocument()
      expect(localStorage.getItem('imboni_school')).toBeNull()
      expect(mockGo).not.toHaveBeenCalled()
    })

    it('trusts the remembered school when it cannot reach the server', async () => {
      /* Opening the app on a train must still work: the school's own host has
         the app cached from last time. */
      remember()
      mockLookup.mockRejectedValueOnce(offline())
      renderStart()

      await waitFor(() => expect(mockGo).toHaveBeenCalledTimes(1))
      expect(mockGo.mock.calls[0][0]).toMatch(/\/\/greenhills\.imboni\.tech(:\d+)?\/start$/)
      expect(localStorage.getItem('imboni_school')).not.toBeNull()
    })

    it('?other=1 forgets it up front and shows the form', async () => {
      remember()
      renderStart('/start?other=1')

      expect(await screen.findByLabelText('School code')).toBeInTheDocument()
      expect(localStorage.getItem('imboni_school')).toBeNull()
      expect(mockLookup).not.toHaveBeenCalled()
    })

    it('ignores a corrupt remembered value', async () => {
      localStorage.setItem('imboni_school', '{not json')
      renderStart()
      expect(await screen.findByLabelText('School code')).toBeInTheDocument()
    })
  })

  describe('on a school\'s own host', () => {
    it('goes to the login page when nobody is signed in', async () => {
      mockIdentity.mockResolvedValue({ name: 'Green Hills', subdomain: 'greenhills', status: 'active' })
      renderStart()
      expect(await screen.findByText('login page')).toBeInTheDocument()
      expect(mockLookup).not.toHaveBeenCalled()
    })

    it('goes to the signed-in user\'s own portal', async () => {
      mockIdentity.mockResolvedValue({ name: 'Green Hills', subdomain: 'greenhills', status: 'active' })
      setSessionUser({ role: 'teacher' })
      renderStart()
      expect(await screen.findByText('teacher home')).toBeInTheDocument()
    })
  })
})
