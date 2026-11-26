import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useStorageStatusStore } from './storageStatusStore'

/** Stays until the app reloads once a change couldn't be saved; what's on screen is kept. */
export default function SaveFailedBanner() {
  const saveFailed = useStorageStatusStore((s) => s.saveFailed)
  const navigate = useNavigate()
  if (!saveFailed) return null
  return (
    <div role="alert" className="sticky top-0 z-40 bg-red-600 text-white px-4 py-2.5">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
        <p className="flex-1 text-[13px] font-semibold">Couldn't save your last change. Make a backup now.</p>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-white/20 text-[12px] font-bold hover:bg-white/30 focus-visible:ring-2 focus-visible:ring-white"
        >
          Back up
        </button>
      </div>
    </div>
  )
}
