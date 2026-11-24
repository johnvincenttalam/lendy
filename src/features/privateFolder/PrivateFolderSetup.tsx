import { useState } from 'react'
import type { ReactNode } from 'react'
import { FolderLock } from 'lucide-react'
import PinPad from '../lock/PinPad'
import { usePrivateFolderStore } from './privateFolderStore'
import { DEFAULT_FOLDER_LABEL, MAX_FOLDER_NAME, folderLabel } from './privateFolderUtils'

/** The folder's badge above every folder PIN prompt. */
export function FolderBadge() {
  return (
    <div className="w-20 h-20 rounded-3xl bg-[var(--tint-teal)] flex items-center justify-center">
      <FolderLock className="w-9 h-9 text-brand" strokeWidth={2} />
    </div>
  )
}

/** Full-screen surface for folder PIN prompts, with a way out. */
export function FolderScreen({ children, onCancel }: { children: ReactNode; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[150] bg-page flex flex-col items-center justify-center overflow-y-auto py-10">
      {children}
      <button
        type="button"
        onClick={onCancel}
        className="mt-6 text-[14px] font-semibold text-secondary px-4 py-2 rounded-xl hover:bg-subtle"
      >
        Cancel
      </button>
    </div>
  )
}

/**
 * Pick a new 4-digit PIN: enter it, then enter it again. A mismatch shakes
 * and starts over.
 */
export function ChoosePin({ title, onChosen }: { title: string; onChosen: (pin: string) => void | Promise<void> }) {
  const [first, setFirst] = useState<string | null>(null)
  const [mismatch, setMismatch] = useState(false)

  if (first === null) {
    return (
      <PinPad
        key="first"
        icon={<FolderBadge />}
        title={title}
        subtitle={mismatch ? "Those didn't match. Try again." : 'Choose 4 digits only you know'}
        onComplete={(pin) => {
          setMismatch(false)
          setFirst(pin)
        }}
      />
    )
  }

  return (
    <PinPad
      key="confirm"
      icon={<FolderBadge />}
      title="Enter it again"
      subtitle="To make sure it's right"
      onComplete={async (pin) => {
        if (pin !== first) {
          setMismatch(true)
          setFirst(null)
          return false
        }
        await onChosen(pin)
      }}
    />
  )
}

/** First-time setup: name the folder, then choose its PIN. Opens unlocked. */
export default function PrivateFolderSetup({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const setUp = usePrivateFolderStore((s) => s.setUp)
  const [name, setName] = useState('')
  const [named, setNamed] = useState(false)

  if (named) {
    return (
      <FolderScreen onCancel={onCancel}>
        <ChoosePin
          title={`Choose a PIN for ${folderLabel(name)}`}
          onChosen={async (pin) => {
            await setUp(name, pin)
            onDone()
          }}
        />
      </FolderScreen>
    )
  }

  return (
    <FolderScreen onCancel={onCancel}>
      <form
        className="w-full max-w-sm px-6 flex flex-col items-center text-center"
        onSubmit={(e) => {
          e.preventDefault()
          setNamed(true)
        }}
      >
        <div className="mb-5"><FolderBadge /></div>
        <h1 className="text-[22px] font-extrabold text-primary tracking-tight">Set up your private folder</h1>
        <p className="text-[13px] text-muted mt-1 mb-6">
          Loans in it are hidden everywhere else in Ollie and only open with a PIN.
        </p>
        <label htmlFor="folder-name" className="self-start text-[13px] font-semibold text-secondary mb-1.5">
          Folder name
        </label>
        <input
          id="folder-name"
          className="input-field w-full"
          value={name}
          maxLength={MAX_FOLDER_NAME}
          placeholder={DEFAULT_FOLDER_LABEL}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />
        <p className="self-start text-[12px] text-muted mt-1.5">
          This is what shows in More. Pick something that doesn't draw attention.
        </p>
        <button
          type="submit"
          className="mt-6 w-full bg-brand text-on-brand text-[15px] font-bold py-3 rounded-2xl active:scale-[0.98] transition-transform"
        >
          Continue
        </button>
      </form>
    </FolderScreen>
  )
}
