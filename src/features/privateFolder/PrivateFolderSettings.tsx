import { useState } from 'react'
import { FolderLock } from 'lucide-react'
import PinPad from '../lock/PinPad'
import { showToast } from '../../components/Toast'
import { usePrivateFolderStore, selectIsSetUp } from './privateFolderStore'
import { DEFAULT_FOLDER_LABEL, MAX_FOLDER_NAME, folderLabel } from './privateFolderUtils'
import PrivateFolderSetup, { ChoosePin, FolderBadge, FolderScreen } from './PrivateFolderSetup'

type Flow = null | 'setup' | 'current-pin' | 'new-pin'

/** Settings → Private folder: set it up, rename it, change its PIN. */
export default function PrivateFolderSettings() {
  const { name, rename, unlock, changePin } = usePrivateFolderStore()
  const isSetUp = usePrivateFolderStore(selectIsSetUp)
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
          <button
            type="button"
            onClick={() => setFlow('current-pin')}
            className="px-3 py-2.5 rounded-xl bg-subtle text-[13px] font-semibold text-secondary hover:opacity-80 transition-opacity shrink-0"
          >
            Change PIN
          </button>
        </div>
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
            title={`New PIN for ${label}`}
            onChosen={async (pin) => {
              await changePin(pin)
              setFlow(null)
              showToast('PIN changed')
            }}
          />
        </FolderScreen>
      )}
    </div>
  )
}
