import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./PdfReader', () => ({ PdfReader: () => null }))

const mockAuthState = vi.hoisted(() => ({ isValid: true, isLoading: false }))
const mockLogout = vi.hoisted(() => vi.fn())

vi.mock('./auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: unknown }) => <>{children as never}</>,
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    token: 'test-token',
    isValid: mockAuthState.isValid,
    isLoading: mockAuthState.isLoading,
    login: vi.fn(),
    register: vi.fn(),
    logout: mockLogout,
    refresh: vi.fn(),
  }),
}))

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App routes', () => {
  it('hydrates the home page from the local database', async () => {
    renderApp()
    expect(await screen.findByText('Orele de astăzi')).toBeInTheDocument()
  })

  it('navigates between lazy and standard pages', async () => {
    const user = userEvent.setup()
    renderApp()

    await screen.findByText('Orele de astăzi')

    await user.click(screen.getAllByRole('link', { name: 'Plan' })[0])
    expect(await screen.findByText('Taskurile mele')).toBeInTheDocument()

    await user.click(screen.getAllByRole('link', { name: 'Library' })[0])
    expect(await screen.findByRole('heading', { name: 'Library', level: 1 })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Study Hub' }))
    expect(await screen.findByRole('heading', { name: 'Study Hub', level: 1 })).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: /Deschide profilul/ })[0])
    expect(await screen.findByRole('heading', { name: 'Profil și setări', level: 1 })).toBeInTheDocument()
  })

  it('shows the login page when logged out', async () => {    mockAuthState.isValid = false
    try {
      renderApp()
      expect(await screen.findByRole('heading', { name: 'Conectare' })).toBeInTheDocument()
    } finally {
      mockAuthState.isValid = true
    }
  })

  it('logs out from the sidebar button', async () => {
    const user = userEvent.setup()
    renderApp()
    await screen.findByText('Orele de astăzi')

    await user.click(screen.getByRole('button', { name: 'Deconectare', hidden: true }))
    expect(mockLogout).toHaveBeenCalled()
  })

  it('applies and updates the theme preference', async () => {
    localStorage.setItem('studyflow-theme', 'dark')
    const user = userEvent.setup()
    renderApp('/profile')

    expect(await screen.findByText('Aspect')).toBeInTheDocument()
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))

    await user.click(screen.getByRole('radio', { name: /Luminoasă/ }))
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'))
    expect(localStorage.getItem('studyflow-theme')).toBe('light')
  })

  it('follows the system theme by default', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))
    renderApp()

    expect(await screen.findByText('Orele de astăzi')).toBeInTheDocument()
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
    expect(localStorage.getItem('studyflow-theme')).toBeNull()
  })

  it('falls back to the home page for unknown paths', async () => {
    renderApp('/not-a-real-route')
    expect(await screen.findByText('Orele de astăzi')).toBeInTheDocument()
  })
})
