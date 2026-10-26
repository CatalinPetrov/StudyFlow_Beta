import { useEffect, useRef, type FormEventHandler, type ReactNode } from 'react'

type Props = {
  label: string
  onClose: () => void
  children: ReactNode
  className?: string
  active?: boolean
  as?: 'section' | 'form'
  onSubmit?: FormEventHandler<HTMLFormElement>
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const dialogStack: HTMLElement[] = []
let openDialogs = 0
let previousBodyOverflow = ''

function focusableElements(node: HTMLElement): HTMLElement[] {
  return Array.from(node.querySelectorAll<HTMLElement>(focusableSelector)).filter(element => {
    if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false
    if (element.closest('[inert]')) return false
    return element.tabIndex !== -1
  })
}

export function DialogSurface({
  label,
  onClose,
  children,
  className,
  active = true,
  as = 'section',
  onSubmit,
}: Props) {
  const nodeRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!active) return
    const node = nodeRef.current
    if (!node) return

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogStack.push(node)
    if (openDialogs === 0) previousBodyOverflow = document.body.style.overflow
    openDialogs += 1
    document.body.style.overflow = 'hidden'

    if (!node.contains(document.activeElement)) {
      const initial = node.querySelector<HTMLElement>('[autofocus]') ?? focusableElements(node)[0] ?? node
      initial.focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== node) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const items = focusableElements(node)
      if (items.length === 0) {
        event.preventDefault()
        node.focus()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement
      if (event.shiftKey && (current === first || !node.contains(current))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (current === last || !node.contains(current))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      const index = dialogStack.lastIndexOf(node)
      if (index >= 0) dialogStack.splice(index, 1)
      openDialogs = Math.max(0, openDialogs - 1)
      if (openDialogs === 0) document.body.style.overflow = previousBodyOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [active])

  const sharedProps = {
    role: 'dialog' as const,
    'aria-modal': true,
    'aria-label': label,
    className,
    tabIndex: -1,
  }

  if (as === 'form') {
    return (
      <form
        {...sharedProps}
        ref={node => { nodeRef.current = node }}
        onSubmit={onSubmit}
      >
        {children}
      </form>
    )
  }

  return (
    <section
      {...sharedProps}
      ref={node => { nodeRef.current = node }}
    >
      {children}
    </section>
  )
}
