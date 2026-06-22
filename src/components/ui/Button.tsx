import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { cn } from '../../utils/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'icon'
}

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'border-primary bg-primary text-white hover:bg-blue-700',
        variant === 'secondary' && 'border-line bg-white text-strong hover:bg-primary-soft',
        variant === 'ghost' && 'border-transparent bg-transparent text-text hover:bg-primary-soft',
        variant === 'danger' && 'border-red-200 bg-red-50 text-danger hover:bg-red-100',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'icon' && 'h-9 w-9 p-0',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
