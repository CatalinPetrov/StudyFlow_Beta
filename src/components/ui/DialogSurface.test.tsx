import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DialogSurface } from './DialogSurface'

function DialogHarness({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Deschide</button>
      {open && (
        <DialogSurface
          label="Test dialog"
          onClose={() => {
            onClose()
            setOpen(false)
          }}
        >
          <button>Primul</button>
          <button>Al doilea</button>
        </DialogSurface>
      )}
    </>
  )
}

describe('DialogSurface', () => {
  it('focuses the first control, traps Tab and restores focus on close', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)

    const trigger = screen.getByRole('button', { name: 'Deschide' })
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Test dialog' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Primul' })).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')

    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Al doilea' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Primul' })).toHaveFocus()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
  })

  it('closes only the topmost dialog with Escape', async () => {
    const user = userEvent.setup()
    const firstClose = vi.fn()
    const secondClose = vi.fn()
    const { rerender } = render(
      <DialogSurface label="Primul dialog" onClose={firstClose}>
        <button>Unu</button>
      </DialogSurface>,
    )
    expect(screen.getByRole('dialog', { name: 'Primul dialog' })).toBeInTheDocument()

    rerender(
      <>
        <DialogSurface label="Primul dialog" onClose={firstClose}>
          <button>Unu</button>
        </DialogSurface>
        <DialogSurface label="Al doilea dialog" onClose={secondClose}>
          <button>Doi</button>
        </DialogSurface>
      </>,
    )

    await user.keyboard('{Escape}')
    expect(secondClose).toHaveBeenCalledOnce()
    expect(firstClose).not.toHaveBeenCalled()

    rerender(
      <DialogSurface label="Primul dialog" onClose={firstClose}>
        <button>Unu</button>
      </DialogSurface>,
    )
    await user.keyboard('{Escape}')
    expect(firstClose).toHaveBeenCalledOnce()
  })
})
