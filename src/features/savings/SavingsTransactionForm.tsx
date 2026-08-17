import { useState } from 'react'
import { X } from 'lucide-react'
import type { SavingsGoal } from './savingsTypes'
import { DEFAULT_COLOR } from '../loans/loanTypes'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import CurrencyAmount from '../../components/CurrencyAmount'

type Props = {
  goal: SavingsGoal
  mode: 'deposit' | 'withdrawal'
  onSubmit: (amount: number, note?: string) => void
  onClose: () => void
}

export default function SavingsTransactionForm({ goal, mode, onSubmit, onClose }: Props) {
  useBodyScrollLock(true)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const isDeposit = mode === 'deposit'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (!amount || value <= 0) {
      setError('Enter a valid amount')
      return
    }
    if (!isDeposit && value > goal.currentAmount) {
      setError('Cannot withdraw more than the current balance')
      return
    }
    onSubmit(value, note.trim() || undefined)
  }

  return (
    <div className="fixed inset-0 bg-overlay z-50 flex items-center justify-center p-5 animate-fade-in">
      <div className="bg-card rounded-2xl p-6 max-w-[360px] w-full border border-themed transition-colors animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-primary text-[18px] tracking-tight">
            {isDeposit ? 'Add Funds' : 'Withdraw'}
          </h3>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center hover:opacity-60 transition-opacity">
            <X className="w-[18px] h-[18px] text-secondary" />
          </button>
        </div>

        <p className="text-[12px] text-muted mb-4">
          Current balance: <CurrencyAmount value={goal.currentAmount} />
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="txn-amount" className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Amount (₱)
            </label>
            <div className={error ? 'rounded-[14px] ring-2 ring-red-500/50' : undefined}>
              <input
                id="txn-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError('') }}
                inputMode="decimal" placeholder="1,000"
                aria-invalid={!!error}
                className="input-field"
              />
            </div>
            {error && <p className="text-[11px] text-red-500 dark:text-red-400 mt-1 font-medium">{error}</p>}
          </div>

          <div>
            <label htmlFor="txn-note" className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Note
            </label>
            <input
              id="txn-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
              maxLength={100}
              className="input-field"
            />
          </div>

          <button
            type="submit"
            className="w-full text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all duration-200 text-[15px] tracking-tight hover:opacity-90"
            style={{ backgroundColor: isDeposit ? (goal.color || DEFAULT_COLOR) : '#EF4444' }}
          >
            {isDeposit ? 'Add Funds' : 'Withdraw'}
          </button>
        </form>
      </div>
    </div>
  )
}
