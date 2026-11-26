import { useState } from 'react'
import { Bell } from 'lucide-react'
import Sheet from '../components/Sheet'
import { useDeadlines, useDeadlinesNow } from '../core/deadlines/DeadlinesContext'
import DeadlineRow from '../features/home/DeadlineRow'

/**
 * Reminders: a bell whose badge counts what's overdue or due today, opening
 * the next 7 days of loans and bills. Derived, so there's nothing to mark read.
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const deadlines = useDeadlines(7)
  const now = useDeadlinesNow()
  const urgent = deadlines.filter((d) => d.status !== 'upcoming').length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={urgent > 0 ? `Reminders, ${urgent} due` : 'Reminders'}
        className="relative w-10 h-10 rounded-xl bg-card border border-themed flex items-center justify-center shrink-0 focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Bell className="w-[18px] h-[18px] text-primary" strokeWidth={2.5} />
        {urgent > 0 && (
          <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-extrabold flex items-center justify-center">
            {urgent > 9 ? '9+' : urgent}
          </span>
        )}
      </button>
      {open && (
        <Sheet title="Reminders" onClose={() => setOpen(false)}>
          {deadlines.length === 0 ? (
            <p className="text-[14px] text-muted py-6 text-center">Nothing due this week.</p>
          ) : (
            <ul>
              {deadlines.map((d) => (
                <li key={d.id}><DeadlineRow deadline={d} now={now} onOpen={() => setOpen(false)} /></li>
              ))}
            </ul>
          )}
        </Sheet>
      )}
    </>
  )
}
