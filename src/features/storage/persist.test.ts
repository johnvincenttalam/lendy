import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  const map = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage
})

import { persist, whenSaved } from './persist'
import { getActiveStorage, setActiveStorage } from './activeStorage'
import { useStorageStatusStore } from './storageStatusStore'
import { localSafetyStore } from './safetyCopyStore'
import { emptySnapshot } from './snapshot'
import type { Change } from './snapshot'
import type { DataBackend } from './backend'

type Pending = { change: Change; resolve: () => void; reject: (e: Error) => void }

function manualBackend() {
  const started: Pending[] = []
  const backend: DataBackend = {
    kind: 'indexeddb',
    readAll: async () => emptySnapshot(),
    replaceAll: async () => {},
    write: (change) => new Promise<void>((resolve, reject) => { started.push({ change, resolve, reject }) }),
  }
  return { backend, started }
}

const tick = () => new Promise((r) => setTimeout(r, 0))
const a: Change = { monthlyIncome: { next: 1, prev: 0 } }
const b: Change = { monthlyIncome: { next: 2, prev: 1 } }

describe('the save queue', () => {
  beforeEach(() => useStorageStatusStore.getState().update({ saveFailed: false }))

  it('getActiveStorage falls back to the device storage before start-up', () => {
    expect(getActiveStorage().backend.kind).toBe('localstorage')
  })

  it('writes land one at a time, in order', async () => {
    const { backend, started } = manualBackend()
    setActiveStorage({ backend, safety: localSafetyStore(localStorage), prefs: localStorage, db: null })
    void persist(a)
    void persist(b)
    await tick()
    expect(started.map((p) => p.change)).toEqual([a])
    started[0].resolve()
    await tick()
    expect(started.map((p) => p.change)).toEqual([a, b])
    started[1].resolve()
    await whenSaved()
  })

  it('a failed write shows the warning and later writes still run', async () => {
    const { backend, started } = manualBackend()
    setActiveStorage({ backend, safety: localSafetyStore(localStorage), prefs: localStorage, db: null })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    void persist(a)
    void persist(b)
    await tick()
    started[0].reject(new Error('quota'))
    await tick()
    expect(useStorageStatusStore.getState().saveFailed).toBe(true)
    expect(started).toHaveLength(2)
    started[1].resolve()
    await whenSaved()
    err.mockRestore()
  })

  it('whenSaved waits for everything queued so far', async () => {
    const { backend, started } = manualBackend()
    setActiveStorage({ backend, safety: localSafetyStore(localStorage), prefs: localStorage, db: null })
    let done = false
    void persist(a)
    void whenSaved().then(() => { done = true })
    await tick()
    expect(done).toBe(false)
    started[0].resolve()
    await tick()
    expect(done).toBe(true)
  })
})
