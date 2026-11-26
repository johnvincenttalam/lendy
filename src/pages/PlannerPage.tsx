import { useSearchParams } from 'react-router-dom'
import { CalendarCheck } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import CalendarView from '../features/calendar/CalendarView'
import DeadlineRow from '../features/home/DeadlineRow'
import { groupAgenda } from '../features/agenda/agenda'
import { useDeadlines, useDeadlinesNow } from '../core/deadlines/DeadlinesContext'

type View = 'agenda' | 'calendar'

function Tabs({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const tab = (value: View, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === value}
      onClick={() => onChange(value)}
      className={`flex-1 py-2 rounded-xl text-[13px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-brand ${
        view === value ? 'bg-card text-primary shadow-sm' : 'text-muted hover:text-secondary'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div role="tablist" aria-label="Planner view" className="flex gap-1 p-1 rounded-2xl bg-subtle">
      {tab('agenda', 'Agenda')}
      {tab('calendar', 'Calendar')}
    </div>
  )
}

/** What's due across loans and bills (agenda), or the month calendar. */
export default function PlannerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const view: View = searchParams.get('view') === 'calendar' ? 'calendar' : 'agenda'
  const deadlines = useDeadlines(30)
  const now = useDeadlinesNow()

  // Switching view starts the calendar fresh rather than keeping a stale month.
  const setView = (v: View) => setSearchParams(v === 'calendar' ? { view: 'calendar' } : {}, { replace: true })
  const tabs = <Tabs view={view} onChange={setView} />

  if (view === 'calendar') return <CalendarView tabs={tabs} />

  const groups = groupAgenda(deadlines)
  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <PageHeader title="Planner" subtitle="What’s due across your loans and bills">{tabs}</PageHeader>
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 lg:pb-10 space-y-4">
        {groups.length === 0 ? (
          <EmptyState icon={CalendarCheck} mood="relaxed" title="Nothing due in the next 30 days" subtitle="Ollie will list loan and bill payments here as they come up." />
        ) : (
          groups.map((g) => (
            <section key={g.key} aria-labelledby={`agenda-${g.key}`} className="rounded-3xl bg-card p-4">
              <h2
                id={`agenda-${g.key}`}
                className={`px-1 mb-1 text-[15px] font-extrabold tracking-tight ${g.key === 'overdue' ? 'text-red-600 dark:text-red-400' : 'text-primary'}`}
              >
                {g.label}
              </h2>
              <ul>
                {g.items.map((d) => <li key={d.id}><DeadlineRow deadline={d} now={now} /></li>)}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
