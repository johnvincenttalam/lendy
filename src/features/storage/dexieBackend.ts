import { MIGRATIONS, SCHEMA_VERSION, migrateSnapshot } from '../backup/schema'
import type { Migration, Snapshot } from '../backup/schema'
import { ReplaceAllError } from './backend'
import type { DataBackend } from './backend'
import { fromCentavos, fromRow, toCentavos, toRow } from './centavos'
import type { Row } from './centavos'
import { getKv } from './db'
import type { OllieDb } from './db'
import { RECORD_FIELDS, emptySnapshot } from './snapshot'
import type { Change, DataSnapshot, RecordField } from './snapshot'

type WithId = { id: string }

async function readSnapshot(db: OllieDb): Promise<DataSnapshot> {
  const out = emptySnapshot() as unknown as Record<RecordField, unknown[]> & { monthlyIncome: number }
  for (const field of RECORD_FIELDS) {
    const rows = await db.recordTable(field).orderBy('_seq').toArray()
    out[field] = rows.map((row) => fromRow(field, row))
  }
  const income = await getKv<number>(db, 'monthlyIncome')
  out.monthlyIncome = typeof income === 'number' ? fromCentavos(income) : 0
  return out as unknown as DataSnapshot
}

/** Clears and refills every table; call inside a transaction over all of them. */
async function putSnapshot(db: OllieDb, snapshot: DataSnapshot): Promise<void> {
  for (const field of RECORD_FIELDS) {
    const table = db.recordTable(field)
    await table.clear()
    const records = snapshot[field] as object[]
    await table.bulkPut(records.map((r, i) => toRow(field, r, i)))
  }
  await db.kv.put({ key: 'monthlyIncome', value: toCentavos(snapshot.monthlyIncome) })
}

const allTables = (db: OllieDb) => [...RECORD_FIELDS.map((f) => db.recordTable(f)), db.kv]

/** The browser's database: each save touches only what changed, in one transaction. */
export function createDexieBackend(db: OllieDb): DataBackend {
  return {
    kind: 'indexeddb',

    readAll: () => db.transaction('r', allTables(db), () => readSnapshot(db)),

    async write(change: Change) {
      const fields = RECORD_FIELDS.filter((f) => change[f])
      const tables = [...fields.map((f) => db.recordTable(f)), ...(change.monthlyIncome ? [db.kv] : [])]
      if (tables.length === 0) return
      await db.transaction('rw', tables, async () => {
        for (const field of fields) {
          const { next, prev } = change[field] as { next: WithId[]; prev: WithId[] }
          const table = db.recordTable(field)
          const prevById = new Map(prev.map((r) => [r.id, r]))
          const nextIds = new Set(next.map((r) => r.id))
          const removed = prev.filter((r) => !nextIds.has(r.id)).map((r) => r.id)
          // Stores make new objects only for records they change, so identity says what changed.
          const changed = next.filter((r) => prevById.get(r.id) !== r)
          if (removed.length > 0) await table.bulkDelete(removed)
          if (changed.length === 0) continue
          const existing = await table.bulkGet(changed.map((r) => r.id))
          let maxSeq = (await table.orderBy('_seq').last())?._seq ?? -1
          const rows: Row[] = changed.map((r, i) => toRow(field, r, existing[i]?._seq ?? ++maxSeq))
          await table.bulkPut(rows)
        }
        if (change.monthlyIncome) await db.kv.put({ key: 'monthlyIncome', value: toCentavos(change.monthlyIncome.next) })
      })
    },

    async replaceAll(snapshot: DataSnapshot) {
      try {
        await db.transaction('rw', allTables(db), () => putSnapshot(db, snapshot))
      } catch (cause) {
        // A failed transaction changes nothing.
        throw new ReplaceAllError(true, { cause })
      }
    },
  }
}

/**
 * Brings database data up to the current data version through the same
 * MIGRATIONS chain backups use, in one transaction. Newer data is left alone.
 */
export async function upgradeDexieData(
  db: OllieDb,
  migrations: Record<number, Migration> = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): Promise<boolean> {
  return db.transaction('rw', allTables(db), async () => {
    const stored = await getKv<number>(db, 'schemaVersion')
    const from = typeof stored === 'number' ? stored : 0
    if (from >= target) return false
    const before = await readSnapshot(db)
    const after = migrateSnapshot(before as unknown as Snapshot, from, migrations, target)
    await putSnapshot(db, { ...emptySnapshot(), ...(after as Partial<DataSnapshot>) })
    await db.kv.put({ key: 'schemaVersion', value: target })
    return true
  })
}
