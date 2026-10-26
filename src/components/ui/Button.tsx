import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white shadow-brand hover:bg-brand-deep',
  secondary: 'border border-line bg-surface text-ink shadow-sm hover:bg-surface-hover',
  ghost: 'text-ink-soft hover:bg-ink/[0.05] hover:text-ink',
  danger: 'bg-danger/10 text-danger hover:bg-danger/15',
  soft: 'bg-brand/10 text-brand-text hover:bg-brand/15',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 rounded-xl px-3 text-[13px]',
  md: 'h-11 gap-2 rounded-2xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-2xl px-5 text-[15px]',
  icon: 'size-10 rounded-full',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  leading?: ReactNode
  trailing?: ReactNode
}

export function Button({ variant = 'primary', size = 'md', leading, trailing, className, children, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'pressable inline-flex select-none items-center justify-center font-semibold outline-none disabled:pointer-events-none disabled:opacity-45',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {leading}
      {children}
      {trailing}
    </button>
  )
}
