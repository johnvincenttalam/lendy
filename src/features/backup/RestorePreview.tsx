import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Sheet from '../../components/Sheet'
import { usePrivateFolderStore } from '../privateFolder/privateFolderStore'
import { readStoresSnapshot } from '../../utils/storeSnapshot'
import { applyRestore } from '../../utils/backup'
import type { CheckedBackup } from '../../utils/backup'
import { hasExistingData } from '../../utils/backupDescribe'
import { planMerge, planReplace } from './planMerge'
import type { Area } from './planMerge'
import { checksumWarning, differentLine, fileLine, heldBackLine, incomeLine, mergeToast, removesLine, setAsideLine, skippedLine } from './previewText'

type Mode = 'merge' | 'replace'

const AREA_ROWS: { area: Area; label: string }[] = [
  { area: 'loans', label: 'Loans' },
  { area: 'bills', label: 'Bills' },
  { area: 'savings', label: 'Savings' },
]

function Switch({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: string }) {
  return (
    <label className="flex items-start gap-2.5 text-[13px] text-secondary cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--color-brand)]" />
      <span>{children}</span>
    </label>
  )
}

function Note({ children, warn = false }: { children: string; warn?: boolean }) {
  return (
    <p className={`text-[12px] flex gap-1.5 ${warn ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-muted'}`}>
      {warn && <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />}
      <span>{children}</span>
    </p>
  )
}

/** What a backup file would do, before anything changes: merge (the default) or replace. */
export default function RestorePreview({ checked, onClose }: { checked: CheckedBackup; onClose: () => void }) {
  // Read once when the preview opens; the plan recomputes from it as choices change.
  const [device] = useState(() => readStoresSnapshot())
  const folderName = usePrivateFolderStore((s) => s.name)
  const folderPin = usePrivateFolderStore((s) => s.pinHash)
  const folderRecovery = usePrivateFolderStore((s) => s.recoveryHash)

  const hasData = hasExistingData({ loans: device.loans.length, bills: device.bills.length, goals: device.savingsGoals.length })
  const [mode, setMode] = useState<Mode>('merge')
  const [useFile, setUseFile] = useState(false)
  const [addDoubles, setAddDoubles] = useState(false)
  const [busy, setBusy] = useState(false)

  const plan = useMemo(() => {
    const folder = folderName !== null ? { name: folderName, pinHash: folderPin, recoveryHash: folderRecovery } : null
    return planMerge({ snapshot: device, folder }, checked.data, { useFileForDifferent: useFile, addPossibleDuplicates: addDoubles, rebuiltPayments: checked.rebuiltPayments })
  }, [device, checked, useFile, addDoubles, folderName, folderPin, folderRecovery])
  const removes = useMemo(() => planReplace(device, checked.data).removes, [device, checked])

  const effectiveMode: Mode = hasData ? mode : 'replace'
  const merging = effectiveMode === 'merge'
  const nothingNew = merging && !plan.changes
  const confirmLabel = !hasData ? 'Restore' : merging ? 'Merge' : 'Replace'
  const removeText = removesLine(removes)
  const checksum = checksumWarning(checked.checksum)
  const income = merging ? incomeLine(plan.income) : null
  const rows = AREA_ROWS.filter(({ area }) => {
    const c = plan.counts[area]
    return c.added + c.alreadyHere + c.different + c.heldBack > 0
  })

  async function confirm() {
    setBusy(true)
    if (merging) await applyRestore(plan.next, 'merge', mergeToast(plan.counts))
    else await applyRestore(checked.data, 'replace')
    onClose()
  }

  const footer = (
    <div className="flex gap-2.5">
      {nothingNew ? (
        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-subtle text-secondary font-semibold text-[14px] hover:opacity-80 transition-opacity">
          Close
        </button>
      ) : (
        <>
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-subtle text-secondary font-semibold text-[14px] hover:opacity-80 transition-opacity">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            className={`flex-1 py-3 rounded-xl font-bold text-[14px] hover:opacity-90 transition-opacity disabled:opacity-60 ${effectiveMode === 'replace' && hasData ? 'bg-red-500 text-white' : 'bg-brand text-on-brand'}`}
          >
            {confirmLabel}
          </button>
        </>
      )}
    </div>
  )

  return (
    <Sheet title="Restore backup" onClose={onClose} footer={footer}>
      <div className="space-y-1">
        <p className="text-[13px] text-secondary">{fileLine(checked.info)}</p>
        {checksum && <Note warn>{checksum}</Note>}
      </div>

      {rows.length > 0 && (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-muted text-[11px]">
              <th className="text-left font-semibold py-1" scope="col"><span className="sr-only">Area</span></th>
              <th className="text-right font-semibold py-1" scope="col">New</th>
              {hasData && <th className="text-right font-semibold py-1" scope="col">Already here</th>}
              {hasData && <th className="text-right font-semibold py-1" scope="col">Different</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ area, label }) => {
              const c = plan.counts[area]
              return (
                <tr key={area} className="border-t border-divider">
                  <th scope="row" className="text-left font-semibold text-primary py-1.5">{label}</th>
                  <td className="text-right tabular-nums">{c.added + c.heldBack}</td>
                  {hasData && <td className="text-right tabular-nums">{c.alreadyHere}</td>}
                  {hasData && <td className="text-right tabular-nums">{c.different}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {income && <p className="text-[13px] text-secondary">{income}</p>}

      {merging && plan.different.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold text-muted">{useFile ? 'Different, using the file\'s version:' : 'Different, keeping this phone\'s version:'}</p>
          <ul className="text-[12px] text-secondary space-y-1 list-disc pl-4">
            {plan.different.map((d) => <li key={`${d.area}-${d.id}`}>{differentLine(d, useFile)}</li>)}
          </ul>
          <Switch checked={useFile} onChange={setUseFile}>Use the file's version for records that differ</Switch>
        </div>
      )}

      {merging && plan.heldBack.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold text-muted">Possible double entries, held back:</p>
          <ul className="text-[12px] text-secondary space-y-1 list-disc pl-4">
            {plan.heldBack.map((h) => <li key={`${h.area}-${h.id}`}>{heldBackLine(h)}</li>)}
          </ul>
          <Switch checked={addDoubles} onChange={setAddDoubles}>Add them anyway</Switch>
        </div>
      )}

      {hasData && (
        <fieldset className="space-y-2">
          <legend className="sr-only">How to restore</legend>
          <label className="flex items-start gap-2.5 text-[13px] text-primary cursor-pointer">
            <input type="radio" name="restore-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} className="mt-0.5 accent-[var(--color-brand)]" />
            <span>Merge: add what's missing and keep this phone's version of the rest</span>
          </label>
          <label className="flex items-start gap-2.5 text-[13px] text-primary cursor-pointer">
            <input type="radio" name="restore-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} className="mt-0.5 accent-[var(--color-brand)]" />
            <span>Replace: make this phone match the file{removeText ? ` (${removeText})` : ''}</span>
          </label>
        </fieldset>
      )}

      <div className="space-y-1.5">
        {nothingNew && <p className="text-[13px] font-semibold text-primary">Nothing new in this file.</p>}
        {checked.skipped > 0 && <Note>{skippedLine(checked.skipped)}</Note>}
        {checked.info.setAside > 0 && <Note>{setAsideLine(checked.info.setAside)}</Note>}
        {checked.info.unknownSections && <Note>Some parts of this file are for a newer Ollie and were left out.</Note>}
        {merging && plan.folderWarning && <Note warn>Private loans from this file will be in your private folder, which has no PIN on this phone.</Note>}
        {!nothingNew && <Note>You can undo this from Settings for 7 days.</Note>}
      </div>
    </Sheet>
  )
}
