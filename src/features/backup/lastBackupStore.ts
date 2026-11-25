import { create } from 'zustand'

const LAST_BACKUP_KEY = 'loan-tracker-last-backup'

type LastBackupStore = {
  /** ISO timestamp of the last backup made or restored on this device. */
  lastBackupAt: string | null
  markBackedUp: () => void
}

function load(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY)
  } catch {
    return null
  }
}

export const useLastBackupStore = create<LastBackupStore>((set) => ({
  lastBackupAt: load(),
  markBackedUp: () => {
    const at = new Date().toISOString()
    try {
      localStorage.setItem(LAST_BACKUP_KEY, at)
    } catch {
      // Storage full or blocked: the reminder just shows again.
    }
    set({ lastBackupAt: at })
  },
}))
