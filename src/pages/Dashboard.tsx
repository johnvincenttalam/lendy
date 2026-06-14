import { useState, useMemo } from 'react'
import {
  Receipt, Search, X, ArrowUpDown, ChevronDown, Archive, LayoutGrid, List,
} from 'lucide-react'
import { useLoanStore, type SortOption } from '../features/loans/loanStore'
import {
  remainingBalance, isFullyPaid, progress, debtFreeDate,
  totalInterestAllLoans, debtToIncomeRatio, getOverdueLoans, totalOverdueAmount,
} from '../features/loans/loanUtils'
import SummaryHeader from '../components/SummaryHeader'
import EmptyState from '../components/EmptyState'
import LoanCard from '../features/loans/LoanCard'

type Filter = 'all' | 'active' | 'paid' | 'archived'

const SORT_LABELS: Record<SortOption, string> = {
  'newest': 'Newest',
  'oldest': 'Oldest',
  'balance-high': 'Balance (high)',
  'balance-low': 'Balance (low)',
  'progress': 'Progress',
  'payment': 'Payment',
}

export default function Dashboard() {
  const { loans, sortBy, setSortBy, monthlyIncome, viewMode, setViewMode } = useLoanStore()
  const [showSort, setShowSort] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  // Memoized derived state
  const { activeLoans, archivedLoans } = useMemo(() => ({
    activeLoans: loans.filter((l) => !l.archived),
    archivedLoans: loans.filter((l) => l.archived),
  }), [loans])

  const { totalDebt, totalMonthly, overdueLoans, overdueAmount } = useMemo(() => ({
    totalDebt: activeLoans.reduce((sum, l) => sum + remainingBalance(l), 0),
    totalMonthly: activeLoans.reduce((sum, l) => {
      if (l.monthsPaid >= l.durationMonths) return sum
      return sum + l.monthlyPayment
    }, 0),
    overdueLoans: getOverdueLoans(activeLoans),
    overdueAmount: totalOverdueAmount(activeLoans),
  }), [activeLoans])

  const tags = useMemo(() => {
    const set = new Set<string>()
    loans.forEach((l) => { if (l.tag) set.add(l.tag) })
    return Array.from(set).sort()
  }, [loans])

  const filtered = useMemo(() => {
    let result = [...loans]

    // Handle archived filter separately
    if (filter === 'archived') {
      result = result.filter((l) => l.archived)
    } else {
      // For all other filters, exclude archived loans
      result = result.filter((l) => !l.archived)
      if (filter === 'active') result = result.filter((l) => !isFullyPaid(l))
      if (filter === 'paid') result = result.filter((l) => isFullyPaid(l))
    }

    if (tagFilter) result = result.filter((l) => l.tag === tagFilter)

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((l) => l.name.toLowerCase().includes(q))
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'balance-high': return remainingBalance(b) - remainingBalance(a)
        case 'balance-low': return remainingBalance(a) - remainingBalance(b)
        case 'progress': return progress(b) - progress(a)
        case 'payment': return b.monthlyPayment - a.monthlyPayment
        default: return 0
      }
    })

    return result
  }, [loans, filter, tagFilter, search, sortBy])

  const { activeCount, paidCount, archivedCount } = useMemo(() => ({
    activeCount: activeLoans.filter((l) => !isFullyPaid(l)).length,
    paidCount: activeLoans.filter((l) => isFullyPaid(l)).length,
    archivedCount: archivedLoans.length,
  }), [activeLoans, archivedLoans])

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <SummaryHeader
        totalDebt={totalDebt}
        totalMonthly={totalMonthly}
        loanCount={activeCount}
        totalInterest={totalInterestAllLoans(activeLoans)}
        debtFreeDate={debtFreeDate(activeLoans)}
        debtToIncome={debtToIncomeRatio(activeLoans, monthlyIncome)}
        hasIncome={monthlyIncome > 0}
        overdueCount={overdueLoans.length}
        overdueAmount={overdueAmount}
      />

      <div className="max-w-2xl mx-auto px-3 pt-3 pb-28">
        {loans.length > 0 && (
          <div className="space-y-3 mb-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search loans..."
                className="input-field input-sm !pl-10"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-subtle flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-muted" />
                </button>
              )}
            </div>

            {/* Filters + Sort */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex gap-1.5 overflow-x-auto flex-1 min-w-0">
                {([
                  ['all', `All (${activeLoans.length})`],
                  ['active', `Active (${activeCount})`],
                  ['paid', `Paid (${paidCount})`],
                ] as [Filter, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`flex-1 text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all whitespace-nowrap text-center ${
                      filter === key
                        ? 'bg-brand text-white'
                        : 'bg-subtle text-secondary hover:opacity-80'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {archivedCount > 0 && (
                  <button
                    onClick={() => setFilter(filter === 'archived' ? 'all' : 'archived')}
                    className={`flex-shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center justify-center gap-1 ${
                      filter === 'archived'
                        ? 'bg-brand text-white'
                        : 'bg-subtle text-secondary hover:opacity-80'
                    }`}
                  >
                    <Archive className="w-3 h-3" />
                    {archivedCount}
                  </button>
                )}
              </div>

              {/* Sort (left) + View toggle (right) */}
              <div className="flex items-center justify-between gap-2 w-full sm:w-auto sm:flex-shrink-0">
              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSort(!showSort)}
                  className="flex items-center gap-1 text-[12px] font-semibold text-secondary bg-subtle px-2.5 py-1.5 rounded-full hover:opacity-80 transition-opacity"
                >
                  <ArrowUpDown className="w-3 h-3" />
                  {SORT_LABELS[sortBy]}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showSort && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowSort(false)} />
                    <div className="absolute right-0 top-9 bg-card border border-themed rounded-xl z-40 py-1 min-w-[150px] animate-scale-in">
                      {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                        <button
                          key={key}
                          onClick={() => {
                            setSortBy(key)
                            setShowSort(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-[13px] hover:bg-subtle transition-colors ${
                            sortBy === key ? 'text-brand font-semibold' : 'text-secondary'
                          }`}
                        >
                          {SORT_LABELS[key]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* View toggle */}
              <div className="flex items-center gap-0.5 bg-subtle rounded-full p-0.5">
                {([
                  ['list', List],
                  ['grid', LayoutGrid],
                ] as const).map(([mode, Icon]) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    aria-label={`${mode} view`}
                    aria-pressed={viewMode === mode}
                    className={`p-1.5 rounded-full transition-all ${
                      viewMode === mode
                        ? 'bg-card text-primary shadow-sm'
                        : 'text-muted hover:text-secondary'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
              </div>
            </div>

            {/* Tag filter */}
            {tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {tags.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTagFilter(tagFilter === t ? null : t)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all ${
                      tagFilter === t
                        ? 'bg-brand text-white'
                        : 'bg-subtle text-muted hover:text-secondary'
                    }`}
                  >
                    {t}
                  </button>
                ))}
                {tagFilter && (
                  <button
                    onClick={() => setTagFilter(null)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full text-muted hover:text-secondary transition-all"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Loan list */}
        <div className={loans.length === 0 || filtered.length === 0
          ? ''
          : viewMode === 'grid'
            ? 'grid grid-cols-2 gap-3 items-stretch'
            : 'space-y-3'}>
          {loans.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No loans yet"
              subtitle="Add your first loan to start tracking your payments"
            >
              <p className="text-[13px] text-muted">Tap <span className="text-brand font-semibold">+</span> below to get started</p>
            </EmptyState>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No loans found"
              subtitle="Try a different search or filter"
            />
          ) : (
            filtered.map((loan) => <LoanCard key={loan.id} loan={loan} view={viewMode} />)
          )}
        </div>
      </div>

    </div>
  )
}
