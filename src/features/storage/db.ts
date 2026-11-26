import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { Row } from './centavos'
import type { RecordField } from './snapshot'

export const DB_NAME = 'ollie'

export type KvKey = 'monthlyIncome' | 'migration' | 'schemaVersion' | 'safetyCopy'

/** A record the move set aside because it failed its check, kept with its raw value. */
export type QuarantineRow = { qid?: number; field: RecordField; id: string | null; name: string | null; reason: string; raw: unknown }

/** Ollie's database in this browser. Money is in centavos; `_seq` keeps each list's order. */
export class OllieDb extends Dexie {
  // `declare` so class-field initialisation doesn't overwrite the tables Dexie sets up.
  declare loans: Table<Row, string>
  declare payments: Table<Row, string>
  declare bills: Table<Row, string>
  declare billPayments: Table<Row, string>
  declare savingsGoals: Table<Row, string>
  declare savingsTransactions: Table<Row, string>
  declare kv: Table<{ key: KvKey; value: unknown }, KvKey>
  declare quarantine: Table<QuarantineRow, number>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      loans: 'id, _seq',
      payments: 'id, loanId, _seq',
      bills: 'id, _seq',
      billPayments: 'id, billId, _seq',
      savingsGoals: 'id, _seq',
      savingsTransactions: 'id, goalId, _seq',
      kv: 'key',
      quarantine: '++qid, field',
    })
  }

  recordTable(field: RecordField): Table<Row, string> {
    return this[field]
  }
}

/** Not opened yet: Dexie opens on first use, or call `open()`. */
export function createOllieDb(name: string = DB_NAME): OllieDb {
  return new OllieDb(name)
}

/** Ollie's database, opened (waits for other tabs to let go). */
export async function openOllieDb(): Promise<OllieDb> {
  const db = createOllieDb()
  await db.open()
  return db
}

export async function getKv<T>(db: OllieDb, key: KvKey): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined
}

export async function setKv(db: OllieDb, key: KvKey, value: unknown): Promise<void> {
  await db.kv.put({ key, value })
}
