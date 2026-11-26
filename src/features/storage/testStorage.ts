import type { KeyValueStorage } from './backend'

/** An in-memory stand-in for localStorage, for tests. `failOnSet` makes chosen writes throw. */
export type MemoryStorage = KeyValueStorage & {
  map: Map<string, string>
  failOnSet: ((key: string) => boolean) | null
}

export function memoryStorage(initial: Record<string, string> = {}): MemoryStorage {
  const map = new Map(Object.entries(initial))
  const s: MemoryStorage = {
    map,
    failOnSet: null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      if (s.failOnSet?.(k)) throw new Error(`QuotaExceededError: ${k}`)
      map.set(k, v)
    },
    removeItem: (k) => { map.delete(k) },
  }
  return s
}
