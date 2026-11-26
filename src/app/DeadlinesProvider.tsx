import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useLoanStore } from '../features/loans/loanStore'
import { useBillStore } from '../features/bills/billStore'
import { collectDeadlines } from '../core/deadlines/deadlines'
import { DeadlinesContext, DEADLINE_HORIZON_DAYS } from '../core/deadlines/DeadlinesContext'
import { deadlineCollectors } from '../core/modules/registry'
import { useToday } from '../core/time/useToday'
import { MODULES } from './modules'

const COLLECTORS = deadlineCollectors(MODULES)

/** Works out what's due across every module once, for the whole app. */
export default function DeadlinesProvider({ children }: { children: ReactNode }) {
  const loans = useLoanStore((s) => s.loans)
  const bills = useBillStore((s) => s.bills)
  const billPayments = useBillStore((s) => s.billPayments)
  const now = useToday()
  const value = useMemo(
    () => ({ deadlines: collectDeadlines(COLLECTORS, { loans, bills, billPayments }, now, DEADLINE_HORIZON_DAYS), now }),
    [loans, bills, billPayments, now],
  )
  return <DeadlinesContext.Provider value={value}>{children}</DeadlinesContext.Provider>
}
