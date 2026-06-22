import type { PropsWithChildren } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
}

export function Modal({ open, title, onClose, children }: PropsWithChildren<ModalProps>) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl border border-line bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold text-strong">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭弹窗">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
