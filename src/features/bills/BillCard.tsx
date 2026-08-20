import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import type { Bill } from './billTypes'
import { DEFAULT_COLOR } from '../loans/loanTypes'
import { isBillOverdue, billDaysOverdue, paidForCycle, remainingForCycle, cycleProgress } from './billUtils'
import { useBillStore } from './billStore'
import CurrencyAmount from '../../components/CurrencyAmount'

type Props = { bill: Bill }

export default function BillCard({ bill }: Props) {
  const navigate = useNavigate()
  const color = bill.color || DEFAULT_COLOR
  const overdue = isBillOverdue(bill)
  const overdueDays = billDaysOverdue(bill)
  const dueDate = new Date(bill.nextDueDate)
  const billPayments = useBillStore((s) => s.billPayments)
  const paidThisCycle = paidForCycle(bill, billPayments)
  const remaining = remainingForCycle(bill, billPayments)
  const partiallyPaid = paidThisCycle > 0 && remaining > 0
  const progress = cycleProgress(bill, billPayments)

  return (
    <button
      onClick={() => navigate(`/bills/${bill.id}`)}
      className="w-full bg-card rounded-2xl p-4 border border-themed text-left transition-all duration-200 active:scale-[0.97] hover:bg-card-hover group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-[13px] flex items-center justify-center text-[14px] font-bold text-white shrink-0"
            style={{ backgroundColor: color }}
          >
            {bill.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-primary text-[15px] leading-tight tracking-tight">{bill.name}</h3>
            <span className="text-[10px] font-semibold text-muted bg-subtle px-1.5 py-[1px] rounded-md">{bill.category}</span>
          </div>
        </div>
        {overdue && (
          <span className="text-[11px] font-semibold bg-red-500/10 text-red-500 px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
            <AlertTriangle className="w-3 h-3" />
            {overdueDays}d overdue
          </span>
        )}
      </div>

      <div className="flex justify-between items-end">
        <p className="text-[20px] font-bold font-mono tracking-tight leading-none" style={{ color }}>
          <CurrencyAmount value={partiallyPaid ? remaining : bill.amount} />
        </p>
        <span className={`text-[12px] font-medium ${overdue ? 'text-red-500' : 'text-muted'}`}>
          {overdue ? 'Overdue' : `Due ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
        </span>
      </div>

      {partiallyPaid && (
        <div className="mt-2.5">
          <div className="h-1 rounded-full bg-subtle overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress * 100}%`, backgroundColor: color }}
            />
          </div>
          <p className="text-[11px] text-muted mt-1.5">
            <CurrencyAmount value={paidThisCycle} /> paid of <CurrencyAmount value={bill.amount} />
          </p>
        </div>
      )}
    </button>
  )
}
