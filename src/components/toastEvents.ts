// Kept apart from Toast.tsx so that file exports only a component (fast refresh).
export type ToastData = {
  id: string
  message: string
  action?: { label: string; onClick: () => void }
}

type Listener = (toast: ToastData) => void

let listeners: Listener[] = []

export function showToast(message: string, action?: { label: string; onClick: () => void }) {
  const toast: ToastData = { id: crypto.randomUUID(), message, action }
  listeners.forEach((fn) => fn(toast))
}

/** Subscribes to toasts; returns the unsubscribe function. */
export function onToast(fn: Listener): () => void {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}
