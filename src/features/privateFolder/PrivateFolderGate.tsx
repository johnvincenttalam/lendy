import { useState } from 'react'
import { Lock } from 'lucide-react'
import PinPad from '../lock/PinPad'
import { usePrivateFolderStore } from './privateFolderStore'
import { folderLabel, verifyRecovery } from './privateFolderUtils'
import { ChoosePin, FolderBadge, FolderScreen } from './PrivateFolderSetup'
import { showToast } from '../../components/toastEvents'

type Step = 'pin' | 'app-pin' | 'new-pin'

/**
 * Asks for the folder PIN. "Forgot PIN" exists only when the app lock was
 * on when the folder PIN was set: that app PIN (saved as a hash, never the
 * current one) proves it's the owner, then a new folder PIN is chosen.
 * Otherwise there is no reset — nothing here can reveal or delete the
 * folder's loans, and setting a new app PIN later doesn't open it.
 */
export default function PrivateFolderGate({ onCancel }: { onCancel: () => void }) {
  const { name, recoveryHash, unlock, changePin } = usePrivateFolderStore()
  const [step, setStep] = useState<Step>('pin')
  const label = folderLabel(name)

  if (step === 'app-pin') {
    return (
      <FolderScreen onCancel={() => setStep('pin')}>
        <PinPad
          key="app-pin"
          icon={
            <div className="w-20 h-20 rounded-3xl bg-[var(--tint-neutral)] flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary" />
            </div>
          }
          title="Enter your app PIN"
          subtitle={`The one Ollie used when you set this folder's PIN. Then you can choose a new PIN for ${label}.`}
          onComplete={async (pin) => {
            const ok = await verifyRecovery(pin, recoveryHash)
            if (ok) setStep('new-pin')
            return ok
          }}
        />
      </FolderScreen>
    )
  }

  if (step === 'new-pin') {
    return (
      <FolderScreen onCancel={() => setStep('pin')}>
        <ChoosePin
          title={`New PIN for ${label}`}
          onChosen={async (pin) => {
            await changePin(pin)
            await unlock(pin)
            showToast('PIN changed')
          }}
        />
      </FolderScreen>
    )
  }

  return (
    <FolderScreen onCancel={onCancel}>
      <PinPad
        key="pin"
        icon={<FolderBadge />}
        title={label}
        subtitle="Enter the folder's PIN"
        onComplete={unlock}
        footer={recoveryHash !== null && (
          <button
            type="button"
            onClick={() => setStep('app-pin')}
            className="text-[13px] font-semibold text-brand px-3 py-1.5 rounded-lg hover:bg-subtle"
          >
            Forgot PIN?
          </button>
        )}
      />
    </FolderScreen>
  )
}
