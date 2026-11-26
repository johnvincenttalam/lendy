/**
 * The one-time move from the browser's simple storage into its database:
 * read the old keys, check every record, write everything in one
 * transaction, read it back and compare, and only then call it done.
 * The old keys are never written, so they stay as a last-resort copy.
 */
import type { z } from 'zod'
import { loanSchema, paymentSchema } from '../loans/loanSchema'
import { billSchema, billPaymentSchema } from '../bills/billSchema'
import { savingsGoalSchema, savingsTransactionSchema } from '../savings/savingsSchema'
import { backfillPayments } from '../loans/paymentBackfill'
import type { Loan, PaymentRecord } from '../loans/loanTypes'
import { SCHEMA_VERSION } from '../backup/schema'
import type { KeyValueStorage } from './backend'
import { MONEY_FIELDS, hasSubCentavo, toCentavos, toRow } from './centavos'
import type { Row } from './centavos'
import { setKv } from './db'
import type { OllieDb } from './db'
import { fingerprintLegacy } from './fingerprint'
import { readLegacyRaw } from './localStorageBackend'
import { dexieSafetyStore, localSafetyStore } from './safetyCopyStore'
import { PARENT_LINKS, RECORD_FIELDS, emptySnapshot } from './snapshot'
import type { DataSnapshot, RecordField } from './snapshot'

export type QuarantineItem = { field: RecordField; id: string | null; name: string | null; reason: string; raw: unknown }
export type FieldCounts = { source: number; moved: number; quarantined: number; backfilled: number }
export type MoveReport = { at: string; counts: Record<RecordField, FieldCounts>; quarantined: number; rounded: number; fingerprint: string }
export type MovePlan = { snapshot: DataSnapshot; quarantine: QuarantineItem[]; counts: Record<RecordField, FieldCounts>; rounded: number }
export type MoveResult =
  | { ok: true; report: MoveReport }
  | { ok: false; outcome: 'blocked'; items: QuarantineItem[] }
  | { ok: false; outcome: 'failed'; reason: string }

const SCHEMAS: Record<RecordField, z.ZodType<{ id: string }>> = {
  loans: loanSchema,
  payments: paymentSchema,
  bills: billSchema,
  billPayments: billPaymentSchema,
  savingsGoals: savingsGoalSchema,
  savingsTransactions: savingsTransactionSchema,
}

type ChildField = keyof typeof PARENT_LINKS
const CHILD_FIELDS = Object.keys(PARENT_LINKS) as ChildField[]
const PARENT_NAMES = { loans: 'loan', bills: 'bill', savingsGoals: 'goal' } as const

const textOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null)

/** Checks the old data and works out exactly what the move would write. Changes nothing. */
export function planMove(storage: KeyValueStorage): MovePlan {
  const raw = readLegacyRaw(storage)
  const snapshot = emptySnapshot()
  const kept = snapshot as unknown as Record<RecordField, { id: string }[]>
  const quarantine: QuarantineItem[] = []
  const counts = {} as Record<RecordField, FieldCounts>

  for (const field of RECORD_FIELDS) {
    const c: FieldCounts = { source: 0, moved: 0, quarantined: 0, backfilled: 0 }
    counts[field] = c
    const text = raw[field]
    if (text === null) continue
    let list: unknown
    try {
      list = JSON.parse(text)
    } catch {
      list = undefined
    }
    if (!Array.isArray(list)) {
      c.source = 1
      quarantine.push({ field, id: null, name: null, reason: 'Couldn’t be read', raw: text })
      continue
    }
    c.source = list.length
    const seen = new Set<string>()
    for (const item of list) {
      const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
      const parsed = SCHEMAS[field].safeParse(item)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        const where = issue?.path.length ? `${issue.path.join('.')}: ` : ''
        quarantine.push({ field, id: textOrNull(obj.id), name: textOrNull(obj.name), reason: `${where}${issue?.message ?? 'Invalid'}`, raw: item })
      } else if (seen.has(parsed.data.id)) {
        quarantine.push({ field, id: parsed.data.id, name: textOrNull(obj.name), reason: 'Same id as another record', raw: item })
      } else {
        seen.add(parsed.data.id)
        kept[field].push(parsed.data)
      }
    }
  }

  // A payment, bill payment or transaction must point at a record that's moving too.
  for (const child of CHILD_FIELDS) {
    const link = PARENT_LINKS[child]
    const parentIds = new Set(kept[link.parent].map((p) => p.id))
    kept[child] = kept[child].filter((r) => {
      if (parentIds.has((r as Record<string, unknown>)[link.key] as string)) return true
      quarantine.push({ field: child, id: r.id, name: null, reason: `Its ${PARENT_NAMES[link.parent]} is missing`, raw: r })
      return false
    })
  }

  // Loans saved before payment history was kept get it rebuilt, as the loan store does today.
  const before = snapshot.payments.length
  snapshot.payments = backfillPayments(snapshot.loans as Loan[], snapshot.payments as PaymentRecord[])
  counts.payments.backfilled = snapshot.payments.length - before

  snapshot.monthlyIncome = Number(raw.monthlyIncome) || 0

  let rounded = hasSubCentavo(snapshot.monthlyIncome) ? 1 : 0
  for (const field of RECORD_FIELDS) {
    counts[field].moved = kept[field].length
    counts[field].quarantined = quarantine.filter((q) => q.field === field).length
    for (const record of kept[field]) {
      for (const key of MONEY_FIELDS[field]) {
        const v = (record as Record<string, unknown>)[key]
        if (typeof v === 'number' && hasSubCentavo(v)) rounded++
      }
    }
  }

  return { snapshot, quarantine, counts, rounded }
}

/** Reads back what was written and returns the first mismatch, or null. */
async function verify(db: OllieDb, plan: MovePlan): Promise<string | null> {
  const rowsByField = {} as Record<RecordField, Row[]>
  for (const field of RECORD_FIELDS) rowsByField[field] = await db.recordTable(field).toArray()

  for (const field of RECORD_FIELDS) {
    const rows = rowsByField[field]
    const c = plan.counts[field]
    const quarantined = await db.quarantine.where('field').equals(field).count()
    if (rows.length + quarantined !== c.source + c.backfilled) {
      return `${field}: ${rows.length} saved and ${quarantined} set aside, expected ${c.source + c.backfilled} in all`
    }
    const byId = new Map(rows.map((r) => [r.id, r]))
    const source = plan.snapshot[field] as unknown as Record<string, unknown>[]
    for (const key of MONEY_FIELDS[field]) {
      let want = 0
      let got = 0
      for (const record of source) {
        const v = record[key]
        if (typeof v !== 'number') continue
        const row = byId.get(record.id as string)
        if (!row) return `${field}: ${String(record.id)} is missing`
        if (row[key] !== toCentavos(v)) return `${field}: ${String(record.id)} ${key} doesn’t match`
        want += toCentavos(v)
        got += row[key] as number
      }
      if (want !== got) return `${field}: total ${key} doesn’t match`
    }
  }

  for (const child of CHILD_FIELDS) {
    const link = PARENT_LINKS[child]
    const parentIds = new Set(rowsByField[link.parent].map((r) => r.id))
    const orphan = rowsByField[child].find((r) => !parentIds.has(r[link.key] as string))
    if (orphan) return `${child}: ${orphan.id} lost its ${PARENT_NAMES[link.parent]}`
  }

  const income = (await db.kv.get('monthlyIncome'))?.value
  if (income !== toCentavos(plan.snapshot.monthlyIncome)) return 'monthlyIncome doesn’t match'
  return null
}

export async function runMove(
  storage: KeyValueStorage,
  db: OllieDb,
  opts: { now: Date; allowQuarantine?: boolean },
): Promise<MoveResult> {
  try {
    const plan = planMove(storage)
    if (plan.quarantine.length > 0 && !opts.allowQuarantine) return { ok: false, outcome: 'blocked', items: plan.quarantine }

    const tables = [...RECORD_FIELDS.map((f) => db.recordTable(f)), db.kv, db.quarantine]
    await db.transaction('rw', tables, async () => {
      // Cleared first: rows left from an earlier move may be records deleted since.
      for (const field of RECORD_FIELDS) {
        const table = db.recordTable(field)
        await table.clear()
        const records = plan.snapshot[field] as object[]
        await table.bulkPut(records.map((r, i) => toRow(field, r, i)))
      }
      await db.quarantine.clear()
      if (plan.quarantine.length > 0) await db.quarantine.bulkAdd(plan.quarantine.map((q) => ({ ...q })))
      await db.kv.put({ key: 'monthlyIncome', value: toCentavos(plan.snapshot.monthlyIncome) })
      await db.kv.put({ key: 'schemaVersion', value: SCHEMA_VERSION })
    })

    const mismatch = await verify(db, plan)
    if (mismatch) return { ok: false, outcome: 'failed', reason: mismatch }

    // A restore that can still be undone stays undoable after the move.
    const copy = await localSafetyStore(storage).read()
    if (copy) await dexieSafetyStore(db).write(copy)

    const report: MoveReport = {
      at: opts.now.toISOString(),
      counts: plan.counts,
      quarantined: plan.quarantine.length,
      rounded: plan.rounded,
      fingerprint: fingerprintLegacy(storage),
    }
    // Written last: the database counts as ready only once this is there.
    await setKv(db, 'migration', report)
    return { ok: true, report }
  } catch (err) {
    return { ok: false, outcome: 'failed', reason: err instanceof Error ? err.message : String(err) }
  }
}
