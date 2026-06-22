import type { HTMLAttributes, PropsWithChildren } from 'react'
import { cn } from '../../utils/cn'

export function Card({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <section className={cn('min-w-0 rounded-2xl border border-line bg-white shadow-soft', className)} {...props}>
      {children}
    </section>
  )
}

export function CardHeader({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cn('flex min-w-0 flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLHeadingElement>>) {
  return (
    <h2 className={cn('text-lg font-semibold text-strong', className)} {...props}>
      {children}
    </h2>
  )
}

export function CardContent({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cn('min-w-0 p-5', className)} {...props}>
      {children}
    </div>
  )
}
