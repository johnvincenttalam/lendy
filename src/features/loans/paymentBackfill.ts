import type { Loan, PaymentRecord } from './loanTypes'
import { monthlyInterestPortion, monthlyPrincipalPortion, paymentSchedule } from './loanUtils'

/**
 * Payment records for loans saved before the app kept them: a loan with
 * monthsPaid > 0 and no records gets one per paid month, dated on its
 * schedule. Loans that already have records are left alone.
 */
export function backfillPayments(loans: Loan[], existingPayments: PaymentRecord[]): PaymentRecord[] {
  const loanIdsWithRecords = new Set(existingPayments.map((p) => p.loanId))
  const newRecords: PaymentRecord[] = []

  for (const loan of loans) {
    if (loan.monthsPaid <= 0 || loanIdsWithRecords.has(loan.id)) continue

    const schedule = paymentSchedule(loan)
    const principal = monthlyPrincipalPortion(loan)
    const interest = monthlyInterestPortion(loan)

    for (let i = 0; i < loan.monthsPaid; i++) {
      const scheduledDate = schedule[i]?.date ?? new Date(loan.startDate)
      newRecords.push({
        id: crypto.randomUUID(),
        loanId: loan.id,
        amount: loan.monthlyPayment,
        principal: Math.round(principal * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        paidAt: scheduledDate.toISOString(),
        dueDate: scheduledDate.toISOString().split('T')[0],
        month: i + 1,
      })
    }
  }

  return [...existingPayments, ...newRecords]
}
