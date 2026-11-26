// Imported first in main.tsx: upgrades the data in the browser's simple
// storage before start-up reads it.
import { migrateStorage } from './schema'
import { STORAGE_FLAG_KEY } from '../storage/storageKeys'

try {
  // Once the data lives in the database, the old copy is left exactly as it
  // was at the move (its fingerprint shows whether an old window changed it);
  // the database's data is upgraded at start-up instead.
  if (localStorage.getItem(STORAGE_FLAG_KEY) !== 'indexeddb') migrateStorage(localStorage)
} catch (err) {
  // The version isn't bumped on failure, so the next launch tries again.
  console.error('Upgrading saved data failed', err)
}
