import { useState, useMemo, useRef } from 'react'
import {
  Plus, Receipt, Search, Download, X, ArrowUpDown,
  Upload, Settings, ChevronDown,
} from 'lucide-react'
import { useLoanStore, type SortOption } from '../features/loans/loanStore'
import {
  remainingBalance, isFullyPaid, progress, debtFreeDate,
  totalInterestAllLoans, debtToIncomeRatio, formatCurrency,
} from '../features/loans/loanUtils'
import SummaryHeader from '../components/SummaryHeader'
import LoanCard from '../features/loans/LoanCard'
import LoanForm from '../features/loans/LoanForm'
import { showToast } from '../components/Toast'

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
  const {
    loans, addLoan, exportCSV, exportBackup, importBackup,
    monthlyIncome, setMonthlyIncome, sortBy, setSortBy,
  } = useLoanStore()
  const [showForm, setShowForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showSort, setShowSort] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const totalDebt = loans.reduce((sum, l) => sum + remainingBalance(l), 0)
  const totalMonthly = loans.reduce((sum, l) => {
    if (l.monthsPaid >= l.durationMonths) return sum
    return sum + l.monthlyPayment
  }, 0)

  const filtered = useMemo(() => {
    let result = [...loans]

    if (filter === 'active') result = result.filter((l) => !isFullyPaid(l))
    if (filter === 'paid') result = result.filter((l) => isFullyPaid(l))

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((l) => l.name.toLowerCase().includes(q))
    }

    // Sort
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
  }, [loans, filter, search, sortBy])

  const activeCount = loans.filter((l) => !isFullyPaid(l)).length
  const paidCount = loans.filter((l) => isFullyPaid(l)).length

  function handleExportCSV() {
    const csv = exportCSV()
    downloadFile(csv, `lendy-export-${dateSuffix()}.csv`, 'text/csv')
    showToast('CSV exported')
  }

  function handleExportBackup() {
    const json = exportBackup()
    downloadFile(json, `lendy-backup-${dateSuffix()}.json`, 'application/json')
    showToast('Backup saved')
  }

  function handleImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      importBackup(reader.result as string)
      setShowSettings(false)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

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
        {loans.length > 0 && (
          <div className="space-y-3 mb-3">
            {/* Search + actions */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search loans..."
                  className="input-field !pl-10 !py-2.5 text-[14px]"
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
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="w-10 h-10 rounded-[14px] bg-subtle border border-themed flex items-center justify-center hover:opacity-70 transition-opacity shrink-0"
                title="Settings"
              >
                <Settings className="w-4 h-4 text-secondary" />
              </button>
            </div>

            {/* Settings panel */}
            {showSettings && (
              <div className="bg-card rounded-2xl border border-themed p-4 space-y-3 animate-scale-in">
                {/* Income input */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Monthly Income (₱)
                  </label>
                  <input
                    type="number"
                    value={monthlyIncome || ''}
                    onChange={(e) => setMonthlyIncome(Number(e.target.value) || 0)}
                    placeholder="Enter monthly income"
                    className="input-field !py-2.5 text-[14px]"
                  />
                  {monthlyIncome > 0 && totalMonthly > 0 && (
                    <p className="text-[11px] text-muted mt-1">
                      {Math.round(debtToIncomeRatio(loans, monthlyIncome) * 100)}% of income goes to loans
                      {' '}({formatCurrency(monthlyIncome - totalMonthly)} remaining)
                    </p>
                  )}
                </div>

                {/* Data actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-subtle text-secondary text-[13px] font-semibold hover:opacity-80 transition-opacity"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>
                  <button
                    onClick={handleExportBackup}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-subtle text-secondary text-[13px] font-semibold hover:opacity-80 transition-opacity"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Backup
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-subtle text-secondary text-[13px] font-semibold hover:opacity-80 transition-opacity"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Restore
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </div>
            )}

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
          </div>
        )}

        {/* Loan list */}
        <div className="space-y-3">
          {loans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-subtle border border-themed flex items-center justify-center mb-4">
                <Receipt className="w-7 h-7 text-muted" />
              </div>
              <p className="text-base font-semibold text-primary mb-1">No loans yet</p>
              <p className="text-[13px] text-muted text-center max-w-[200px]">
                Add your first loan to start tracking your payments
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Search className="w-8 h-8 text-muted mb-3" />
              <p className="text-[14px] font-medium text-secondary">No loans found</p>
              <p className="text-[13px] text-muted">Try a different search or filter</p>
            </div>
          ) : (
            filtered.map((loan) => <LoanCard key={loan.id} loan={loan} />)
          )}
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-7 right-5 z-20">
        <button
          onClick={() => setShowForm(true)}
          className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center hover:bg-brand-light active:scale-90 transition-all duration-200"
        >
          <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
        </button>
      </div>

      {showForm && (
        <LoanForm
          onSubmit={(data) => {
            addLoan(data)
            setShowForm(false)
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function dateSuffix() {
  return new Date().toISOString().split('T')[0]
}
