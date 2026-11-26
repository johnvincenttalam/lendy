import { getActiveStorage } from './activeStorage'
import type { Change } from './snapshot'
import { useStorageStatusStore } from './storageStatusStore'

let chain: Promise<void> = Promise.resolve()

/**
 * Saves one change after the store has already updated the screen. Writes
 * run one at a time in the order they were made; a failure shows a lasting
 * warning but keeps what's on screen, and later writes still run.
 */
export function persist(change: Change): Promise<void> {
  chain = chain
    .then(() => getActiveStorage().backend.write(change))
    .catch((err: unknown) => {
      console.error('Saving a change failed', err)
      useStorageStatusStore.getState().update({ saveFailed: true })
    })
  return chain
}

/** Resolves once every change queued so far has been written (or has failed). */
export function whenSaved(): Promise<void> {
  return chain
}
