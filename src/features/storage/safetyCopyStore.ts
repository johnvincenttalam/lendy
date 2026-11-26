import type { KeyValueStorage } from './backend'
import type { OllieDb } from './db'

/** Where a restore's safety copy is kept: next to the data, on either storage. */
export interface SafetyCopyStore {
  read(): Promise<unknown>
  write(copy: unknown): Promise<void>
  remove(): Promise<void>
}

export const SAFETY_COPY_KEY = 'loan-tracker-pre-restore'

export function localSafetyStore(storage: KeyValueStorage): SafetyCopyStore {
  return {
    async read() {
      const raw = storage.getItem(SAFETY_COPY_KEY)
      if (!raw) return null
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    },
    async write(copy) {
      storage.setItem(SAFETY_COPY_KEY, JSON.stringify(copy))
    },
    async remove() {
      storage.removeItem(SAFETY_COPY_KEY)
    },
  }
}

export function dexieSafetyStore(db: OllieDb): SafetyCopyStore {
  return {
    async read() {
      return (await db.kv.get('safetyCopy'))?.value ?? null
    },
    async write(copy) {
      await db.kv.put({ key: 'safetyCopy', value: copy })
    },
    async remove() {
      await db.kv.delete('safetyCopy')
    },
  }
}
