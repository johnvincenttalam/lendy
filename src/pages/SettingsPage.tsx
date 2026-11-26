import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Upload, Eye, EyeOff, Sparkles, ChevronRight, Undo2 } from 'lucide-react'
import { useLoanStore } from '../features/loans/loanStore'
import { useIncomeStore } from '../features/finance/incomeStore'
import { useBillStore } from '../features/bills/billStore'
import { useSavingsStore } from '../features/savings/savingsStore'
import { hasExistingData, describeBackupImport } from '../utils/backupDescribe'
import { debtToIncomeRatio, monthlyLoanPayments } from '../features/loans/loanUtils'
import PageHeader from '../components/PageHeader'
import ThemeSettings from '../features/theme/ThemeSettings'
import PinSetup from '../features/lock/PinSetup'
import PrivateFolderSettings from '../features/privateFolder/PrivateFolderSettings'
import NotificationSettings from '../features/notifications/NotificationSettings'
import { showToast } from '../components/toastEvents'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import CurrencyAmount from '../components/CurrencyAmount'
import { useUnseenReleaseCount } from '../features/whatsNew/seenVersionStore'
import { exportAllData, applyRestore, checkBackup, undoLastRestore } from '../utils/backup'
import { useLastRestoreStore } from '../features/backup/lastRestoreStore'
import { useLastBackupStore } from '../features/backup/lastBackupStore'
import { describeLastBackup, isBackupDue } from '../features/backup/backupStatus'
import type { RestoreCounts, RestoreData } from '../features/backup/restore'
import StorageCard from '../features/storage/StorageCard'
import { downloadFile, dateSuffix } from '../utils/download'

type PendingImport = { data: RestoreData; counts: RestoreCounts; skipped: number }

export default function SettingsPage() {
  const { loans, exportCSV } = useLoanStore()
  const { monthlyIncome, setMonthlyIncome } = useIncomeStore()
  const { bills } = useBillStore()
  const { goals } = useSavingsStore()
  const existing = { loans: loans.length, bills: bills.length, goals: goals.length }
  const navigate = useNavigate()
  const unseenReleases = useUnseenReleaseCount()
  const { lastBackupAt, markBackedUp } = useLastBackupStore()
  const hasData = hasExistingData(existing)
  const backupDue = hasData && isBackupDue(lastBackupAt, new Date())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showIncome, setShowIncome] = useState(false)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  // Set while the last restore can still be undone.
  const restoredAt = useLastRestoreStore((s) => s.restoredAt)
  const [confirmUndo, setConfirmUndo] = useState(false)

  useBodyScrollLock(pendingImport !== null || confirmUndo)

  const totalMonthly = monthlyLoanPayments(loans)

  function handleExportCSV() {
    const csv = exportCSV()
    downloadFile(csv, `ollie-export-${dateSuffix()}.csv`, 'text/csv')
    showToast('CSV exported')
  }

  async function handleExportBackup() {
    const json = exportAllData()
    const filename = `ollie-backup-${dateSuffix()}.json`
    const file = new File([json], filename, { type: 'application/json' })

    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Ollie backup' })
        markBackedUp()
        showToast('Backup shared')
        return
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return
      }
    }

    downloadFile(json, filename, 'application/json')
    markBackedUp()
    showToast('Backup saved')
  }

  function handleImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const json = reader.result as string
      let check: Awaited<ReturnType<typeof checkBackup>>
      try {
        check = await checkBackup(json)
      } catch {
        // The file reader's code couldn't be fetched (offline before it was cached).
        showToast('Couldn’t open the backup reader. Check your connection and try again.')
        return
      }
      if (!check.ok) {
        showToast(check.reason === 'newer'
          ? 'This backup is from a newer version of Ollie. Close and reopen the app to update, then try again.'
          : 'Invalid backup file')
        return
      }
      setPendingImport({ data: check.data, counts: check.counts, skipped: check.skipped })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function confirmImport() {
    if (!pendingImport) return
    void applyRestore(pendingImport.data)
    setPendingImport(null)
  }

  function handleUndoRestore() {
    void undoLastRestore()
    setConfirmUndo(false)
  }

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <PageHeader title="Settings" subtitle="Appearance, income, security and your data" />

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-4">
        {/* Appearance */}
        <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
          <ThemeSettings />
        </div>

        {/* Income */}
        <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-semibold text-muted">
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

        {/* Private folder */}
        <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
          <PrivateFolderSettings />
        </div>

        {/* Storage */}
        <StorageCard />

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
            <p className="text-[12px] text-muted">Recent updates to Ollie</p>
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
          <p className="text-[11px] font-semibold text-muted mb-3">Data</p>
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
          {hasData && (
            <p className={`text-[12px] mt-2.5 ${backupDue ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-muted'}`}>
              {describeLastBackup(lastBackupAt, new Date())}
              {backupDue && ' · Your data lives only on this device, so keep a copy somewhere safe.'}
            </p>
          )}
          {restoredAt && (
            <button
              onClick={() => setConfirmUndo(true)}
              className="mt-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-secondary hover:text-primary transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo last restore ({formatRestoreDate(restoredAt)})
            </button>
          )}
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
              {describeBackupImport(pendingImport.counts, existing, pendingImport.skipped)}
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
                className="flex-1 py-3 rounded-xl font-bold text-[14px] text-white hover:opacity-90 transition-opacity"
                style={hasExistingData(existing)
                  ? { backgroundColor: '#EF4444', color: '#FFFFFF' }
                  : { backgroundColor: 'var(--color-brand)', color: 'var(--color-on-brand)' }}
              >
                {hasExistingData(existing) ? 'Replace' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmUndo && restoredAt && (
        <div className="fixed inset-0 bg-overlay z-50 flex items-center justify-center p-5 animate-fade-in">
          <div role="alertdialog" aria-labelledby="undo-restore-title" className="bg-card rounded-2xl p-6 max-w-[320px] w-full border border-themed transition-colors animate-scale-in">
            <h3 id="undo-restore-title" className="font-bold text-primary text-[18px] tracking-tight mb-2">Undo the restore?</h3>
            <p className="text-[13px] text-secondary mb-6">
              This puts back the data you had before restoring on {formatRestoreDate(restoredAt)}. Anything added or changed since then will be lost.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirmUndo(false)}
                className="flex-1 py-3 rounded-xl bg-subtle text-secondary font-semibold text-[14px] hover:opacity-80 transition-opacity"
              >
                Cancel
              </button>
              <button
                onClick={handleUndoRestore}
                className="flex-1 py-3 rounded-xl font-bold text-[14px] hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}
              >
                Undo restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatRestoreDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
