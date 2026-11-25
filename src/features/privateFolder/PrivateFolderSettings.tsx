import { useState } from 'react'
import { FolderLock, Lock } from 'lucide-react'
import PinPad from '../lock/PinPad'
import { showToast } from '../../components/toastEvents'
import { usePrivateFolderStore, selectIsSetUp, selectHasPin } from './privateFolderStore'
import { DEFAULT_FOLDER_LABEL, MAX_FOLDER_NAME, folderLabel } from './privateFolderUtils'
import PrivateFolderSetup, { ChoosePin, FolderBadge, FolderScreen } from './PrivateFolderSetup'

// current-pin: check before changing it; off-pin: check before turning it off;
// new-pin: choose one (after a change, or to turn the PIN back on).
type Flow = null | 'setup' | 'current-pin' | 'off-pin' | 'new-pin'

/** Settings → Private folder: set it up, rename it, turn its PIN on or off, change it. */
export default function PrivateFolderSettings() {
  const { name, rename, unlock, changePin, removePin } = usePrivateFolderStore()
  const isSetUp = usePrivateFolderStore(selectIsSetUp)
  const hasPin = usePrivateFolderStore(selectHasPin)
  const [flow, setFlow] = useState<Flow>(null)
  const [draft, setDraft] = useState(name ?? '')
  const label = folderLabel(name)

  const saveName = () => {
    const next = draft.trim()
    if (next === (name ?? '')) return
    rename(next)
    setDraft(next)
    showToast('Folder renamed')
  }

  return (
    <div>
      <label htmlFor="private-folder-name" className="block text-[11px] font-semibold text-muted mb-1.5">
        Private folder
      </label>

      {!isSetUp ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-subtle">
            <FolderLock className="w-3.5 h-3.5 text-muted" />
            <span className="text-[13px] font-medium text-secondary">Hide loans behind their own PIN</span>
          </div>
          <button
            type="button"
            onClick={() => setFlow('setup')}
            className="px-3 py-2.5 rounded-xl bg-subtle text-[13px] font-semibold text-brand hover:opacity-80 transition-opacity"
          >
            Set up
          </button>
        </div>
      ) : (
        <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            id="private-folder-name"
            className="input-field flex-1 min-w-0"
            value={draft}
            maxLength={MAX_FOLDER_NAME}
            placeholder={DEFAULT_FOLDER_LABEL}
            autoComplete="off"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          />
          {hasPin && (
            <button
              type="button"
              onClick={() => setFlow('current-pin')}
              className="px-3 py-2.5 rounded-xl bg-subtle text-[13px] font-semibold text-secondary hover:opacity-80 transition-opacity shrink-0"
            >
              Change PIN
            </button>
          )}
        </div>
        {/* Turning the PIN off needs the PIN, or a borrower could just switch it off. */}
        <button
          type="button"
          role="switch"
          aria-checked={hasPin}
          onClick={() => setFlow(hasPin ? 'off-pin' : 'new-pin')}
          className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl bg-subtle"
        >
          <span className="flex items-center gap-2 min-w-0 text-left">
            <Lock className="w-3.5 h-3.5 text-muted shrink-0" />
            <span className="text-[13px] text-secondary">
              Require PIN
              <span className="block text-[11px] text-muted">
                {hasPin ? 'The folder only opens with its PIN' : 'Anyone using the app can open the folder'}
              </span>
            </span>
          </span>
          <span className={`w-10 h-6 rounded-full transition-colors shrink-0 ${hasPin ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-600'}`}>
            <span className={`block w-5 h-5 rounded-full bg-white transform transition-transform mt-0.5 ${hasPin ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
          </span>
        </button>
        </div>
      )}

      {flow === 'off-pin' && (
        <FolderScreen onCancel={() => setFlow(null)}>
          <PinPad
            icon={<FolderBadge />}
            title={`Turn off the PIN for ${label}?`}
            subtitle="Enter the current PIN. Its loans stay hidden from the rest of Ollie."
            onComplete={async (pin) => {
              const ok = await unlock(pin)
              if (ok) {
                removePin()
                setFlow(null)
                showToast('PIN turned off')
              }
              return ok
            }}
          />
        </FolderScreen>
      )}

      {flow === 'setup' && (
        <PrivateFolderSetup
          onCancel={() => setFlow(null)}
          onDone={() => {
            setFlow(null)
            setDraft(usePrivateFolderStore.getState().name ?? '')
            showToast('Private folder ready')
          }}
        />
      )}

      {flow === 'current-pin' && (
        <FolderScreen onCancel={() => setFlow(null)}>
          <PinPad
            icon={<FolderBadge />}
            title={`Current PIN for ${label}`}
            subtitle="Enter it before choosing a new one"
            onComplete={async (pin) => {
              const ok = await unlock(pin)
              if (ok) setFlow('new-pin')
              return ok
            }}
          />
        </FolderScreen>
      )}

      {flow === 'new-pin' && (
        <FolderScreen onCancel={() => setFlow(null)}>
          <ChoosePin
            title={hasPin ? `New PIN for ${label}` : `Choose a PIN for ${label}`}
            onChosen={async (pin) => {
              await changePin(pin)
              setFlow(null)
              showToast(hasPin ? 'PIN changed' : 'PIN turned on')
            }}
          />
        </FolderScreen>
      )}
    </div>
  )
}
