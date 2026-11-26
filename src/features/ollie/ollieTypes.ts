import type { Loan, PaymentRecord } from '../loans/loanTypes'
import type { Deadline } from '../../core/deadlines/deadlines'

/** One expression per artwork file in public/assets/ollie/. */
export type OllieMood = 'happy' | 'thinking' | 'upcoming' | 'alert' | 'celebrating' | 'relaxed'

/** A loan's next unpaid payment, resolved against today's date. */
export type DuePayment = {
  loan: Loan
  /** Local-midnight due date of the oldest unpaid instalment. */
  dueDate: Date
  /** Scheduled amount owed — sums every missed instalment when overdue. */
  amount: number
  /** Calendar days from today; negative when overdue, 0 when due today. */
  daysUntil: number
  /** How many scheduled instalments `amount` covers (more than 1 only when behind). */
  installments: number
}

export type OllieInsight =
  | { type: 'finish-line'; loan: Loan; paymentsLeft: number; remaining: number }
  | { type: 'debt-free-soon'; date: Date }
  | { type: 'milestone'; percent: number }
  | { type: 'high-dti'; percent: number }
  /** No backup yet (daysSince null), or the last one is getting old. */
  | { type: 'backup-due'; daysSince: number | null }

/**
 * What Ollie should talk about right now. `key` identifies the specific
 * message instance, so a dismissal only hides that one and a new situation
 * (a new due date, a new payment, a new day) brings Ollie back.
 */
export type OllieSituation =
  | { kind: 'overdue'; key: string; payments: Deadline[]; total: number }
  | { kind: 'due-today'; key: string; payments: Deadline[]; total: number }
  | { kind: 'upcoming'; key: string; tier: 'soon' | 'week'; payments: Deadline[]; total: number; windowDays: number }
  | { kind: 'celebrating'; key: string; payment: PaymentRecord; loan: Loan; fullyPaid: boolean; remaining: number; paymentsLeft: number }
  | { kind: 'insight'; key: string; insightKey: string; insight: OllieInsight }
  | { kind: 'greeting'; key: string; hasLoans: boolean }
  | { kind: 'relaxed'; key: string; next: Deadline | null; allPaidOff: boolean }

export type OllieSituationKind = OllieSituation['kind']

export type OllieInput = {
  loans: Loan[]
  payments: PaymentRecord[]
  now: Date
  /** The user's notification reminder window (days); Ollie looks at least a week ahead. */
  reminderDays: number
  monthlyIncome: number
  /** Payment ids that have already had their celebration. */
  celebratedIds: ReadonlySet<string>
  /** Insight key -> local date (YYYY-MM-DD) it was first shown. */
  seenInsights: Readonly<Record<string, string>>
  /** Whether this is the first dashboard visit of the day. */
  greetingEligible: boolean
  /** ISO time of the last backup (null: never). Left out, Ollie doesn't bring up backups. */
  lastBackupAt?: string | null
  /** Loans and bills that are due, from collectDeadlines (overdue plus at least the next year). */
  deadlines: Deadline[]
}
