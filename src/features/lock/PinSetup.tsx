import { useState } from 'react'
import { Lock, Unlock, Delete } from 'lucide-react'
import { useLockStore } from './lockStore'
import { showToast } from '../../components/Toast'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const

export default function PinSetup() {
  const { enabled, removePin } = useLockStore()
  const [showSetup, setShowSetup] = useState(false)

  if (showSetup) {
    return <PinFlow onDone={() => setShowSetup(false)} />
  }

  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
        App Lock
      </label>
      {enabled ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-subtle">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[13px] font-medium text-primary">PIN lock enabled</span>
          </div>
          <button
            onClick={() => setShowSetup(true)}
            className="px-3 py-2.5 rounded-xl bg-subtle text-[13px] font-semibold text-secondary hover:opacity-80 transition-opacity"
          >
            Change
          </button>
          <button
            onClick={() => {
              removePin()
              showToast('PIN lock removed')
            }}
            className="px-3 py-2.5 rounded-xl bg-subtle text-[13px] font-semibold text-red-500 hover:opacity-80 transition-opacity"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSetup(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-subtle text-[13px] font-semibold text-secondary hover:opacity-80 transition-opacity"
        >
          <Unlock className="w-3.5 h-3.5" />
          Set up PIN Lock
        </button>
      )}
    </div>
  )
}

function PinFlow({ onDone }: { onDone: () => void }) {
  const { setPin } = useLockStore()
  const [step, setStep] = useState<'enter' | 'confirm'>('enter')
  const [firstPin, setFirstPin] = useState('')
  const [pin, setPinValue] = useState('')
  const [error, setError] = useState(false)

  const handleDigit = async (d: string) => {
    if (d === 'del') {
      setPinValue((p) => p.slice(0, -1))
      setError(false)
      return
    }
    const next = pin + d
    if (next.length > 4) return
    setPinValue(next)
    if (next.length === 4) {
      if (step === 'enter') {
        setFirstPin(next)
        setPinValue('')
        setStep('confirm')
      } else {
        if (next === firstPin) {
          await setPin(next)
          showToast('PIN lock enabled')
          onDone()
        } else {
          setError(true)
          setTimeout(() => {
            setPinValue('')
            setError(false)
            setStep('enter')
            setFirstPin('')
          }, 500)
        }
      }
    }
  }

  return (
    <div className="flex flex-col items-center py-4">
      <p className="text-[14px] font-semibold text-primary mb-1">
        {step === 'enter' ? 'Enter a 4-digit PIN' : 'Confirm your PIN'}
      </p>
      <p className="text-[12px] text-muted mb-4">
        {step === 'enter' ? 'Choose a PIN to lock the app' : 'Enter the same PIN again'}
      </p>

      {/* PIN dots */}
      <div className={`flex gap-3 mb-5 ${error ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
              i < pin.length
                ? error ? 'bg-red-500 scale-110' : 'bg-brand scale-110'
                : 'bg-subtle border-2 border-themed'
            }`}
          />
        ))}
      </div>

      {/* Compact numpad */}
      <div className="grid grid-cols-3 gap-2 w-[220px] mb-3">
        {DIGITS.map((d, i) => {
          if (d === '') return <div key={i} />
          if (d === 'del') {
            return (
              <button
                key={i}
                onClick={() => handleDigit('del')}
                className="h-12 rounded-xl flex items-center justify-center hover:bg-subtle active:scale-90 transition-all"
              >
                <Delete className="w-5 h-5 text-secondary" />
              </button>
            )
          }
          return (
            <button
              key={i}
              onClick={() => handleDigit(d)}
              className="h-12 rounded-xl bg-subtle border border-themed text-lg font-semibold text-primary hover:bg-card-hover active:scale-90 transition-all"
            >
              {d}
            </button>
          )
        })}
      </div>

      <button
        onClick={onDone}
        className="text-[12px] font-semibold text-muted hover:text-secondary transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}
