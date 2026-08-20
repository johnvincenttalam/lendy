import { useState, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import type { Bill } from './billTypes'
import { DEFAULT_COLOR } from '../loans/loanTypes'
import CurrencyAmount from '../../components/CurrencyAmount'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

type Props = {
  bill: Bill
  /** What's still owed on the cycle currently due — the prefilled amount. */
  remaining: number
  /** Already settled on this cycle; drives the "topping up" copy. */
  paid: number
  onSubmit: (amount: number) => void
  onClose: () => void
}

/**
 * Amount sheet for recording a payment against a bill's current cycle. Prefilled
 * with the remaining balance, so confirming as-is settles the cycle and editing
 * it down records a partial.
 */
export default function BillPaymentForm({ bill, remaining, paid, onSubmit, onClose }: Props) {
  useBodyScrollLock(true)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef<number | null>(null)

  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragStartY.current = clientY
    setIsDragging(true)
  }, [])

  const handleDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (dragStartY.current === null) return
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    setDragY(Math.max(0, clientY - dragStartY.current))
  }, [])

  const handleDragEnd = useCallback(() => {
    if (dragY > 120) onClose()
    else setDragY(0)
    dragStartY.current = null
    setIsDragging(false)
  }, [dragY, onClose])

  const [amount, setAmount] = useState(remaining > 0 ? remaining.toFixed(2) : '')
  const [error, setError] = useState('')

  const color = bill.color || DEFAULT_COLOR
  const entered = Number(amount) || 0
  const dueDate = new Date(bill.nextDueDate)
  const settlesCycle = entered > 0 && entered >= remaining
  const leftAfter = Math.max(0, Math.round((remaining - entered) * 100) / 100)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || entered <= 0) {
      setError('Enter a valid amount')
      return
    }
    onSubmit(entered)
  }

  return (
    <div className="fixed inset-0 bg-overlay z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div
        className="bg-card w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl border-0 sm:border border-themed animate-slide-up"
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          className="flex justify-center pt-3 pb-1 sm:hidden cursor-grab active:cursor-grabbing"
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={() => { if (isDragging) handleDragEnd() }}
        >
          <div className="w-9 h-1 rounded-full bg-muted opacity-40" />
        </div>

        <div className="flex items-start justify-between px-5 pt-3 pb-4 sm:pt-5">
          <div className="min-w-0">
            <h2 className="text-[20px] font-bold text-primary tracking-tight">Record Payment</h2>
            <p className="text-[12px] text-muted mt-0.5 truncate">
              {bill.name} &middot; due {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center hover:opacity-60 transition-opacity shrink-0">
            <X className="w-[18px] h-[18px] text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4">
          {paid > 0 && (
            <p className="text-[12px] text-secondary">
              <CurrencyAmount value={paid} /> of <CurrencyAmount value={bill.amount} /> already paid this cycle.
            </p>
          )}

          <div>
            <label htmlFor="bill-payment-amount" className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Amount (&#8369;)
            </label>
            <div className={error ? 'rounded-[14px] ring-2 ring-red-500/50' : undefined}>
              <input
                id="bill-payment-amount"
                type="number"
                step="0.01"
                autoFocus
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError('') }}
                inputMode="decimal"
                placeholder={remaining.toFixed(2)}
                aria-invalid={!!error}
                aria-describedby={error ? 'bill-payment-amount-error' : 'bill-payment-amount-hint'}
                className="input-field"
              />
            </div>
            {error ? (
              <p id="bill-payment-amount-error" className="text-[11px] text-red-500 dark:text-red-400 mt-1 font-medium">{error}</p>
            ) : (
              <p id="bill-payment-amount-hint" className="text-[11px] text-muted mt-1">
                {entered <= 0 ? (
                  <>Full amount due is <CurrencyAmount value={remaining} /></>
                ) : settlesCycle ? (
                  'Settles this cycle'
                ) : (
                  <>Leaves <CurrencyAmount value={leftAfter} /> still due</>
                )}
              </p>
            )}
          </div>

          {remaining > 0 && (
            <button
              type="button"
              onClick={() => { setAmount(remaining.toFixed(2)); setError('') }}
              className="text-[12px] font-semibold hover:opacity-70 transition-opacity"
              style={{ color }}
            >
              Pay full <CurrencyAmount value={remaining} />
            </button>
          )}

          <button
            type="submit"
            className="w-full text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all duration-200 text-[15px] tracking-tight hover:opacity-90"
            style={{ backgroundColor: color }}
          >
            Record
          </button>
        </form>
      </div>
    </div>
  )
}
