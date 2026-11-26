/**
 * Step 1 of a restore (see restore.ts): parse, upgrade older versions and
 * validate every record, changing nothing. Kept apart from the writing so
 * the validation library loads only when someone picks a backup file.
 */
import type { z } from 'zod'
import { loanSchema, paymentSchema } from '../loans/loanSchema'
import { billSchema, billPaymentSchema } from '../bills/billSchema'
import { savingsGoalSchema, savingsTransactionSchema } from '../savings/savingsSchema'
import { backfillPayments } from '../loans/paymentBackfill'
import { parseFolderBackup } from '../privateFolder/privateFolderUtils'
import { SCHEMA_VERSION, backupVersion, migrateSnapshot } from './schema'
import { unwrapBackup } from './envelope'
import type { PreparedRestore, RestoreData } from './restore'

/** Valid records with unique ids, in file order; everything else adds to `skipped`. */
function readList<T extends { id: string }>(value: unknown, schema: z.ZodType<T>, tally: { skipped: number }): T[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of value) {
    const parsed = schema.safeParse(item)
    if (!parsed.success || seen.has(parsed.data.id)) {
      tally.skipped++
      continue
    }
    seen.add(parsed.data.id)
    out.push(parsed.data)
  }
  return out
}

/** Keeps only records whose parent (by `key`) is among `parents`; the rest add to `skipped`. */
function withParent<T, K extends keyof T>(records: T[], key: K, parents: { id: string }[], tally: { skipped: number }): T[] {
  const ids = new Set(parents.map((p) => p.id))
  const kept = records.filter((r) => ids.has(r[key] as unknown as string))
  tally.skipped += records.length - kept.length
  return kept
}

export function prepareRestore(json: string): PreparedRestore {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  // v2 files are unwrapped into the flat shape older files already have.
  const unwrapped = unwrapBackup(raw)
  if (!unwrapped.ok) return unwrapped

  // A file from a newer version could hold data this one would misread.
  const version = backupVersion(unwrapped.flat)
  if (version > SCHEMA_VERSION) return { ok: false, reason: 'newer' }
  const file = migrateSnapshot(unwrapped.flat, version)

  const tally = { skipped: 0 }
  const loans = readList(file.loans, loanSchema, tally)
  // Files from before payment history was kept get it rebuilt from the loans.
  const rebuiltPayments = !Array.isArray(file.payments)
  const payments = rebuiltPayments
    ? backfillPayments(loans, [])
    : readList(file.payments, paymentSchema, tally)
  const income = file.monthlyIncome

  const bills = readList(file.bills, billSchema, tally)
  const savingsGoals = readList(file.savingsGoals, savingsGoalSchema, tally)

  const data: RestoreData = {
    loans,
    // A payment or transaction whose loan, bill or goal was left out would be an orphan.
    payments: withParent(payments, 'loanId', loans, tally),
    bills,
    billPayments: withParent(readList(file.billPayments, billPaymentSchema, tally), 'billId', bills, tally),
    savingsGoals,
    savingsTransactions: withParent(readList(file.savingsTransactions, savingsTransactionSchema, tally), 'goalId', savingsGoals, tally),
    monthlyIncome: typeof income === 'number' && Number.isFinite(income) && income >= 0 ? income : null,
    privateFolder: parseFolderBackup(file),
  }

  return {
    ok: true,
    data,
    counts: { loans: data.loans.length, bills: data.bills.length, savingsGoals: data.savingsGoals.length },
    skipped: tally.skipped,
    info: unwrapped.info,
    rebuiltPayments,
  }
}
