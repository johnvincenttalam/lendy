import { useState } from 'react'
import { Lock } from 'lucide-react'
import PinPad from '../lock/PinPad'
import { useLockStore } from '../lock/lockStore'
import { usePrivateFolderStore } from './privateFolderStore'
import { folderLabel } from './privateFolderUtils'
import { ChoosePin, FolderBadge, FolderScreen } from './PrivateFolderSetup'
import { showToast } from '../../components/Toast'

type Step = 'pin' | 'app-pin' | 'new-pin'

/**
 * Asks for the folder PIN. "Forgot PIN" exists only when the app lock is
 * on: the app PIN proves it's the owner, then a new folder PIN is chosen.
 * With no app lock there is no reset — nothing here can reveal or delete
 * the folder's loans.
 */
export default function PrivateFolderGate({ onCancel }: { onCancel: () => void }) {
  const { name, unlock, changePin } = usePrivateFolderStore()
  const appLockOn = useLockStore((s) => s.enabled && s.pinHash !== null)
  const verifyAppPin = useLockStore((s) => s.verifyPin)
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
          subtitle={`The one that unlocks Ollie. Then you can choose a new PIN for ${label}.`}
          onComplete={async (pin) => {
            const ok = await verifyAppPin(pin)
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
        footer={appLockOn && (
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
