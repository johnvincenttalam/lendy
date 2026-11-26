import { DEFAULT_COLOR } from '../loans/loanTypes'
import type { Loan } from '../loans/loanTypes'
import { STORAGE_FIELDS } from '../backup/schema'
import { ReplaceAllError } from './backend'
import type { DataBackend, KeyValueStorage } from './backend'
import type { Change, DataSnapshot, Field } from './snapshot'

const FIELDS = Object.keys(STORAGE_FIELDS) as Field[]

/** The raw text of each data key, as the browser's simple storage holds it. */
export function readLegacyRaw(storage: KeyValueStorage): Record<Field, string | null> {
  const out = {} as Record<Field, string | null>
  for (const field of FIELDS) out[field] = storage.getItem(STORAGE_FIELDS[field])
  return out
}

function readList<T>(raw: string | null): T[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

/**
 * The data as today's stores read it: lenient, so nothing the owner can see
 * now goes missing. Unreadable keys count as empty.
 */
export function readLegacySnapshot(storage: KeyValueStorage): DataSnapshot {
  const raw = readLegacyRaw(storage)
  return {
    loans: readList<Loan>(raw.loans).map((loan) => ({
      ...loan,
      color: loan.color || DEFAULT_COLOR,
      interestRate: loan.interestRate ?? 0,
      totalInterestPaid: loan.totalInterestPaid ?? 0,
    })),
    payments: readList(raw.payments),
    monthlyIncome: Number(raw.monthlyIncome) || 0,
    bills: readList(raw.bills),
    billPayments: readList(raw.billPayments),
    savingsGoals: readList(raw.savingsGoals),
    savingsTransactions: readList(raw.savingsTransactions),
  }
}

function encode(field: Field, value: unknown): string {
  return field === 'monthlyIncome' ? String(value) : JSON.stringify(value)
}

/** Today's storage: one JSON value per key in the browser's simple storage. */
export function createLocalStorageBackend(storage: KeyValueStorage): DataBackend {
  return {
    kind: 'localstorage',

    async readAll() {
      return readLegacySnapshot(storage)
    },

    async write(change: Change) {
      for (const field of FIELDS) {
        const c = change[field]
        if (c) storage.setItem(STORAGE_FIELDS[field], encode(field, c.next))
      }
    },

    async replaceAll(snapshot: DataSnapshot) {
      const before = readLegacyRaw(storage)
      try {
        for (const field of FIELDS) storage.setItem(STORAGE_FIELDS[field], encode(field, snapshot[field]))
      } catch (cause) {
        // Put every key back, carrying on past failures so as much as possible returns.
        let rolledBack = true
        for (const field of FIELDS) {
          try {
            const value = before[field]
            if (value === null) storage.removeItem(STORAGE_FIELDS[field])
            else storage.setItem(STORAGE_FIELDS[field], value)
          } catch {
            rolledBack = false
          }
        }
        throw new ReplaceAllError(rolledBack, { cause })
      }
    },
  }
}
