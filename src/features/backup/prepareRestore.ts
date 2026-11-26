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
import type { Snapshot } from './schema'
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

export function prepareRestore(json: string): PreparedRestore {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Snapshot).loans)) return { ok: false, reason: 'invalid' }

  // A file from a newer version could hold data this one would misread.
  const version = backupVersion(raw as Snapshot)
  if (version > SCHEMA_VERSION) return { ok: false, reason: 'newer' }
  const file = migrateSnapshot(raw as Snapshot, version)

  const tally = { skipped: 0 }
  const loans = readList(file.loans, loanSchema, tally)
  // Files from before payment history was kept get it rebuilt from the loans.
  const payments = Array.isArray(file.payments)
    ? readList(file.payments, paymentSchema, tally)
    : backfillPayments(loans, [])
  const income = file.monthlyIncome

  const data: RestoreData = {
    loans,
    payments,
    bills: readList(file.bills, billSchema, tally),
    billPayments: readList(file.billPayments, billPaymentSchema, tally),
    savingsGoals: readList(file.savingsGoals, savingsGoalSchema, tally),
    savingsTransactions: readList(file.savingsTransactions, savingsTransactionSchema, tally),
    monthlyIncome: typeof income === 'number' && Number.isFinite(income) && income >= 0 ? income : null,
    privateFolder: parseFolderBackup(file),
  }

  return {
    ok: true,
    data,
    counts: { loans: data.loans.length, bills: data.bills.length, savingsGoals: data.savingsGoals.length },
    skipped: tally.skipped,
  }
}
