import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AnnouncementsProvider } from '../context/AnnouncementsContext'
import { ToastProvider } from '../context/ToastContext'
import { setAccessToken } from '../api/session'

export function renderWithRouter(ui, { route = '/', ...options } = {}) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[route]}>
        <ToastProvider>
          <AnnouncementsProvider>{children}</AnnouncementsProvider>
        </ToastProvider>
      </MemoryRouter>
    ),
    ...options,
  })
}

export function setSessionUser(user) {
  localStorage.setItem('imboni_user', JSON.stringify(user))
  // The access token lives in memory only; the refresh token is in a cookie
  // the page never sees. See api/session.js.
  setAccessToken('test-access-token')
}

export * from '@testing-library/react'
