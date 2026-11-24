import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Tags, Wallet } from 'lucide-react'
import { useMoneyStore } from '../features/money/moneyStore'
import MoneyEntryForm from '../features/money/MoneyEntryForm'
import CategoryManager from '../features/money/CategoryManager'
import ConfirmDialog from '../features/money/ConfirmDialog'
import { getCategoryIcon } from '../features/money/moneyIcons'
import {
  allCategories, entriesForMonth, expenseBreakdown, formatMonthLabel, groupByDay,
  localISODate, monthKeyOf, monthTotals, resolveCategory, shiftMonth,
} from '../features/money/moneyUtils'
import type { MoneyEntry } from '../features/money/moneyTypes'
import EmptyState from '../components/EmptyState'
import CurrencyAmount from '../components/CurrencyAmount'
import { formatDate } from '../utils/dateUtils'
import PageHeader, { HeaderIconButton } from '../components/PageHeader'
import ProgressBar from '../components/ProgressBar'

type Filter = 'all' | 'income' | 'expense'

export default function MoneyPage() {
  const { entries, customCategories, addEntry, updateEntry, deleteEntry } = useMoneyStore()
  const categories = useMemo(() => allCategories(customCategories), [customCategories])

  const [month, setMonth] = useState(() => monthKeyOf(localISODate()))
  const [filter, setFilter] = useState<Filter>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<MoneyEntry | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<MoneyEntry | null>(null)

  const monthEntries = useMemo(() => entriesForMonth(entries, month), [entries, month])
  const totals = useMemo(() => monthTotals(monthEntries), [monthEntries])
  const breakdown = useMemo(() => expenseBreakdown(monthEntries), [monthEntries])
  const groups = useMemo(
    () => groupByDay(filter === 'all' ? monthEntries : monthEntries.filter((e) => e.type === filter)),
    [monthEntries, filter],
  )

  // Entries pointing at a category this device doesn't have (a restored backup)
  // fold into "Other" in the breakdown too, not only in the list rows.
  const breakdownRows = useMemo(() => {
    const merged = new Map<string, { categoryId: string; total: number }>()
    for (const row of breakdown) {
      const id = resolveCategory(categories, { type: 'expense', categoryId: row.categoryId }).id
      const prev = merged.get(id)
      merged.set(id, { categoryId: id, total: (prev?.total ?? 0) + row.total })
    }
    const grand = [...merged.values()].reduce((s, r) => s + r.total, 0)
    return [...merged.values()]
      .sort((a, b) => b.total - a.total)
      .map((r) => ({ ...r, share: grand > 0 ? r.total / grand : 0 }))
  }, [breakdown, categories])

  const hasAnyEntries = entries.length > 0

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <PageHeader
        title="Money"
        subtitle="Where your money goes"
        action={
          <HeaderIconButton label="Manage categories" onClick={() => setShowCategories(true)}>
            <Tags className="w-4 h-4 text-primary" strokeWidth={2.5} />
          </HeaderIconButton>
        }
      >
        <div className="rounded-2xl p-4 bg-card border border-themed">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month" className="w-8 h-8 flex items-center justify-center hover:opacity-70">
              <ChevronLeft className="w-4 h-4 text-primary" />
            </button>
            <span className="text-[12px] font-semibold text-secondary">{formatMonthLabel(month)}</span>
            <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month" className="w-8 h-8 flex items-center justify-center hover:opacity-70">
              <ChevronRight className="w-4 h-4 text-primary" />
            </button>
          </div>
          <p className="text-center text-[11px] font-semibold text-muted">Net this month</p>
          <p className="text-center text-[32px] font-extrabold font-display tabular-nums text-primary tracking-tight">
            {totals.net < 0 && '−'}
            <CurrencyAmount value={Math.abs(totals.net)} />
          </p>
          <div className="flex justify-center gap-4 mt-1 text-[12px] font-medium">
            <span className="text-secondary">
              <span className="text-emerald-700 dark:text-emerald-600 dark:text-emerald-400"><CurrencyAmount value={totals.income} /></span> income
            </span>
            <span className="text-secondary">
              <span className="text-red-600 dark:text-red-400"><CurrencyAmount value={totals.expenses} /></span> spent
            </span>
          </div>
        </div>
      </PageHeader>

      <div className="max-w-2xl mx-auto px-3 pt-3 pb-28 space-y-3">
        {!hasAnyEntries ? (
          <EmptyState icon={Wallet} mood="thinking" title="No entries yet" subtitle="Add your first income or expense to see where your money goes.">
            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2.5 rounded-xl bg-brand text-on-brand font-semibold text-[14px] hover:opacity-90"
            >
              Add your first entry
            </button>
          </EmptyState>
        ) : (
          <>
            <section className="bg-card rounded-2xl border border-themed p-4">
              <h2 className="text-[11px] font-semibold text-muted mb-3">Where it went</h2>
              {breakdownRows.length === 0 ? (
                <p className="text-[13px] text-secondary">No expenses this month</p>
              ) : (
                <ul className="space-y-3">
                  {breakdownRows.map((row) => {
                    const cat = resolveCategory(categories, { type: 'expense', categoryId: row.categoryId })
                    const Icon = getCategoryIcon(cat.icon)
                    return (
                      <li key={row.categoryId}>
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="w-3.5 h-3.5 text-muted shrink-0" />
                          <span className="text-[13px] font-semibold text-primary flex-1 truncate">{cat.name}</span>
                          <span className="text-[13px] font-display tabular-nums text-primary"><CurrencyAmount value={row.total} /></span>
                          <span className="text-[11px] text-muted w-9 text-right">{Math.round(row.share * 100)}%</span>
                        </div>
                        <ProgressBar value={row.share * 100} label={`Share of spending on ${cat.name}`} />
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <div className="flex gap-1.5">
              {(['all', 'income', 'expense'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all ${
                    filter === f ? 'bg-brand text-on-brand' : 'bg-subtle text-secondary hover:opacity-80'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'income' ? 'Income' : 'Expenses'}
                </button>
              ))}
            </div>

            {groups.length === 0 ? (
              <p className="text-[13px] text-secondary text-center py-8">Nothing here for {formatMonthLabel(month)}.</p>
            ) : (
              groups.map((g) => (
                <section key={g.date}>
                  <h3 className="text-[11px] font-semibold text-muted mb-1.5 px-1">
                    {formatDate(`${g.date}T00:00:00`, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </h3>
                  <ul className="space-y-1.5">
                    {g.entries.map((e) => {
                      const cat = resolveCategory(categories, e)
                      const Icon = getCategoryIcon(cat.icon)
                      return (
                        <li key={e.id}>
                          <button
                            onClick={() => setEditing(e)}
                            className="w-full flex items-center gap-3 bg-card rounded-2xl border border-themed px-3 py-2.5 text-left active:scale-[0.99] transition-all hover:bg-card-hover"
                          >
                            <div className="w-9 h-9 rounded-[11px] bg-brand/10 flex items-center justify-center shrink-0">
                              <Icon className="w-4 h-4 text-brand" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-semibold text-primary tracking-tight truncate">{cat.name}</p>
                              {e.note && <p className="text-[12px] text-muted truncate">{e.note}</p>}
                            </div>
                            <span
                              className={`text-[14px] font-display tabular-nums font-semibold shrink-0 ${
                                e.type === 'income' ? 'text-emerald-500 dark:text-emerald-400' : 'text-primary'
                              }`}
                            >
                              {e.type === 'income' ? '+' : '−'}
                              <CurrencyAmount value={e.amount} />
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))
            )}
          </>
        )}
      </div>

      {showForm && (
        <MoneyEntryForm
          onClose={() => setShowForm(false)}
          onSubmit={(data) => {
            addEntry(data)
            // Jump to the month the entry landed in, or it appears to vanish.
            setMonth(monthKeyOf(data.date))
            setShowForm(false)
          }}
        />
      )}

      {editing && (
        <MoneyEntryForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(data) => {
            updateEntry(editing.id, data)
            setMonth(monthKeyOf(data.date))
            setEditing(null)
          }}
          onDelete={() => setPendingDelete(editing)}
        />
      )}

      {showCategories && <CategoryManager onClose={() => setShowCategories(false)} />}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete Entry"
          message="Delete this entry? This cannot be undone."
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteEntry(pendingDelete.id)
            setPendingDelete(null)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
