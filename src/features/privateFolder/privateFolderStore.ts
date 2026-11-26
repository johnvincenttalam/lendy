import { create } from 'zustand'
import { hashPin } from '../lock/pinHash'
import { useLockStore } from '../lock/lockStore'
import { FOLDER_KEYS, cleanFolderName } from './privateFolderUtils'

const NAME_KEY = FOLDER_KEYS.name
const PIN_HASH_KEY = FOLDER_KEYS.pinHash
const RECOVERY_KEY = FOLDER_KEYS.recoveryHash

/** The app PIN's hash right now, if the app lock is on — saved as the folder's recovery key. */
function currentAppPinHash(): string | null {
  const { enabled, pinHash } = useLockStore.getState()
  return enabled && pinHash ? pinHash : null
}

function saveRecovery(hash: string | null) {
  if (hash) write(RECOVERY_KEY, hash)
  else remove(RECOVERY_KEY)
}

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

const cleanName = cleanFolderName

type PrivateFolderStore = {
  /** The owner's name for the folder; null until set up ("" = default label). */
  name: string | null
  pinHash: string | null
  /** App PIN hash saved when the folder PIN was set; "Forgot PIN" checks this. */
  recoveryHash: string | null
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
  /** Re-reads the folder settings after a restore wrote them; it opens locked. */
  reloadFromStorage: () => void
}

export const usePrivateFolderStore = create<PrivateFolderStore>((set, get) => ({
  name: read(NAME_KEY),
  pinHash: read(PIN_HASH_KEY),
  recoveryHash: read(RECOVERY_KEY),
  unlocked: false,

  setUp: async (name, pin) => {
    const hash = await hashPin(pin)
    const clean = cleanName(name)
    write(NAME_KEY, clean)
    write(PIN_HASH_KEY, hash)
    const recoveryHash = currentAppPinHash()
    saveRecovery(recoveryHash)
    set({ name: clean, pinHash: hash, recoveryHash, unlocked: true })
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
    const recoveryHash = currentAppPinHash()
    saveRecovery(recoveryHash)
    set({ pinHash: hash, recoveryHash })
  },

  removePin: () => {
    remove(PIN_HASH_KEY)
    saveRecovery(null)
    set({ pinHash: null, recoveryHash: null })
  },

  reloadFromStorage: () =>
    set({ name: read(NAME_KEY), pinHash: read(PIN_HASH_KEY), recoveryHash: read(RECOVERY_KEY), unlocked: false }),
}))

/** Set up once named (even with an empty name), whether or not a PIN is on. */
export const selectIsSetUp = (s: PrivateFolderStore) => s.name !== null
export const selectHasPin = (s: PrivateFolderStore) => s.pinHash !== null
