import { X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'

type Props = {
  title: string
  onClose: () => void
  /** Pinned below the scrolling body. */
  footer?: ReactNode
  children: ReactNode
}

/** Open sheets, newest last: Escape closes only the top one. */
const openSheets: string[] = []

export default function Sheet({ title, onClose, footer, children }: Props) {
  useBodyScrollLock(true)
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  // Focus moves into the sheet, and back to whatever opened it on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    openSheets.push(titleId)
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openSheets[openSheets.length - 1] === titleId) {
        e.preventDefault()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      openSheets.splice(openSheets.indexOf(titleId), 1)
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [titleId])

  return (
    <div className="fixed inset-0 bg-overlay z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-card w-full h-full sm:h-auto sm:max-w-lg sm:rounded-2xl rounded-none sm:max-h-[92vh] flex flex-col overflow-hidden border-0 sm:border border-themed animate-slide-up"
      >
        <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-4 border-b border-divider sm:border-b-0">
          <h2 id={titleId} className="text-[20px] font-bold text-primary tracking-tight">{title}</h2>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-lg hover:opacity-60 focus-visible:ring-2 focus-visible:ring-brand transition-opacity">
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
