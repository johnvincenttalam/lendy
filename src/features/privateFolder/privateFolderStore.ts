import { create } from 'zustand'
import { hashPin } from '../lock/lockStore'
import { MAX_FOLDER_NAME } from './privateFolderUtils'

const NAME_KEY = 'loan-tracker-private-name'
const PIN_HASH_KEY = 'loan-tracker-private-pin-hash'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // nothing to clean up
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage unavailable — the folder keeps working for this session.
  }
}

const cleanName = (name: string) => name.trim().slice(0, MAX_FOLDER_NAME).trim()

type PrivateFolderStore = {
  /** The owner's name for the folder; null until set up ("" = default label). */
  name: string | null
  pinHash: string | null
  /** In memory only — every reload starts locked. */
  unlocked: boolean
  setUp: (name: string, pin: string) => Promise<void>
  unlock: (pin: string) => Promise<boolean>
  lock: () => void
  rename: (name: string) => void
  /** Callers check the current PIN (or the app PIN) first. */
  changePin: (pin: string) => Promise<void>
  /** Turns the PIN off. Callers check the current PIN first. */
  removePin: () => void
}

export const usePrivateFolderStore = create<PrivateFolderStore>((set, get) => ({
  name: read(NAME_KEY),
  pinHash: read(PIN_HASH_KEY),
  unlocked: false,

  setUp: async (name, pin) => {
    const hash = await hashPin(pin)
    const clean = cleanName(name)
    write(NAME_KEY, clean)
    write(PIN_HASH_KEY, hash)
    set({ name: clean, pinHash: hash, unlocked: true })
  },

  unlock: async (pin) => {
    const { pinHash } = get()
    if (!pinHash) return false
    const ok = (await hashPin(pin)) === pinHash
    if (ok) set({ unlocked: true })
    return ok
  },

  lock: () => {
    if (get().unlocked) set({ unlocked: false })
  },

  rename: (name) => {
    const clean = cleanName(name)
    write(NAME_KEY, clean)
    set({ name: clean })
  },

  changePin: async (pin) => {
    const hash = await hashPin(pin)
    write(PIN_HASH_KEY, hash)
    set({ pinHash: hash })
  },

  removePin: () => {
    remove(PIN_HASH_KEY)
    set({ pinHash: null })
  },
}))

/** Set up once named (even with an empty name), whether or not a PIN is on. */
export const selectIsSetUp = (s: PrivateFolderStore) => s.name !== null
export const selectHasPin = (s: PrivateFolderStore) => s.pinHash !== null
