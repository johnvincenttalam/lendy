import type { Change, DataSnapshot } from './snapshot'

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Where the money data lives: the browser's simple storage or its database. */
export interface DataBackend {
  kind: 'localstorage' | 'indexeddb'
  readAll(): Promise<DataSnapshot>
  /** One atomic write for several fields; arrays are diffed by id and object identity. */
  write(change: Change): Promise<void>
  /** Atomic full replace (restore, undo, rollback). */
  replaceAll(snapshot: DataSnapshot): Promise<void>
}

/** A replaceAll that failed; rolledBack says whether the earlier data is fully back. */
export class ReplaceAllError extends Error {
  readonly rolledBack: boolean
  constructor(rolledBack: boolean, options?: { cause?: unknown }) {
    super(rolledBack ? 'Couldn’t save; nothing was changed' : 'Couldn’t save, and couldn’t put everything back', options)
    this.name = 'ReplaceAllError'
    this.rolledBack = rolledBack
  }
}
