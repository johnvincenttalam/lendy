import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

type Props = {
  title: string
  onClose: () => void
  /** Pinned below the scrolling body. */
  footer?: ReactNode
  children: ReactNode
}

export default function Sheet({ title, onClose, footer, children }: Props) {
  useBodyScrollLock(true)

  return (
    <div className="fixed inset-0 bg-overlay z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="bg-card w-full h-full sm:h-auto sm:max-w-lg sm:rounded-2xl rounded-none sm:max-h-[92vh] flex flex-col overflow-hidden border-0 sm:border border-themed animate-slide-up">
        <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-4 border-b border-divider sm:border-b-0">
          <h2 className="text-[20px] font-bold text-primary tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center hover:opacity-60 transition-opacity">
            <X className="w-[18px] h-[18px] text-secondary" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto custom-scroll px-5 pt-1 pb-5 space-y-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-divider px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">{footer}</div>
        )}
      </div>
    </div>
  )
}
