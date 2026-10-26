import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('rounded-card border border-line bg-surface p-5 shadow-card sm:p-6', className)}
      {...props}
    />
  )
}
