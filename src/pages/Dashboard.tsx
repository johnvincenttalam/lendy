import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Receipt, Search, X, ArrowUpDown, ChevronDown, BarChart3, PieChart,
} from 'lucide-react'
import { useLoanStore, type SortOption } from '../features/loans/loanStore'
import {
  remainingBalance, isFullyPaid, progress, debtFreeDate,
  totalInterestAllLoans, debtToIncomeRatio,
} from '../features/loans/loanUtils'
import SummaryHeader from '../components/SummaryHeader'
import DebtChart from '../components/DebtChart'
import LoanCard from '../features/loans/LoanCard'

type Filter = 'all' | 'active' | 'paid'

const SORT_LABELS: Record<SortOption, string> = {
  'newest': 'Newest',
  'oldest': 'Oldest',
  'balance-high': 'Balance (high)',
  'balance-low': 'Balance (low)',
  'progress': 'Progress',
  'payment': 'Payment',
}

export default function Dashboard() {
  const { loans, sortBy, setSortBy, monthlyIncome } = useLoanStore()
  const [showSort, setShowSort] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [showChart, setShowChart] = useState(true)
  const navigate = useNavigate()

  const totalDebt = loans.reduce((sum, l) => sum + remainingBalance(l), 0)
  const totalMonthly = loans.reduce((sum, l) => {
    if (l.monthsPaid >= l.durationMonths) return sum
    return sum + l.monthlyPayment
  }, 0)

  const tags = useMemo(() => {
    const set = new Set<string>()
    loans.forEach((l) => { if (l.tag) set.add(l.tag) })
    return Array.from(set).sort()
  }, [loans])

  const filtered = useMemo(() => {
    let result = [...loans]

    if (filter === 'active') result = result.filter((l) => !isFullyPaid(l))
    if (filter === 'paid') result = result.filter((l) => isFullyPaid(l))

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

  const activeCount = loans.filter((l) => !isFullyPaid(l)).length
  const paidCount = loans.filter((l) => isFullyPaid(l)).length

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <SummaryHeader
        totalDebt={totalDebt}
        totalMonthly={totalMonthly}
        loanCount={activeCount}
        totalInterest={totalInterestAllLoans(loans)}
        debtFreeDate={debtFreeDate(loans)}
        debtToIncome={debtToIncomeRatio(loans, monthlyIncome)}
        hasIncome={monthlyIncome > 0}
      />

      <div className="max-w-2xl mx-auto px-3 pt-3 pb-28">
        {activeCount > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setShowChart(!showChart)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-secondary transition-colors uppercase tracking-wider"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                {showChart ? 'Hide Chart' : 'Show Chart'}
              </button>
              <button
                onClick={() => navigate('/analytics')}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-brand hover:opacity-70 transition-opacity uppercase tracking-wider"
              >
                <PieChart className="w-3.5 h-3.5" />
                Analytics
              </button>
            </div>
            {showChart && <DebtChart loans={loans} />}
          </div>
        )}
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
                className="input-field !pl-10 !py-0 !h-10 text-[14px]"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-subtle flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-muted" />
                </button>
              )}
            </div>

            {/* Filters + Sort */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {([
                  ['all', `All (${loans.length})`],
                  ['active', `Active (${activeCount})`],
                  ['paid', `Paid (${paidCount})`],
                ] as [Filter, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all ${
                      filter === key
                        ? 'bg-brand text-white'
                        : 'bg-subtle text-secondary hover:opacity-80'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

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
        <div className="space-y-3">
          {loans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-[72px] h-[72px] rounded-[22px] bg-card border border-themed flex items-center justify-center mb-5">
                <Receipt className="w-8 h-8 text-muted" />
              </div>
              <p className="text-[17px] font-bold text-primary mb-1 tracking-tight">No loans yet</p>
              <p className="text-[13px] text-muted text-center max-w-[240px] mb-6 leading-relaxed">
                Add your first loan to start tracking your payments
              </p>
              <p className="text-[13px] text-muted">Tap <span className="text-brand font-semibold">+</span> below to get started</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-card border border-themed flex items-center justify-center mb-3">
                <Search className="w-6 h-6 text-muted" />
              </div>
              <p className="text-[14px] font-semibold text-secondary">No loans found</p>
              <p className="text-[13px] text-muted">Try a different search or filter</p>
            </div>
          ) : (
            filtered.map((loan) => <LoanCard key={loan.id} loan={loan} />)
          )}
        </div>
      </div>

    </div>
  )
}
