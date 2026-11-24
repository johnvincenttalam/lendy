import { create } from 'zustand'
import { normalizeKey } from './groqClient'

/** The owner's own Groq key. Only ever sent to Groq; never in backups or exports. */
const KEY = 'loan-tracker-groq-key'

function read(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

type AskOllieStore = {
  apiKey: string | null
  setKey: (raw: string) => void
  removeKey: () => void
}

export const useAskOllieStore = create<AskOllieStore>((set) => ({
  apiKey: read(),

  setKey: (raw) => {
    const key = normalizeKey(raw)
    try {
      if (key) localStorage.setItem(KEY, key)
      else localStorage.removeItem(KEY)
    } catch {
      // Storage unavailable — the key works until the app reloads.
    }
    set({ apiKey: key })
  },

  removeKey: () => {
    try {
      localStorage.removeItem(KEY)
    } catch {
      // nothing to remove
    }
    set({ apiKey: null })
  },
}))
