import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useDeadlines, useDeadlinesNow } from '../../core/deadlines/DeadlinesContext'
import DeadlineRow from './DeadlineRow'

/** Loans and bills overdue or due in the next 7 days. Hidden when there are none. */
export default function DueSoonWidget() {
  const deadlines = useDeadlines(7)
  const now = useDeadlinesNow()
  const navigate = useNavigate()
  if (deadlines.length === 0) return null
  return (
    <section aria-labelledby="due-soon-title" className="rounded-3xl bg-card p-4">
      <div className="flex items-center justify-between px-1 mb-1">
        <h2 id="due-soon-title" className="text-[17px] font-extrabold text-primary tracking-tight">Due soon</h2>
        <button
          type="button"
          onClick={() => navigate('/planner')}
          className="flex items-center gap-0.5 text-[13px] font-bold text-brand hover:opacity-80 transition-opacity"
        >
          See all in Planner <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <ul>
        {deadlines.map((d) => <li key={d.id}><DeadlineRow deadline={d} now={now} /></li>)}
      </ul>
    </section>
  )
}
