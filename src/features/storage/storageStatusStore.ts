import { create } from 'zustand'
import type { QuarantineItem } from './move'

export type StorageStatus = {
  kind: 'indexeddb' | 'localstorage'
  /** When the data moved to the database (ISO), if it has. */
  movedAt: string | null
  /** The move happened on this start-up; the shell says so once. */
  justMoved: boolean
  /** Records that keep the automatic move from running, until the owner decides. */
  blocked: QuarantineItem[] | null
  /** Why the last automatic move didn't finish. */
  failedReason: string | null
  /** An older Ollie window changed the old copy after the move. */
  oldCopyChanged: boolean
  /** A change couldn't be saved; stays until the app reloads. */
  saveFailed: boolean
}

type StorageStatusStore = StorageStatus & { update: (p: Partial<StorageStatus>) => void }

export const useStorageStatusStore = create<StorageStatusStore>((set) => ({
  kind: 'localstorage',
  movedAt: null,
  justMoved: false,
  blocked: null,
  failedReason: null,
  oldCopyChanged: false,
  saveFailed: false,
  update: (p) => set(p),
}))
