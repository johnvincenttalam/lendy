import { useState } from 'react'
import type { ReactNode } from 'react'
import { Delete } from 'lucide-react'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const
export const PIN_LENGTH = 4

type Props = {
  title: string
  subtitle?: ReactNode
  /** Artwork above the title (an icon, Ollie, a lock badge). */
  icon?: ReactNode
  /** Called with all four digits. Return false to shake and clear. */
  onComplete: (pin: string) => boolean | void | Promise<boolean | void>
  /** Extra controls under the keypad, e.g. "Forgot PIN". */
  footer?: ReactNode
}

/** Four PIN dots over a numeric keypad — shared by every PIN prompt. */
export default function PinPad({ title, subtitle, icon, onComplete, footer }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const handleDigit = async (d: string) => {
    if (d === 'del') {
      setPin((p) => p.slice(0, -1))
      setError(false)
      return
    }
    const next = pin + d
    if (next.length > PIN_LENGTH) return
    setPin(next)
    if (next.length < PIN_LENGTH) return

    const ok = await onComplete(next)
    if (ok === false) {
      setError(true)
      setTimeout(() => {
        setPin('')
        setError(false)
      }, 500)
    } else {
      setPin('')
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center mb-10 text-center px-6">
        {icon && <div className="mb-5">{icon}</div>}
        <h1 className="text-[22px] font-extrabold text-primary tracking-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-muted mt-1">{subtitle}</p>}
      </div>

      <div className={`flex gap-4 mb-10 ${error ? 'animate-shake' : ''}`} aria-live="polite">
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-200 ${
              i < pin.length
                ? error ? 'bg-red-500 scale-110' : 'bg-brand scale-110'
                : 'bg-subtle border-2 border-themed'
            }`}
          />
        ))}
        {error && <span className="sr-only">Wrong PIN</span>}
      </div>

      <div className="grid grid-cols-3 gap-3 w-[280px]">
        {DIGITS.map((d, i) => {
          if (d === '') return <div key={i} />
          if (d === 'del') {
            return (
              <button
                key={i}
                type="button"
                aria-label="Delete digit"
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
              type="button"
              onClick={() => handleDigit(d)}
              className="h-16 rounded-2xl bg-card border border-themed text-2xl font-semibold text-primary hover:bg-card-hover active:scale-90 transition-all"
            >
              {d}
            </button>
          )
        })}
      </div>

      {footer && <div className="mt-6">{footer}</div>}
    </div>
  )
}
