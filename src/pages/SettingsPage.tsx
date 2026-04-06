import { useRef, useState, useEffect } from 'react'
import { Download, Upload, HardDrive, Eye, EyeOff } from 'lucide-react'
import { useLoanStore } from '../features/loans/loanStore'
import { debtToIncomeRatio, formatCurrency } from '../features/loans/loanUtils'
import { BRAND_GRADIENT } from '../constants/styles'
import PinSetup from '../features/lock/PinSetup'
import NotificationSettings from '../features/notifications/NotificationSettings'
import { showToast } from '../components/Toast'

export default function SettingsPage() {
  const {
    loans, monthlyIncome, setMonthlyIncome,
    exportCSV, exportBackup, importBackup,
  } = useLoanStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showIncome, setShowIncome] = useState(false)

  const totalMonthly = loans.reduce((sum, l) => {
    if (l.monthsPaid >= l.durationMonths) return sum
    return sum + l.monthlyPayment
  }, 0)

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
    }
    reader.readAsText(file)
    e.target.value = ''
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
              {' '}({formatCurrency(monthlyIncome - totalMonthly)} remaining)
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

function StorageUsage() {
  const [storage, setStorage] = useState({ used: 0, limit: 5 * 1024 * 1024 })

  useEffect(() => {
    const calculateUsage = () => {
      let total = 0
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += localStorage.getItem(key)?.length || 0
          total += key.length
        }
      }
      // Characters are stored as UTF-16 (2 bytes each)
      return total * 2
    }
    setStorage({ used: calculateUsage(), limit: 5 * 1024 * 1024 })
  }, [])

  const usedKB = (storage.used / 1024).toFixed(2)
  const limitMB = (storage.limit / 1024 / 1024).toFixed(0)
  const percentage = Math.min((storage.used / storage.limit) * 100, 100)

  const getBarColor = () => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-[#E8541E]'
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
