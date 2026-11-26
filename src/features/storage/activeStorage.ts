import type { DataBackend, KeyValueStorage } from './backend'
import type { OllieDb } from './db'
import { createLocalStorageBackend } from './localStorageBackend'
import { localSafetyStore } from './safetyCopyStore'
import type { SafetyCopyStore } from './safetyCopyStore'

/** The storage in use: the data, where a restore's safety copy goes, and preferences. */
export type ActiveStorage = {
  backend: DataBackend
  safety: SafetyCopyStore
  /** Preferences (folder PIN, last-backup date) always stay in the browser's simple storage. */
  prefs: KeyValueStorage
  /** The open database, when the data lives there. */
  db: OllieDb | null
}

let active: ActiveStorage | null = null

/** Set once at start-up, after the storage is chosen. */
export function setActiveStorage(a: ActiveStorage): void {
  active = a
}

/** Until start-up has chosen, this is the browser's simple storage (as in tests). */
export function getActiveStorage(): ActiveStorage {
  if (!active) {
    const storage = globalThis.localStorage
    active = { backend: createLocalStorageBackend(storage), safety: localSafetyStore(storage), prefs: storage, db: null }
  }
  return active
}
