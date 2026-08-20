import { create } from 'zustand'
import { CHANGELOG, CURRENT_VERSION } from './changelog'
import { parseSeenVersion, unseenCount } from './whatsNewUtils'

const SEEN_VERSION_KEY = 'loan-tracker-seen-version'

type SeenVersionStore = {
  seenVersion: string | null
  markCurrentSeen: () => void
}

/**
 * Which release the user has already read about. Deliberately absent from
 * backup.ts: this is UI state, not the user's data, and restoring an old
 * backup should not resurrect a badge.
 */
export const useSeenVersionStore = create<SeenVersionStore>((set) => ({
  seenVersion: parseSeenVersion(localStorage.getItem(SEEN_VERSION_KEY)),
  markCurrentSeen: () => {
    localStorage.setItem(SEEN_VERSION_KEY, CURRENT_VERSION)
    set({ seenVersion: CURRENT_VERSION })
  },
}))

/**
 * Badge count for the Settings row. Reads through the store so it clears the
 * moment What's New is opened, without a reload.
 */
export function useUnseenReleaseCount(): number {
  const seenVersion = useSeenVersionStore((s) => s.seenVersion)
  return unseenCount(CHANGELOG, seenVersion)
}
