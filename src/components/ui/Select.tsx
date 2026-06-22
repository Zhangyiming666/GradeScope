import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export function Select({ label, className, children, disabled, ...props }: SelectProps) {
  return (
    <label className="block min-w-0">
      {label ? <span className="mb-1 block text-xs font-medium text-text">{label}</span> : null}
      <div className="relative">
        <select
          disabled={disabled}
          className={cn(
            'h-10 w-full appearance-none rounded-lg border border-line bg-white pl-3 pr-9 text-sm text-strong outline-none transition',
            'cursor-pointer hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-muted',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className={cn(
            'pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted',
            disabled && 'opacity-50'
          )}
          aria-hidden="true"
        />
      </div>
    </label>
  )
}
