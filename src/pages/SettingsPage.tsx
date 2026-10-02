import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Upload, HardDrive, Eye, EyeOff, Sparkles, ChevronRight } from 'lucide-react'
import { useLoanStore } from '../features/loans/loanStore'
import { useIncomeStore } from '../features/finance/incomeStore'
import { useBillStore } from '../features/bills/billStore'
import { useSavingsStore } from '../features/savings/savingsStore'
import { useMoneyStore } from '../features/money/moneyStore'
import { hasExistingData, describeBackupImport } from '../utils/backupDescribe'
import { debtToIncomeRatio } from '../features/loans/loanUtils'
import { BRAND_GRADIENT } from '../constants/styles'
import PinSetup from '../features/lock/PinSetup'
import NotificationSettings from '../features/notifications/NotificationSettings'
import { showToast } from '../components/Toast'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import CurrencyAmount from '../components/CurrencyAmount'
import { useUnseenReleaseCount } from '../features/whatsNew/seenVersionStore'
import { exportAllData, importAllData, parseBackupCounts } from '../utils/backup'
import type { BackupCounts } from '../utils/backup'

type PendingImport = { json: string; counts: BackupCounts }

export default function SettingsPage() {
  const { loans, exportCSV } = useLoanStore()
  const { monthlyIncome, setMonthlyIncome } = useIncomeStore()
  const { bills } = useBillStore()
  const { goals } = useSavingsStore()
  const moneyEntryCount = useMoneyStore((s) => s.entries.length)
  const existing = { loans: loans.length, bills: bills.length, goals: goals.length, moneyEntries: moneyEntryCount }
  const navigate = useNavigate()
  const unseenReleases = useUnseenReleaseCount()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showIncome, setShowIncome] = useState(false)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)

  useBodyScrollLock(pendingImport !== null)

  const totalMonthly = loans.reduce((sum, l) => {
    if (l.archived || l.monthsPaid >= l.durationMonths) return sum
    return sum + l.monthlyPayment
  }, 0)

  function handleExportCSV() {
    const csv = exportCSV()
    downloadFile(csv, `lendy-export-${dateSuffix()}.csv`, 'text/csv')
    showToast('CSV exported')
  }

  async function handleExportBackup() {
    const json = exportAllData()
    const filename = `lendy-backup-${dateSuffix()}.json`
    const file = new File([json], filename, { type: 'application/json' })

    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Lendy backup' })
        showToast('Backup shared')
        return
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return
      }
    }

    downloadFile(json, filename, 'application/json')
    showToast('Backup saved')
  }

  function handleImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const json = reader.result as string
      const counts = parseBackupCounts(json)
      if (!counts) {
        showToast('Invalid backup file')
        return
      }
      setPendingImport({ json, counts })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function confirmImport() {
    if (!pendingImport) return
    const ok = importAllData(pendingImport.json)
    if (!ok) showToast('Failed to restore backup')
    setPendingImport(null)
  }

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <div style={{ background: BRAND_GRADIENT }}>
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-5">
          <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight">Settings</h1>
          <p className="text-[12px] text-white/55 font-medium">Manage your preferences</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-4">
        {/* Income */}
        <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider">
              Monthly Income (₱)
            </label>
            <button
              onClick={() => setShowIncome(!showIncome)}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-secondary transition-colors"
            >
              {showIncome ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showIncome ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="relative">
            <input
              type={showIncome ? 'number' : 'password'}
              value={monthlyIncome || ''}
              onChange={(e) => setMonthlyIncome(Number(e.target.value) || 0)}
              placeholder="Enter monthly income"
              className="input-field !py-2.5 text-[14px]"
            />
          </div>
          {monthlyIncome > 0 && totalMonthly > 0 && showIncome && (
            <p className="text-[11px] text-muted mt-1">
              {Math.round(debtToIncomeRatio(loans, monthlyIncome) * 100)}% of income goes to loans
              {' '}(<CurrencyAmount value={monthlyIncome - totalMonthly} /> remaining)
            </p>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
          <NotificationSettings />
        </div>

        {/* App Lock */}
        <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
          <PinSetup />
        </div>

        {/* Storage */}
        <StorageUsage />

        {/* What's New */}
        <button
          onClick={() => navigate('/whats-new')}
          className="w-full flex items-center gap-3 bg-card rounded-2xl border border-themed p-4 text-left transition-all duration-200 active:scale-[0.98] hover:bg-card-hover"
        >
          <div className="w-9 h-9 rounded-[11px] bg-brand/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-primary text-[14px] tracking-tight">What&rsquo;s New</p>
            <p className="text-[12px] text-muted">Recent updates to Lendy</p>
          </div>
          {unseenReleases > 0 && (
            <span
              aria-label={`${unseenReleases} unread ${unseenReleases === 1 ? 'update' : 'updates'}`}
              className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-brand text-on-brand text-[10px] font-bold flex items-center justify-center shrink-0"
            >
              {unseenReleases}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-muted shrink-0" />
        </button>

        {/* Data */}
        <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">Data</p>
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
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportBackup}
        className="hidden"
      />

      {pendingImport && (
        <div className="fixed inset-0 bg-overlay z-50 flex items-center justify-center p-5 animate-fade-in">
          <div className="bg-card rounded-2xl p-6 max-w-[320px] w-full border border-themed transition-colors animate-scale-in">
            <h3 className="font-bold text-primary text-[18px] tracking-tight mb-2">Restore backup?</h3>
            <p className="text-[13px] text-secondary mb-6">
              {describeBackupImport(pendingImport.counts, existing)}
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setPendingImport(null)}
                className="flex-1 py-3 rounded-xl bg-subtle text-secondary font-semibold text-[14px] hover:opacity-80 transition-opacity"
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                className="flex-1 py-3 rounded-xl font-semibold text-[14px] text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: hasExistingData(existing) ? '#EF4444' : '#6366F1' }}
              >
                {hasExistingData(existing) ? 'Replace' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
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

function calculateStorageUsage() {
  let total = 0
  for (const key in localStorage) {
    if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
      total += localStorage.getItem(key)?.length || 0
      total += key.length
    }
  }
  // Characters are stored as UTF-16 (2 bytes each)
  return total * 2
}

function StorageUsage() {
  const [storage] = useState(() => ({ used: calculateStorageUsage(), limit: 5 * 1024 * 1024 }))

  const usedKB = (storage.used / 1024).toFixed(2)
  const limitMB = (storage.limit / 1024 / 1024).toFixed(0)
  const percentage = Math.min((storage.used / storage.limit) * 100, 100)

  const getBarColor = () => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-brand'
  }

  return (
    <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <HardDrive className="w-4 h-4 text-muted" />
        <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Storage</p>
      </div>
      <div className="space-y-2">
        <div className="h-2 bg-subtle rounded-full overflow-hidden">
          <div
            className={`h-full ${getBarColor()} transition-all duration-300 rounded-full`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-muted">
          <span>{usedKB} KB used</span>
          <span>{limitMB} MB limit</span>
        </div>
        {percentage >= 80 && (
          <p className="text-[11px] text-yellow-600 dark:text-yellow-400">
            Storage is getting full. Consider exporting and clearing old data.
          </p>
        )}
      </div>
    </div>
  )
}
