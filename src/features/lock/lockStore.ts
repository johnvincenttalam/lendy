import { create } from 'zustand'

const PIN_HASH_KEY = 'loan-tracker-pin-hash'
const PIN_ENABLED_KEY = 'loan-tracker-pin-enabled'

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

type LockStore = {
  pinHash: string | null
  enabled: boolean
  locked: boolean
  setPin: (pin: string) => Promise<void>
  removePin: () => void
  verifyPin: (pin: string) => Promise<boolean>
  lock: () => void
}

export const useLockStore = create<LockStore>((set, get) => ({
  pinHash: localStorage.getItem(PIN_HASH_KEY),
  enabled: localStorage.getItem(PIN_ENABLED_KEY) === 'true',
  locked: localStorage.getItem(PIN_ENABLED_KEY) === 'true' && !!localStorage.getItem(PIN_HASH_KEY),

  setPin: async (pin: string) => {
    const hash = await hashPin(pin)
    localStorage.setItem(PIN_HASH_KEY, hash)
    localStorage.setItem(PIN_ENABLED_KEY, 'true')
    set({ pinHash: hash, enabled: true })
  },

  removePin: () => {
    localStorage.removeItem(PIN_HASH_KEY)
    localStorage.removeItem(PIN_ENABLED_KEY)
    set({ pinHash: null, enabled: false, locked: false })
  },

  verifyPin: async (pin: string) => {
    const hash = await hashPin(pin)
    if (hash === get().pinHash) {
      set({ locked: false })
      return true
    }
    return false
  },

  lock: () => {
    const { enabled, pinHash } = get()
    if (enabled && pinHash) set({ locked: true })
  },
}))
