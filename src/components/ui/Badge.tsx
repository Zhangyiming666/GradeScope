import type { HTMLAttributes, PropsWithChildren } from 'react'
import { cn } from '../../utils/cn'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'slate'
}

export function Badge({ children, className, tone = 'blue', ...props }: PropsWithChildren<BadgeProps>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
        tone === 'blue' && 'border-blue-200 bg-blue-50 text-blue-700',
        tone === 'green' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
        tone === 'amber' && 'border-amber-200 bg-amber-50 text-amber-700',
        tone === 'red' && 'border-red-200 bg-red-50 text-red-700',
        tone === 'slate' && 'border-slate-200 bg-slate-50 text-slate-600',
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
