import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

let shouldThrow = true

function UnstableView() {
  if (shouldThrow) throw new Error('Test crash')
  return <p>Conținut recuperat</p>
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    shouldThrow = true
    vi.restoreAllMocks()
  })

  it('shows the fallback and recovers after retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()
    render(
      <ErrorBoundary label="Plan">
        <UnstableView />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Secțiunea „Plan” nu a putut fi afișată')
    shouldThrow = false
    await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
    expect(screen.getByText('Conținut recuperat')).toBeInTheDocument()
  })
})
