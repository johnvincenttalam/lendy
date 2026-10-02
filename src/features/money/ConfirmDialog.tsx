import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

type Props = {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: Props) {
  useBodyScrollLock(true)

  return (
    <div className="fixed inset-0 bg-overlay z-[60] flex items-center justify-center p-5 animate-fade-in">
      <div className="bg-card rounded-2xl p-6 max-w-[320px] w-full border border-themed transition-colors animate-scale-in">
        <h3 className="font-bold text-primary text-[18px] tracking-tight mb-2">{title}</h3>
        <p className="text-[13px] text-secondary mb-6">{message}</p>
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-subtle text-secondary font-semibold text-[14px] hover:opacity-80 transition-opacity"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl font-semibold text-[14px] text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#EF4444' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
