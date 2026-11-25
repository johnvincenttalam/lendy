// Imported first in main.tsx: stores read localStorage as soon as their
// modules load, so the data has to be upgraded before any of them do.
import { migrateStorage } from './schema'

try {
  migrateStorage(localStorage)
} catch (err) {
  // The version isn't bumped on failure, so the next launch tries again.
  console.error('Upgrading saved data failed', err)
}
