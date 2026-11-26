import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import CurrencyAmount from '../../components/CurrencyAmount'
import type { Deadline } from '../../core/deadlines/deadlines'
import { describeDue } from '../ollie/ollieMessages'

/** One thing that's due, as a tappable row: colour dot, name, when, amount. */
export default function DeadlineRow({ deadline, now, onOpen }: { deadline: Deadline; now: Date; onOpen?: () => void }) {
  const navigate = useNavigate()
  const late = deadline.status === 'overdue'
  return (
    <button
      type="button"
      onClick={() => { onOpen?.(); navigate(deadline.href) }}
      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-subtle focus-visible:bg-subtle transition-colors text-left"
    >
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: deadline.color }} aria-hidden="true" />
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold text-primary truncate">{deadline.title}</span>
        <span className={`block text-[12px] ${late ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted'}`}>
          {describeDue(deadline, now)}
        </span>
      </span>
      <span className="text-[14px] font-bold font-display tabular-nums text-primary shrink-0">
        <CurrencyAmount value={deadline.amount} />
      </span>
      <ChevronRight className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
    </button>
  )
}
