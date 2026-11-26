import type { RecordField } from './snapshot'

/**
 * The database keeps money as whole centavos so sums never drift. The app
 * still works in pesos, so the conversion happens only here, at the edge.
 */
export const MONEY_FIELDS: Record<RecordField, readonly string[]> = {
  loans: ['totalAmount', 'monthlyPayment', 'totalPaid', 'totalInterestPaid'],
  payments: ['amount', 'principal', 'interest'],
  bills: ['amount'],
  billPayments: ['amount'],
  savingsGoals: ['targetAmount', 'currentAmount'],
  savingsTransactions: ['amount'],
}

export const toCentavos = (p: number): number => Math.round(p * 100)
export const fromCentavos = (c: number): number => c / 100

/** True for a peso value with more precision than a centavo (e.g. 1000.005). */
export function hasSubCentavo(p: number): boolean {
  return Math.abs(p * 100 - Math.round(p * 100)) > 1e-6
}

/** A stored record: money in centavos, plus its hidden position. */
export type Row = Record<string, unknown> & { id: string; _seq: number }

export function toRow(field: RecordField, record: object, seq: number): Row {
  const row: Record<string, unknown> = { ...record }
  for (const key of MONEY_FIELDS[field]) {
    const v = row[key]
    if (typeof v === 'number') row[key] = toCentavos(v)
  }
  row._seq = seq
  return row as Row
}

export function fromRow<T>(field: RecordField, row: Row): T {
  const { _seq: _ignored, ...rest } = row
  void _ignored
  const record: Record<string, unknown> = rest
  for (const key of MONEY_FIELDS[field]) {
    const v = record[key]
    if (typeof v === 'number') record[key] = fromCentavos(v)
  }
  return record as T
}
