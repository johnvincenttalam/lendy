import type { Loan } from '../loans/loanTypes'
import type { Bill } from '../bills/billTypes'
import { endDate, isFullyPaid, isTracked, monthlyLoanPayments, monthsLeft, nextDueDate, suggestedMonthlyPayment } from '../loans/loanUtils'
import { HIGH_DTI, localISODate } from '../ollie/ollieUtils'
import { startOfDay } from '../../utils/dateUtils'
import { addMonthsClamped } from '../../core/time/months'

/**
 * The planner works with the app's flat-interest model (as most Philippine
 * lenders charge): a loan's interest is fixed when it starts, so these
 * figures never assume paying early saves interest.
 */

/** Above this share of income the new total still fits, but only just. */
export const TIGHT_SHARE = 0.35

const round2 = (n: number) => Math.round(n * 100) / 100

/** Regular loans still being paid: what the comfortable limit is measured against. */
function activeLoans(loans: Loan[]): Loan[] {
  return loans.filter((l) => isTracked(l) && !isFullyPaid(l))
}

export function currentMonthlyPayments(loans: Loan[]): number {
  return monthlyLoanPayments(loans)
}

/** The loan's last scheduled payment date (YYYY-MM-DD), one month before endDate. */
export function lastPaymentDate(loan: Loan): string {
  return addMonthsClamped(new Date(loan.startDate), loan.durationMonths - 1).toISOString().split('T')[0]
}

export type Finish = {
  /** Last payment (YYYY-MM-DD). */
  lastPayment: string
  /** First month without the payment (YYYY-MM-DD). */
  from: string
  /** True when the loan is behind, so the dates assume it's caught up from today, one payment a month. */
  estimated: boolean
}

/**
 * When the loan will really be done. On schedule, that's its own schedule.
 * Behind, the schedule's dates have slipped (or already passed), so assume
 * the overdue payment is made today and one a month after that.
 */
export function projectedFinish(loan: Loan, now: Date): Finish {
  const next = nextDueDate(loan)
  const today = startOfDay(now)
  if (!next || startOfDay(next) >= today) return { lastPayment: lastPaymentDate(loan), from: endDate(loan), estimated: false }
  const last = addMonthsClamped(today, monthsLeft(loan) - 1)
  return { lastPayment: localISODate(last), from: localISODate(addMonthsClamped(today, monthsLeft(loan))), estimated: true }
}

export type PaymentStep = Finish & {
  loans: string[]
  /** Monthly payments that stop. */
  freed: number
  /** Monthly loan payments from `from` on. */
  monthlyAfter: number
}

/** When monthly loan payments drop, as each regular loan finishes, earliest first. */
export function paymentSteps(loans: Loan[], now: Date): PaymentStep[] {
  const byFrom = new Map<string, Array<{ loan: Loan; finish: Finish }>>()
  for (const loan of activeLoans(loans)) {
    const finish = projectedFinish(loan, now)
    byFrom.set(finish.from, [...(byFrom.get(finish.from) ?? []), { loan, finish }])
  }
  let monthly = currentMonthlyPayments(loans)
  return [...byFrom.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([from, finishing]) => {
      const freed = round2(finishing.reduce((sum, f) => sum + f.loan.monthlyPayment, 0))
      monthly = round2(Math.max(0, monthly - freed))
      return {
        from,
        lastPayment: finishing.map((f) => f.finish.lastPayment).sort().at(-1)!,
        estimated: finishing.some((f) => f.finish.estimated),
        loans: finishing.map((f) => f.loan.name),
        freed,
        monthlyAfter: monthly,
      }
    })
}

/** Monthly payment for a flat-interest cash loan, to the centavo. */
export function cashLoanMonthly(amount: number, monthlyRate: number, months: number): number {
  return round2(suggestedMonthlyPayment(amount, monthlyRate, months))
}

export type NewLoan = {
  monthly: number
  months: number
  /** Known for a cash loan (amount + rate); unknown for an installment entered by its monthly. */
  amount?: number
  monthlyRate?: number
}

export type Verdict = 'comfortable' | 'tight' | 'over' | 'no-income'

export type NewLoanCheck = {
  monthly: number
  months: number
  totalCost: number
  /** Null when only the monthly is known. */
  totalInterest: number | null
  currentMonthly: number
  newMonthly: number
  /** 40% of income; null when no income is set. */
  limit: number | null
  /** Room under the limit with the new loan; negative means over by that much. */
  roomAfter: number | null
  /** Whole-percent shares of income, before and with the new loan. */
  shareBefore: number | null
  shareAfter: number | null
  billsMonthly: number
  /** Income minus all loan payments (with the new one) and bills. */
  leftAfterAll: number | null
  verdict: Verdict
  /** When over: the first point at which current loans have finished enough for it to fit. */
  fitsFrom: PaymentStep | null
  /** Over even with every current loan finished: the new payment alone is above the limit. */
  neverFits: boolean
}

export function checkNewLoan(loans: Loan[], bills: Bill[], monthlyIncome: number, loan: NewLoan, now: Date): NewLoanCheck {
  const monthly = round2(loan.monthly)
  const knownAmount = loan.amount !== undefined && loan.monthlyRate !== undefined
  const totalCost = knownAmount
    ? round2(loan.amount! * (1 + (loan.monthlyRate! / 100) * loan.months))
    : round2(monthly * loan.months)
  const currentMonthly = currentMonthlyPayments(loans)
  const newMonthly = round2(currentMonthly + monthly)
  const billsMonthly = round2(bills.filter((b) => !b.archived).reduce((sum, b) => sum + b.amount, 0))

  const base = {
    monthly,
    months: loan.months,
    totalCost,
    totalInterest: knownAmount ? round2(totalCost - loan.amount!) : null,
    currentMonthly,
    newMonthly,
    billsMonthly,
  }

  if (monthlyIncome <= 0) {
    return {
      ...base, limit: null, roomAfter: null, shareBefore: null, shareAfter: null, leftAfterAll: null,
      verdict: 'no-income', fitsFrom: null, neverFits: false,
    }
  }

  const limit = round2(monthlyIncome * HIGH_DTI)
  const over = newMonthly > limit
  const verdict: Verdict = over ? 'over' : newMonthly / monthlyIncome > TIGHT_SHARE ? 'tight' : 'comfortable'
  return {
    ...base,
    limit,
    roomAfter: round2(limit - newMonthly),
    shareBefore: Math.round((currentMonthly / monthlyIncome) * 100),
    shareAfter: Math.round((newMonthly / monthlyIncome) * 100),
    leftAfterAll: round2(monthlyIncome - newMonthly - billsMonthly),
    verdict,
    fitsFrom: over ? paymentSteps(loans, now).find((s) => s.monthlyAfter + monthly <= limit) ?? null : null,
    neverFits: over && monthly > limit,
  }
}
