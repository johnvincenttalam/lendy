// Kept apart from Confetti.tsx so that file exports only a component (fast refresh).
type Listener = () => void

let listeners: Listener[] = []

export function triggerConfetti() {
  listeners.forEach((fn) => fn())
}

/** Subscribes to confetti bursts; returns the unsubscribe function. */
export function onConfetti(fn: Listener): () => void {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}
