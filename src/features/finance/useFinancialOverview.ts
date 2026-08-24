import { useMemo } from 'react'
import { useLoanStore } from '../loans/loanStore'
import { useBillStore } from '../bills/billStore'
import { useSavingsStore } from '../savings/savingsStore'
import { useIncomeStore } from './incomeStore'
import { buildOverview, buildHealthScore } from './financeUtils'
import type { FinancialOverview, HealthScore } from './financeTypes'

export function useFinancialOverview(): { overview: FinancialOverview; health: HealthScore } {
  const { loans, payments } = useLoanStore()
  const { bills, billPayments } = useBillStore()
  const { goals } = useSavingsStore()
  const { monthlyIncome } = useIncomeStore()

  return useMemo(() => {
    const overview = buildOverview({ loans, bills, goals, monthlyIncome })
    const health = buildHealthScore(overview, loans, payments, bills, billPayments)
    return { overview, health }
  }, [loans, payments, bills, billPayments, goals, monthlyIncome])
}
