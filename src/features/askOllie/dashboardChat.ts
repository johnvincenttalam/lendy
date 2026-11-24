import { create } from 'zustand'
import type { ChatMessage } from './askClient'

/** A chat bubble; `error` marks Ollie's failure notes, which aren't sent back to Groq. */
export type Bubble = ChatMessage & { error?: boolean }

type DashboardChat = {
  messages: Bubble[]
  waiting: boolean
  add: (message: Bubble) => void
  setWaiting: (waiting: boolean) => void
  clear: () => void
}

/**
 * The dashboard chat's conversation, kept in memory only: closing the sheet
 * by accident doesn't lose it, but nothing is written to storage, so
 * reloading the app starts fresh. The folder chat never uses this — it
 * sees private loans, so it clears whenever it closes.
 */
export const useDashboardChat = create<DashboardChat>((set) => ({
  messages: [],
  waiting: false,
  add: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setWaiting: (waiting) => set({ waiting }),
  clear: () => set({ messages: [], waiting: false }),
}))
