import { useState, useEffect } from 'react'
import { Lock, Delete } from 'lucide-react'
import { useLockStore } from './lockStore'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const

export default function PinScreen() {
  const { locked, verifyPin, lock } = useLockStore()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  // Re-lock when app goes to background
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') lock()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [lock])

  if (!locked) return null

  const handleDigit = async (d: string) => {
    if (d === 'del') {
      setPin((p) => p.slice(0, -1))
      setError(false)
      return
    }
    const next = pin + d
    if (next.length > 4) return
    setPin(next)
    if (next.length === 4) {
      const ok = await verifyPin(next)
      if (!ok) {
        setError(true)
        setTimeout(() => {
          setPin('')
          setError(false)
        }, 500)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-page flex flex-col items-center justify-center">
      <div className="flex flex-col items-center mb-10">
        <div className="relative mb-5">
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="Ollie" className="w-20 h-20 rounded-3xl" />
          <span className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-card border-4 border-[var(--color-page)] flex items-center justify-center">
            <Lock className="w-3.5 h-3.5 text-brand" strokeWidth={2.5} />
          </span>
        </div>
        <h1 className="text-[22px] font-extrabold text-primary tracking-tight">Welcome back</h1>
        <p className="text-[13px] text-muted mt-1">Enter your 4-digit PIN to unlock Ollie</p>
      </div>

      {/* PIN dots */}
      <div className={`flex gap-4 mb-10 ${error ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-200 ${
              i < pin.length
                ? error ? 'bg-red-500 scale-110' : 'bg-brand scale-110'
                : 'bg-subtle border-2 border-themed'
            }`}
          />
        ))}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-[280px]">
        {DIGITS.map((d, i) => {
          if (d === '') return <div key={i} />
          if (d === 'del') {
            return (
              <button
                key={i}
                onClick={() => handleDigit('del')}
                className="h-16 rounded-2xl flex items-center justify-center hover:bg-subtle active:scale-90 transition-all"
              >
                <Delete className="w-6 h-6 text-secondary" />
              </button>
            )
          }
          return (
            <button
              key={i}
              onClick={() => handleDigit(d)}
              className="h-16 rounded-2xl bg-card border border-themed text-2xl font-semibold text-primary hover:bg-card-hover active:scale-90 transition-all"
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}
