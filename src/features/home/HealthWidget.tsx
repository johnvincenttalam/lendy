import HealthScoreCard from '../finance/HealthScoreCard'
import { useFinancialOverview } from '../finance/useFinancialOverview'
import { useLoanStore } from '../loans/loanStore'
import { useBillStore } from '../bills/billStore'
import { useSavingsStore } from '../savings/savingsStore'
import { isTracked } from '../loans/loanUtils'

/** The financial health score. Hidden until there's a loan, bill or goal to score. */
export default function HealthWidget() {
  const { overview, health } = useFinancialOverview()
  const hasLoans = useLoanStore((s) => s.loans.some(isTracked))
  const hasBills = useBillStore((s) => s.bills.some((b) => !b.archived))
  const hasGoals = useSavingsStore((s) => s.goals.some((g) => !g.archived))
  if (!hasLoans && !hasBills && !hasGoals) return null
  return <HealthScoreCard overview={overview} health={health} />
}
