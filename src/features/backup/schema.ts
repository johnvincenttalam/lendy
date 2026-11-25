/**
 * The version of Ollie's saved data, and the steps that bring older data up
 * to date. Device storage and backup files share one shape (the backup's
 * field names), so a single list of migrations upgrades both.
 */

/** Bump this, and add MIGRATIONS[n], whenever the saved shape changes. */
export const SCHEMA_VERSION = 1
export const SCHEMA_KEY = 'loan-tracker-schema-version'

/** Where each part of the data lives on the device, by its backup field name. */
export const STORAGE_FIELDS = {
  loans: 'loan-tracker-loans',
  payments: 'loan-tracker-payments',
  monthlyIncome: 'loan-tracker-income',
  bills: 'loan-tracker-bills',
  billPayments: 'loan-tracker-bill-payments',
  savingsGoals: 'loan-tracker-savings-goals',
  savingsTransactions: 'loan-tracker-savings-transactions',
} as const

export type Snapshot = Record<string, unknown>
export type Migration = (data: Snapshot) => Snapshot

/**
 * MIGRATIONS[n] turns version n-1 data into version n. Version 1 is the
 * shape as of 2026-11-25; data saved before versioning counts as version 0
 * and needs no change, so there is no MIGRATIONS[1].
 */
export const MIGRATIONS: Record<number, Migration> = {}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The version a backup file was made with; 0 for files from before versioning. */
export function backupVersion(data: Snapshot): number {
  const v = data.schemaVersion
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0
}

export function migrateSnapshot(
  data: Snapshot,
  from: number,
  migrations: Record<number, Migration> = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): Snapshot {
  let out = data
  for (let v = from + 1; v <= target; v++) {
    const step = migrations[v]
    if (step) out = step(out)
  }
  return out
}

function storedVersion(storage: KeyValueStorage): number {
  const v = Number(storage.getItem(SCHEMA_KEY))
  return Number.isInteger(v) && v >= 0 ? v : 0
}

/**
 * Upgrades the data on this device in place. Runs before any store reads
 * storage. Data from a newer version (say, after rolling a deploy back) is
 * left alone rather than guessed at.
 */
export function migrateStorage(
  storage: KeyValueStorage,
  migrations: Record<number, Migration> = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): void {
  const from = storedVersion(storage)
  if (from >= target) return

  let needed = false
  for (let v = from + 1; v <= target; v++) if (migrations[v]) needed = true

  if (needed) {
    const before: Snapshot = {}
    for (const [field, key] of Object.entries(STORAGE_FIELDS)) {
      const raw = storage.getItem(key)
      if (raw === null) continue
      try {
        before[field] = JSON.parse(raw)
      } catch {
        // Unreadable values are left exactly as they are.
      }
    }
    const after = migrateSnapshot(before, from, migrations, target)
    for (const [field, key] of Object.entries(STORAGE_FIELDS)) {
      if (after[field] !== undefined) storage.setItem(key, JSON.stringify(after[field]))
      else if (field in before) storage.removeItem(key)
    }
  }

  storage.setItem(SCHEMA_KEY, String(target))
}
