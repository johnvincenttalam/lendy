import { create } from 'zustand'
import { readSafetyCopy } from './restore'

function read(): string | null {
  try {
    return readSafetyCopy(localStorage)?.savedAt ?? null
  } catch {
    return null
  }
}

type LastRestoreStore = {
  /** When the last restore happened, while it can still be undone; null otherwise. */
  restoredAt: string | null
  /** Re-checks after a restore or an undo, from wherever it happened (Settings or the toast). */
  refresh: () => void
}

export const useLastRestoreStore = create<LastRestoreStore>((set) => ({
  restoredAt: read(),
  refresh: () => set({ restoredAt: read() }),
}))
