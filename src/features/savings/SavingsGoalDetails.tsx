import { useState, useMemo } from 'react'
import {
  ArrowLeft, Trash2, Pencil, Archive, ArchiveRestore, MoreVertical,
  ArrowDownCircle, ArrowUpCircle, Target,
} from 'lucide-react'
import { DEFAULT_COLOR } from '../loans/loanTypes'
import type { SavingsGoal } from './savingsTypes'
import { progressPercent } from './savingsUtils'
import { useSavingsStore } from './savingsStore'
import SavingsGoalForm from './SavingsGoalForm'
import SavingsTransactionForm from './SavingsTransactionForm'
import { showToast } from '../../components/Toast'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import CurrencyAmount from '../../components/CurrencyAmount'

type Props = {
  goal: SavingsGoal
  onDelete: () => void
  onBack: () => void
}

export default function SavingsGoalDetails({ goal, onDelete, onBack }: Props) {
  const [showConfirm, setShowConfirm] = useState<'archive' | 'delete' | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [txnMode, setTxnMode] = useState<'deposit' | 'withdrawal' | null>(null)
  useBodyScrollLock(showConfirm !== null || showEdit || txnMode !== null)
  const updateGoal = useSavingsStore((s) => s.updateGoal)
  const addFunds = useSavingsStore((s) => s.addFunds)
  const withdrawFunds = useSavingsStore((s) => s.withdrawFunds)
  const archiveGoal = useSavingsStore((s) => s.archiveGoal)
  const unarchiveGoal = useSavingsStore((s) => s.unarchiveGoal)
  const transactions = useSavingsStore((s) => s.transactions)
  const goalTransactions = useMemo(
    () => transactions.filter((t) => t.goalId === goal.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [transactions, goal.id],
  )
  const color = goal.color || DEFAULT_COLOR
  const pct = progressPercent(goal)

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      {/* Header */}
      <div className="bg-header backdrop-blur-header border-b border-themed sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2 px-4 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button onClick={onBack} className="w-9 h-9 flex-shrink-0 flex items-center justify-center hover:opacity-60 transition-opacity">
              <ArrowLeft className="w-[18px] h-[18px] text-secondary" />
            </button>
            <div
              className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-[12px] font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {goal.name.charAt(0).toUpperCase()}
            </div>
            <h1 className="font-semibold text-primary text-[16px] tracking-tight truncate min-w-0">{goal.name}</h1>
          </div>
          <div className="flex items-center flex-shrink-0 relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="w-9 h-9 flex items-center justify-center hover:opacity-60 transition-opacity"
              title="More actions"
              aria-haspopup="menu"
              aria-expanded={showMenu}
            >
              <MoreVertical className="w-[18px] h-[18px] text-secondary" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <div role="menu" className="absolute right-0 top-11 bg-card border border-themed rounded-xl z-40 py-1 min-w-[180px] shadow-lg animate-scale-in">
                  <button
                    role="menuitem"
                    onClick={() => { setShowMenu(false); setShowEdit(true) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-secondary hover:bg-subtle transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setShowMenu(false); setShowConfirm('archive') }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-secondary hover:bg-subtle transition-colors"
                  >
                    {goal.archived ? (
                      <>
                        <ArchiveRestore className="w-4 h-4 text-amber-500" />
                        Restore goal
                      </>
                    ) : (
                      <>
                        <Archive className="w-4 h-4" />
                        Archive goal
                      </>
                    )}
                  </button>
                  <div className="my-1 border-t border-themed" />
                  <button
                    role="menuitem"
                    onClick={() => { setShowMenu(false); setShowConfirm('delete') }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-red-500 dark:text-red-400 hover:bg-subtle transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete goal
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-8 space-y-4">
        {/* Hero */}
        <div className="bg-card rounded-2xl border border-themed transition-colors overflow-hidden">
          {goal.archived && (
            <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold uppercase tracking-wider text-center py-2 border-b border-amber-500/20">
              Archived
            </div>
          )}
          <div className="px-4 pt-6 pb-4 text-center">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-1.5">Current Balance</p>
            <p className="text-[36px] font-bold font-mono text-primary tracking-tighter leading-none"><CurrencyAmount value={goal.currentAmount} /></p>
            <p className="text-[12px] text-muted mt-2">
              of <CurrencyAmount value={goal.targetAmount} /> target
            </p>
          </div>
          <div className="px-4 pb-5">
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: `${color}15` }}>
              <div
                className="h-2.5 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.max(pct, 2)}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
              />
            </div>
            <div className="flex justify-between items-center mt-2.5">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${color}10`, color }}>
                {pct}% complete
              </span>
              {pct >= 100 && (
                <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" />
                  Goal reached
                </span>
              )}
            </div>
          </div>
        </div>

        {goal.notes && (
          <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-1.5">Notes</p>
            <p className="text-[13px] text-secondary whitespace-pre-wrap break-words leading-relaxed">{goal.notes}</p>
          </div>
        )}

        {/* Add/Withdraw actions */}
        {!goal.archived && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setTxnMode('deposit')}
              className="flex items-center justify-center gap-1.5 py-3 rounded-2xl text-white font-bold text-[14px] tracking-tight active:scale-[0.98] transition-all hover:opacity-90"
              style={{ backgroundColor: color }}
            >
              <ArrowDownCircle className="w-4 h-4" />
              Add Funds
            </button>
            <button
              onClick={() => setTxnMode('withdrawal')}
              disabled={goal.currentAmount <= 0}
              className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-subtle text-secondary font-bold text-[14px] tracking-tight active:scale-[0.98] transition-all hover:opacity-80 disabled:opacity-40 disabled:pointer-events-none"
            >
              <ArrowUpCircle className="w-4 h-4" />
              Withdraw
            </button>
          </div>
        )}

        {/* Transaction history */}
        <div className="bg-card rounded-2xl border border-themed transition-colors overflow-hidden">
          <div className="px-4 pt-4 pb-2.5">
            <h3 className="font-bold text-primary text-[15px] tracking-tight">Transaction History</h3>
          </div>
          {goalTransactions.length === 0 ? (
            <p className="px-4 pb-4 text-[13px] text-muted">No transactions recorded yet</p>
          ) : (
            <div>
              {goalTransactions.map((t) => (
                <div key={t.id} className="px-4 py-3.5 flex items-center gap-3 border-t border-divider">
                  {t.type === 'deposit' ? (
                    <ArrowDownCircle className="w-[18px] h-[18px] text-emerald-500 shrink-0" />
                  ) : (
                    <ArrowUpCircle className="w-[18px] h-[18px] text-red-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-bold text-primary">
                      {new Date(t.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {t.note && <p className="text-[11px] text-muted truncate">{t.note}</p>}
                  </div>
                  <span className={`text-[14px] font-bold ${t.type === 'deposit' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {t.type === 'deposit' ? '+' : '-'}<CurrencyAmount value={t.amount} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <SavingsGoalForm
          initial={goal}
          onSubmit={(data) => {
            updateGoal(goal.id, data)
            setShowEdit(false)
            showToast(`"${data.name}" updated`)
          }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Add/withdraw modal */}
      {txnMode && (
        <SavingsTransactionForm
          goal={goal}
          mode={txnMode}
          onSubmit={(amount, note) => {
            if (txnMode === 'deposit') addFunds(goal.id, amount, note)
            else withdrawFunds(goal.id, amount, note)
            setTxnMode(null)
          }}
          onClose={() => setTxnMode(null)}
        />
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-overlay z-50 flex items-center justify-center p-5 animate-fade-in">
          <div className="bg-card rounded-2xl p-6 max-w-[320px] w-full border border-themed transition-colors animate-scale-in">
            <h3 className="font-bold text-primary text-[18px] tracking-tight mb-2">
              {showConfirm === 'archive' ? (goal.archived ? 'Restore Goal' : 'Archive Goal') : 'Delete Goal'}
            </h3>
            {showConfirm === 'archive' ? (
              <p className="text-[13px] text-secondary mb-6">
                {goal.archived
                  ? `Restore "${goal.name}"? It will appear in your active goals again.`
                  : `Archive "${goal.name}"? It will be hidden from your goals list but can be restored later.`}
              </p>
            ) : (
              <p className="text-[13px] text-secondary mb-6">Delete "{goal.name}"? This cannot be undone.</p>
            )}
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 py-3 rounded-xl bg-subtle text-secondary font-semibold text-[14px] hover:opacity-80 transition-opacity"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showConfirm === 'archive') {
                    if (goal.archived) unarchiveGoal(goal.id)
                    else {
                      archiveGoal(goal.id)
                      onBack()
                    }
                  } else onDelete()
                  setShowConfirm(null)
                }}
                className="flex-1 py-3 rounded-xl font-semibold text-[14px] text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: showConfirm === 'archive' ? '#6366F1' : '#EF4444' }}
              >
                {showConfirm === 'archive' ? (goal.archived ? 'Restore' : 'Archive') : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
