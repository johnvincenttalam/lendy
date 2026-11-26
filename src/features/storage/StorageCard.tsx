import { useEffect, useState } from 'react'
import { HardDrive } from 'lucide-react'
import ProgressBar from '../../components/ProgressBar'
import { showToast } from '../../components/toastEvents'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { LOCALE } from '../../core/locale'
import { downloadFile, dateSuffix } from '../../utils/download'
import { usePrivateFolderStore } from '../privateFolder/privateFolderStore'
import { getActiveStorage } from './activeStorage'
import { openOllieDb } from './db'
import { useStorageStatusStore } from './storageStatusStore'
import { formatBytes, legacyBackupJson, moveBack, moveToDatabase, quarantineText } from './storageActions'
import type { QuarantineItem } from './move'

const FIELD_LABELS: Record<QuarantineItem['field'], string> = {
  loans: 'Loan',
  payments: 'Loan payment',
  bills: 'Bill',
  billPayments: 'Bill payment',
  savingsGoals: 'Savings goal',
  savingsTransactions: 'Savings deposit',
}

const SIMPLE_LIMIT = 5 * 1024 * 1024

/** Characters in simple storage take 2 bytes each. */
function simpleStorageUsage(): number {
  let total = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) total += key.length + (localStorage.getItem(key)?.length ?? 0)
  }
  return total * 2
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' })
}

const textButton = 'text-[12px] font-semibold text-brand hover:opacity-80 focus-visible:ring-2 focus-visible:ring-brand rounded'
const fullButton = 'w-full py-2.5 rounded-xl bg-subtle text-secondary text-[13px] font-semibold hover:opacity-80 transition-opacity focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60'

/** Settings: where the data lives, whether the browser will keep it, and moving between storages. */
export default function StorageCard() {
  const { kind, movedAt, blocked, failedReason, oldCopyChanged } = useStorageStatusStore()
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [usage, setUsage] = useState<number | null>(null)
  const [confirmBack, setConfirmBack] = useState(false)
  const [busy, setBusy] = useState(false)
  useBodyScrollLock(confirmBack)

  const canUseDatabase = typeof indexedDB !== 'undefined'

  useEffect(() => {
    let live = true
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
    storage?.persisted?.().then((p) => { if (live) setPersisted(p) }).catch(() => {})
    storage?.estimate?.().then((e) => { if (live && typeof e.usage === 'number') setUsage(e.usage) }).catch(() => {})
    return () => { live = false }
  }, [])

  async function askToKeep() {
    try {
      await navigator.storage.persist()
      setPersisted(await navigator.storage.persisted())
    } catch {
      // Not critical: backups still protect the data.
    }
  }

  async function moveForward(allowQuarantine: boolean) {
    setBusy(true)
    const result = await moveToDatabase({ storage: localStorage, openDb: openOllieDb, now: new Date(), allowQuarantine })
    if (result.ok) {
      window.location.reload()
      return
    }
    setBusy(false)
    if (result.outcome === 'blocked') {
      useStorageStatusStore.getState().update({ blocked: result.items })
    } else {
      useStorageStatusStore.getState().update({ failedReason: result.reason })
      showToast('Ollie couldn’t move your data. Nothing was changed.')
    }
  }

  async function goBack() {
    const db = getActiveStorage().db
    if (!db) return
    setBusy(true)
    const result = await moveBack({ db, storage: localStorage })
    setConfirmBack(false)
    if (result === 'ok') {
      window.location.reload()
      return
    }
    setBusy(false)
    showToast('Your data is too big for simple storage, so it stays in the database.')
  }

  async function copyBlocked(items: QuarantineItem[]) {
    try {
      await navigator.clipboard.writeText(quarantineText(items))
      showToast('Copied')
    } catch {
      showToast('Couldn’t copy. Make a backup instead.')
    }
  }

  function saveOldCopy() {
    const { name, pinHash, recoveryHash } = usePrivateFolderStore.getState()
    const folder = name !== null ? { name, pinHash, recoveryHash } : undefined
    downloadFile(legacyBackupJson(localStorage, folder, new Date()), `ollie-old-copy-${dateSuffix()}.json`, 'application/json')
    showToast('Old copy saved')
  }

  const simpleUsed = kind === 'localstorage' ? simpleStorageUsage() : 0
  const simplePercent = Math.min((simpleUsed / SIMPLE_LIMIT) * 100, 100)

  return (
    <section aria-labelledby="storage-title" className="bg-card rounded-2xl border border-themed p-4 transition-colors space-y-3">
      <div className="flex items-center gap-2">
        <HardDrive className="w-4 h-4 text-muted" aria-hidden="true" />
        <h2 id="storage-title" className="text-[11px] font-semibold text-muted">Storage</h2>
      </div>

      <div className="space-y-1">
        <p className="text-[14px] font-semibold text-primary">
          {kind === 'indexeddb'
            ? `This browser's database${movedAt ? ` (since ${formatShortDate(movedAt)})` : ''}`
            : 'Simple browser storage'}
        </p>
        {persisted !== null && (
          <p className="text-[12px] text-muted">
            {persisted ? 'Your browser has promised to keep this data' : 'Your browser may clear this data if space runs low'}
          </p>
        )}
        {persisted === false && (
          <button type="button" onClick={() => void askToKeep()} className={textButton}>Ask to keep it</button>
        )}
        {usage !== null && <p className="text-[12px] text-muted">Using {formatBytes(usage)}</p>}
      </div>

      {kind === 'localstorage' && (
        <div className="space-y-1.5">
          <ProgressBar value={simplePercent} label="Simple storage used" color={simplePercent >= 90 ? '#EF4444' : simplePercent >= 70 ? '#EAB308' : 'var(--color-brand)'} />
          <p className="text-[11px] text-muted">{formatBytes(simpleUsed)} of simple storage’s 5 MB</p>
        </div>
      )}

      <p className="text-[12px] text-secondary">Your data lives only on this device. It isn't synced anywhere, so keep a backup.</p>

      {blocked && blocked.length > 0 && (
        <div className="rounded-xl bg-amber-500/10 p-3 space-y-2">
          <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">
            {blocked.length} {blocked.length === 1 ? 'record needs' : 'records need'} a look before Ollie can move your data
          </p>
          <ul className="text-[12px] text-secondary space-y-0.5">
            {blocked.map((item, i) => (
              <li key={i}>{item.name ?? item.id ?? 'Unnamed'} · {FIELD_LABELS[item.field]} · {item.reason}</li>
            ))}
          </ul>
          <p className="text-[11px] text-muted">Moving anyway keeps them aside, and they stay in the old copy too.</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void moveForward(true)} className={fullButton}>Move anyway</button>
            <button type="button" onClick={() => void copyBlocked(blocked)} className={fullButton}>Copy them as text</button>
          </div>
        </div>
      )}

      {failedReason && !blocked && (
        <div className="rounded-xl bg-subtle p-3 space-y-2">
          <p className="text-[12px] text-secondary">Ollie couldn't move your data yet: {failedReason}</p>
          <button type="button" disabled={busy} onClick={() => void moveForward(false)} className={fullButton}>Try again</button>
        </div>
      )}

      {oldCopyChanged && (
        <div className="rounded-xl bg-subtle p-3 space-y-2">
          <p className="text-[12px] text-secondary">An older Ollie window changed the old copy after the move. Those changes aren't shown here.</p>
          <button type="button" onClick={saveOldCopy} className={fullButton}>Save the old copy as a backup file</button>
        </div>
      )}

      {kind === 'indexeddb' && (
        <button type="button" disabled={busy} onClick={() => setConfirmBack(true)} className={fullButton}>Move back to simple storage</button>
      )}
      {kind === 'localstorage' && canUseDatabase && !blocked && !failedReason && (
        <button type="button" disabled={busy} onClick={() => void moveForward(false)} className={fullButton}>Move to the database</button>
      )}

      {confirmBack && (
        <div className="fixed inset-0 bg-overlay z-50 flex items-center justify-center p-5 animate-fade-in">
          <div role="alertdialog" aria-labelledby="move-back-title" className="bg-card rounded-2xl p-6 max-w-[320px] w-full border border-themed transition-colors animate-scale-in">
            <h3 id="move-back-title" className="font-bold text-primary text-[18px] tracking-tight mb-2">Move back to simple storage?</h3>
            <p className="text-[13px] text-secondary mb-6">
              Ollie will copy everything you have now into the browser's simple storage and use that from now on. Nothing is deleted, and you can move to the database again later.
            </p>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setConfirmBack(false)} className="flex-1 py-3 rounded-xl bg-subtle text-secondary font-semibold text-[14px] hover:opacity-80 transition-opacity">
                Cancel
              </button>
              <button type="button" disabled={busy} onClick={() => void goBack()} className="flex-1 py-3 rounded-xl bg-brand text-on-brand font-bold text-[14px] hover:opacity-90 transition-opacity disabled:opacity-60">
                Move back
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
