import { Button } from './Button'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认',
  onConfirm,
  onClose
}: ConfirmDialogProps) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm leading-6 text-text">{description}</p>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          取消
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
