import type { InputHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id ?? props.name
  return (
    <label className="block min-w-0">
      {label ? <span className="mb-1 block text-xs font-medium text-text">{label}</span> : null}
      <input
        id={inputId}
        className={cn(
          'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-strong outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-50 disabled:text-muted',
          error && 'border-danger focus:border-danger focus:ring-danger/20',
          className
        )}
        {...props}
      />
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : null}
    </label>
  )
}
