import type { Loan } from '../loans/loanTypes'
import { isFullyPaid } from '../loans/loanUtils'

export type StrategyResult = {
  totalMonths: number
  totalInterest: number
  totalPaid: number
  payoffOrder: Array<{ loanName: string; paidOffMonth: number }>
}

type SimLoan = {
  name: string
  remainingPrincipal: number
  remainingInterest: number
  monthlyPrincipal: number
  monthlyInterest: number
  monthlyPayment: number
}

function buildSimLoans(loans: Loan[]): SimLoan[] {
  return loans.filter((l) => !isFullyPaid(l)).map((loan) => {
    const totalInterest = loan.totalAmount * (loan.interestRate / 100) * loan.durationMonths
    const monthlyInterest = loan.durationMonths > 0 ? totalInterest / loan.durationMonths : 0
    const monthlyPrincipal = loan.durationMonths > 0 ? loan.totalAmount / loan.durationMonths : 0
    const paidPrincipal = monthlyPrincipal * loan.monthsPaid
    const paidInterest = monthlyInterest * loan.monthsPaid
    return {
      name: loan.name,
      remainingPrincipal: Math.max(0, loan.totalAmount - paidPrincipal),
      remainingInterest: Math.max(0, totalInterest - paidInterest),
      monthlyPrincipal,
      monthlyInterest,
      monthlyPayment: loan.monthlyPayment,
    }
  })
}

export function simulateStrategy(
  loans: Loan[],
  strategy: 'current' | 'snowball' | 'avalanche',
  extraPayment: number,
): StrategyResult {
  const simLoans = buildSimLoans(loans)
  if (simLoans.length === 0) return { totalMonths: 0, totalInterest: 0, totalPaid: 0, payoffOrder: [] }

  // For current: just project existing schedules, no redistribution
  if (strategy === 'current') {
    return simulateCurrent(simLoans)
  }

  // Sort for strategy
  const sorted = [...simLoans]
  if (strategy === 'snowball') {
    sorted.sort((a, b) => a.remainingPrincipal - b.remainingPrincipal)
  } else {
    // Avalanche: highest interest cost first
    sorted.sort((a, b) => b.monthlyInterest - a.monthlyInterest)
  }

  return simulateWithExtra(sorted, extraPayment)
}

function simulateCurrent(simLoans: SimLoan[]): StrategyResult {
  let totalInterest = 0
  let totalPaid = 0
  let maxMonths = 0
  const payoffOrder: StrategyResult['payoffOrder'] = []

  for (const loan of simLoans) {
    if (loan.monthlyPayment <= 0) continue
    const totalRemaining = loan.remainingPrincipal + loan.remainingInterest
    const months = Math.ceil(totalRemaining / loan.monthlyPayment)
    totalInterest += loan.remainingInterest
    totalPaid += totalRemaining
    if (months > maxMonths) maxMonths = months
    payoffOrder.push({ loanName: loan.name, paidOffMonth: months })
  }

  payoffOrder.sort((a, b) => a.paidOffMonth - b.paidOffMonth)
  return { totalMonths: maxMonths, totalInterest, totalPaid, payoffOrder }
}

function simulateWithExtra(simLoans: SimLoan[], extraPayment: number): StrategyResult {
  // Clone state
  const state = simLoans.map((l) => ({
    ...l,
    remPrincipal: l.remainingPrincipal,
    remInterest: l.remainingInterest,
    active: l.remainingPrincipal + l.remainingInterest > 0,
  }))

  let month = 0
  let totalInterest = 0
  let totalPaid = 0
  const payoffOrder: StrategyResult['payoffOrder'] = []

  while (state.some((s) => s.active) && month < 600) {
    month++
    let freedPayment = extraPayment

    // First pass: pay minimums and charge interest
    for (const loan of state) {
      if (!loan.active) continue

      const remaining = loan.remPrincipal + loan.remInterest
      if (remaining <= 0) {
        loan.active = false
        continue
      }

      // Monthly interest charge (flat — fixed amount)
      const interest = Math.min(loan.monthlyInterest, loan.remInterest)
      loan.remInterest -= interest
      totalInterest += interest
      totalPaid += interest

      // Monthly principal
      const principal = Math.min(loan.monthlyPrincipal, loan.remPrincipal)
      loan.remPrincipal -= principal
      totalPaid += principal

      if (loan.remPrincipal + loan.remInterest <= 0.01) {
        loan.active = false
        freedPayment += loan.monthlyPayment
        payoffOrder.push({ loanName: loan.name, paidOffMonth: month })
      }
    }

    // Second pass: apply extra to target loan (first active in sorted order)
    let extra = freedPayment
    for (const loan of state) {
      if (!loan.active || extra <= 0) continue
      const remaining = loan.remPrincipal + loan.remInterest
      const applied = Math.min(extra, remaining)

      // Apply extra to principal first
      const toPrincipal = Math.min(applied, loan.remPrincipal)
      loan.remPrincipal -= toPrincipal
      const toInterest = applied - toPrincipal
      loan.remInterest -= toInterest

      totalPaid += applied
      extra -= applied

      if (loan.remPrincipal + loan.remInterest <= 0.01) {
        loan.active = false
        freedPayment += loan.monthlyPayment
        payoffOrder.push({ loanName: loan.name, paidOffMonth: month })
      }
      break // Only apply extra to the first (target) active loan
    }
  }

  return { totalMonths: month, totalInterest: Math.round(totalInterest * 100) / 100, totalPaid: Math.round(totalPaid * 100) / 100, payoffOrder }
}
