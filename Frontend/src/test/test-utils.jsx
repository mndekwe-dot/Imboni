import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AnnouncementsProvider } from '../context/AnnouncementsContext'

export function renderWithRouter(ui, { route = '/', ...options } = {}) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[route]}>
        <AnnouncementsProvider>{children}</AnnouncementsProvider>
      </MemoryRouter>
    ),
    ...options,
  })
}

export function setSessionUser(user) {
  localStorage.setItem('imboni_user', JSON.stringify(user))
  localStorage.setItem('imboni_access', 'test-access-token')
  localStorage.setItem('imboni_refresh', 'test-refresh-token')
}

export * from '@testing-library/react'
