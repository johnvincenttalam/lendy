import { useRef, useState } from 'react'
import OllieCharacter from '../ollie/OllieCharacter'
import { LOCALE } from '../../core/locale'

type Props = {
  /** When the data moved to the database; null hides the older-copy option. */
  movedAt: string | null
  /** Restores the picked file; resolves to an error message, or null on success. */
  onRestoreFile: (json: string) => Promise<string | null>
  /** Refills the database from the old copy; resolves to an error message, or null on success. */
  onUseOlderCopy: () => Promise<string | null>
}

function formatMoveDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Shown instead of an empty Ollie when the browser cleared the database. */
export default function RecoveryScreen({ movedAt, onRestoreFile, onUseOlderCopy }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const date = movedAt ? formatMoveDate(movedAt) : null

  async function run(action: () => Promise<string | null>) {
    setBusy(true)
    setMessage(null)
    const error = await action()
    if (error) {
      setMessage(error)
      setBusy(false)
    } else {
      window.location.reload()
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void run(async () => onRestoreFile(await file.text()))
  }

  const buttonClass = 'w-full py-3 rounded-2xl font-bold focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60'

  return (
    <main className="min-h-screen bg-page flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-card rounded-3xl border border-themed p-6">
        <div className="flex justify-center mb-3">
          <OllieCharacter mood="alert" still />
        </div>
        <h1 className="font-extrabold text-primary text-[20px] tracking-tight mb-2 text-center">Your data needs bringing back</h1>
        <p className="text-[14px] text-secondary mb-5 text-center">
          Ollie's data in this browser is missing. Your browser may have cleared it.
        </p>

        <div className="space-y-4">
          <div>
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={`${buttonClass} bg-brand text-on-brand hover:bg-brand-light`}>
              Restore from a backup file
            </button>
            <p className="text-[12px] text-muted mt-1.5">Pick a backup you saved. It replaces what's here.</p>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} aria-label="Backup file" />
          </div>

          {date && (
            <div>
              <button type="button" disabled={busy} onClick={() => void run(onUseOlderCopy)} className={`${buttonClass} bg-subtle text-primary hover:bg-card-hover`}>
                Use the older copy from {date}
              </button>
              <p className="text-[12px] text-muted mt-1.5">
                The copy Ollie kept when it moved your data. Anything added after {date} isn't in it.
              </p>
            </div>
          )}
        </div>

        {message && <p role="alert" className="text-[13px] text-red-600 dark:text-red-400 mt-4 text-center">{message}</p>}
      </div>
    </main>
  )
}
