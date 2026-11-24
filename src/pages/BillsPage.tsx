import { useMemo, useState } from 'react'
import { Receipt, AlertTriangle, Archive } from 'lucide-react'
import { useBillStore } from '../features/bills/billStore'
import { isBillOverdue, remainingForCycle } from '../features/bills/billUtils'
import BillCard from '../features/bills/BillCard'
import MonthlyBillsChart from '../features/bills/MonthlyBillsChart'
import EmptyState from '../components/EmptyState'
import CurrencyAmount from '../components/CurrencyAmount'
import PageHeader from '../components/PageHeader'

export default function BillsPage() {
  const { bills, billPayments } = useBillStore()
  const [showArchived, setShowArchived] = useState(false)

  const { activeBills, archivedBills } = useMemo(() => ({
    activeBills: bills.filter((b) => !b.archived),
    archivedBills: bills.filter((b) => b.archived),
  }), [bills])

  const totalMonthly = activeBills.reduce((sum, b) => sum + b.amount, 0)
  const overdueBills = useMemo(() => activeBills.filter(isBillOverdue), [activeBills])
  const overdueAmount = overdueBills.reduce((sum, b) => sum + remainingForCycle(b, billPayments), 0)

  const visible = showArchived ? archivedBills : activeBills
  const sorted = useMemo(
    () => [...visible].sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()),
    [visible],
  )

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <PageHeader
        title="Bills"
        subtitle={`${activeBills.length} active ${activeBills.length === 1 ? 'bill' : 'bills'}`}
      >
        {overdueBills.length > 0 && (
          <div className="rounded-2xl bg-card border border-themed p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-primary">
                {overdueBills.length} overdue {overdueBills.length === 1 ? 'bill' : 'bills'}
              </p>
              <p className="text-[11px] text-secondary">
                <CurrencyAmount value={overdueAmount} /> total due
              </p>
            </div>
          </div>
        )}

        <div className="rounded-2xl p-4 bg-card border border-themed">
          <span className="text-[11px] font-semibold text-muted">Monthly Bills</span>
          <p className="text-[32px] font-extrabold font-display tabular-nums text-primary tracking-tight mt-1">
            <CurrencyAmount value={totalMonthly} />
          </p>
        </div>
      </PageHeader>

      <div className="max-w-2xl mx-auto px-3 pt-3 pb-28">
        {/* Spending history is about the bills you still keep, so it stays out
            of the archived view rather than contradicting the list below it. */}
        {!showArchived && <MonthlyBillsChart bills={bills} billPayments={billPayments} />}

        {archivedBills.length > 0 && (
          <div className="flex mb-3">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${
                showArchived ? 'bg-brand text-on-brand' : 'bg-subtle text-secondary hover:opacity-80'
              }`}
            >
              <Archive className="w-3 h-3" />
              Archived ({archivedBills.length})
            </button>
          </div>
        )}

        <div className={sorted.length === 0 ? '' : 'space-y-3'}>
          {sorted.length === 0 ? (
            <EmptyState
              icon={Receipt}
              mood={showArchived ? undefined : 'relaxed'}
              title={showArchived ? 'No archived bills' : 'No bills yet'}
              subtitle={showArchived ? undefined : 'Add your first recurring bill to start budgeting'}
            >
              {!showArchived && (
                <p className="text-[13px] text-muted">Tap <span className="text-brand font-semibold">+</span> below to get started</p>
              )}
            </EmptyState>
          ) : (
            sorted.map((bill) => <BillCard key={bill.id} bill={bill} />)
          )}
        </div>
      </div>
    </div>
  )
}
