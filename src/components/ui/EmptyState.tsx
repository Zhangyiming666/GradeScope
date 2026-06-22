import { Inbox } from 'lucide-react'
import type { PropsWithChildren } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
}

export function EmptyState({ title, description, children }: PropsWithChildren<EmptyStateProps>) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-slate-50/60 p-8 text-center">
      <Inbox className="mb-3 h-8 w-8 text-muted" aria-hidden="true" />
      <h3 className="text-base font-semibold text-strong">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm text-muted">{description}</p> : null}
      {children ? <div className="mt-4 flex items-center gap-3">{children}</div> : null}
    </div>
  )
}
