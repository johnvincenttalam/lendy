import { create } from 'zustand'
import { readSafetyCopy } from './restore'
import { getActiveStorage } from '../storage/activeStorage'

type LastRestoreStore = {
  /** When the last restore happened, while it can still be undone; null otherwise. */
  restoredAt: string | null
  /** Re-checks at start-up and after a restore or an undo, from wherever it happened (Settings or the toast). */
  refresh: () => Promise<void>
}

export const useLastRestoreStore = create<LastRestoreStore>((set) => ({
  restoredAt: null,
  refresh: async () => {
    let restoredAt: string | null = null
    try {
      restoredAt = (await readSafetyCopy(getActiveStorage().safety))?.savedAt ?? null
    } catch {
      restoredAt = null
    }
    set({ restoredAt })
  },
}))
