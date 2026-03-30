import { useEffect, useState } from 'react'

export type ToastData = {
  id: string
  message: string
  action?: { label: string; onClick: () => void }
}

let listeners: ((toast: ToastData) => void)[] = []

export function showToast(message: string, action?: { label: string; onClick: () => void }) {
  const toast: ToastData = { id: crypto.randomUUID(), message, action }
  listeners.forEach((fn) => fn(toast))
}

export default function ToastContainer() {
  const [toast, setToast] = useState<ToastData | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>
    let removeTimer: ReturnType<typeof setTimeout>

    const handler = (incoming: ToastData) => {
      // Clear existing timers
      clearTimeout(hideTimer)
      clearTimeout(removeTimer)

      setToast(incoming)
      // Trigger enter animation on next frame
      requestAnimationFrame(() => setVisible(true))

      hideTimer = setTimeout(() => {
        setVisible(false)
        removeTimer = setTimeout(() => setToast(null), 300)
      }, 3000)
    }

    listeners.push(handler)
    return () => {
      listeners = listeners.filter((fn) => fn !== handler)
      clearTimeout(hideTimer)
      clearTimeout(removeTimer)
    }
  }, [])

  if (!toast) return null

  return (
    <div className="fixed bottom-6 left-0 right-0 z-[100] flex justify-center px-3 pointer-events-none">
      <div
        className="pointer-events-auto max-w-2xl w-full rounded-xl bg-[#1C1C1E] dark:bg-[#2C2C2E] px-4 py-3.5 flex items-center gap-3 transition-all duration-300 ease-out"
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          opacity: visible ? 1 : 0,
        }}
      >
        <p className="text-[14px] font-medium text-white flex-1 leading-snug">{toast.message}</p>
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick()
              setVisible(false)
              setTimeout(() => setToast(null), 300)
            }}
            className="shrink-0 text-brand font-bold text-[14px] uppercase tracking-wide hover:opacity-80 transition-opacity"
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  )
}
