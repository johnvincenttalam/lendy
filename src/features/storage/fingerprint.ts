import { STORAGE_FIELDS } from '../backup/schema'
import type { KeyValueStorage } from './backend'

/**
 * A short check value for the old data keys, saved at move time. If it no
 * longer matches, something (an older Ollie window) wrote to the old copy
 * after the move. FNV-1a: fast and stable, not a security measure.
 */
export function fingerprintLegacy(storage: KeyValueStorage): string {
  const text = Object.values(STORAGE_FIELDS).map((k) => storage.getItem(k) ?? '\u0001').join('\u0000')
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
