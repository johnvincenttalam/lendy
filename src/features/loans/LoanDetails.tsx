import { useState } from 'react'
import {
  ArrowLeft, Trash2, CheckCircle, Calendar, DollarSign,
  Clock, TrendingUp, PiggyBank, CircleDot, Pencil, Undo2,
} from 'lucide-react'
import { DEFAULT_COLOR } from './loanTypes'
import type { Loan } from './loanTypes'
import {
  remainingPrincipal,
  remainingBalance,
  monthsLeft,
  progressPercent,
  formatCurrency,
  endDate,
  isFullyPaid,
  paymentSchedule,
  totalInterestOverLife,
  totalCostOfLoan,
  interestPaidSoFar,
  interestRemaining,
} from './loanUtils'
import { useLoanStore } from './loanStore'
import LoanForm from './LoanForm'
import { showToast } from '../../components/Toast'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

type Props = {
  loan: Loan
  onMarkPaid: () => void
  onDelete: () => void
  onBack: () => void
}

export default function LoanDetails({ loan, onMarkPaid, onDelete, onBack }: Props) {
  const [showConfirm, setShowConfirm] = useState<'pay' | 'delete' | 'undo' | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  useBodyScrollLock(showConfirm !== null || showEdit)
  const updateLoan = useLoanStore((s) => s.updateLoan)
  const undoMarkAsPaid = useLoanStore((s) => s.undoMarkAsPaid)
  const pct = progressPercent(loan)
  const remPrincipal = remainingPrincipal(loan)
  const remBalance = remainingBalance(loan)
  const left = monthsLeft(loan)
  const fullyPaid = isFullyPaid(loan)
  const end = endDate(loan)
  const schedule = paymentSchedule(loan)
  const hasInterest = loan.interestRate > 0
  const color = loan.color || DEFAULT_COLOR

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      {/* Header */}
      <div className="bg-header backdrop-blur-header border-b border-themed sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <button onClick={onBack} className="w-9 h-9 flex items-center justify-center hover:opacity-60 transition-opacity">
              <ArrowLeft className="w-[18px] h-[18px] text-secondary" />
            </button>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {loan.name.charAt(0).toUpperCase()}
            </div>
            <h1 className="font-semibold text-primary text-[16px] tracking-tight">{loan.name}</h1>
          </div>
          <div className="flex items-center gap-1.5">
            {loan.monthsPaid > 0 && (
              <button
                onClick={() => setShowConfirm('undo')}
                className="w-9 h-9 flex items-center justify-center hover:opacity-60 transition-opacity"
                title="Undo last payment"
              >
                <Undo2 className="w-[18px] h-[18px] text-secondary" />
              </button>
            )}
            <button
              onClick={() => setShowEdit(true)}
              className="w-9 h-9 flex items-center justify-center hover:opacity-60 transition-opacity"
            >
              <Pencil className="w-[18px] h-[18px] text-secondary" />
            </button>
            <button
              onClick={() => setShowConfirm('delete')}
              className="w-9 h-9 flex items-center justify-center hover:opacity-60 transition-opacity"
            >
              <Trash2 className="w-[18px] h-[18px] text-red-500 dark:text-red-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-8 space-y-4">
        {/* Hero balance */}
        <div className="bg-card rounded-2xl border border-themed transition-colors overflow-hidden">
          <div className="px-4 pt-6 pb-4 text-center">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-1.5">Remaining Balance</p>
            <p className="text-[36px] font-bold text-primary tracking-tighter leading-none">{formatCurrency(remBalance)}</p>
            {hasInterest && (
              <p className="text-[12px] text-muted mt-2">
                Principal: {formatCurrency(remPrincipal)}
              </p>
            )}
          </div>

          <div className="px-4 pb-5">
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: `${color}12` }}>
              <div
                className="h-2.5 rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.max(pct, 2)}%`,
                  background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                }}
              />
            </div>
            <div className="flex justify-between items-center mt-2.5">
              <span
                className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: `${color}10`, color }}
              >
                {pct}% complete
              </span>
              <span className="text-[12px] font-medium text-muted">{left} months left</span>
            </div>
          </div>
        </div>

        {/* Interest overview */}
        {hasInterest && (
          <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-[11px] flex items-center justify-center" style={{ backgroundColor: `${color}10` }}>
                <TrendingUp className="w-4 h-4" style={{ color }} />
              </div>
              <h3 className="font-bold text-primary text-[15px] tracking-tight">Interest</h3>
              <span
                className="ml-auto text-[11px] font-bold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: `${color}10`, color }}
              >
                {loan.interestRate}%/mo
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
              <Stat label="Total Interest" value={formatCurrency(totalInterestOverLife(loan))} color="text-red-500 dark:text-red-400" />
              <Stat label="Total Repayment" value={formatCurrency(totalCostOfLoan(loan))} color="text-primary" />
              <Stat label="Interest Paid" value={formatCurrency(interestPaidSoFar(loan))} customColor={color} />
              <Stat label="Interest Left" value={formatCurrency(interestRemaining(loan))} color="text-muted" />
            </div>
          </div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-3 gap-2.5">
          <InfoCard icon={<DollarSign className="w-3.5 h-3.5" />} label="Amount" value={formatCurrency(loan.totalAmount)} />
          <InfoCard icon={<DollarSign className="w-3.5 h-3.5" />} label="Monthly" value={formatCurrency(loan.monthlyPayment)} highlightColor={color} />
          <InfoCard icon={<CheckCircle className="w-3.5 h-3.5" />} label="Paid" value={`${loan.monthsPaid}/${loan.durationMonths}`} />
          <InfoCard icon={<Calendar className="w-3.5 h-3.5" />} label="Start" value={new Date(loan.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} />
          <InfoCard icon={<Calendar className="w-3.5 h-3.5" />} label="End" value={new Date(end).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} />
          <InfoCard icon={<PiggyBank className="w-3.5 h-3.5" />} label="Total Paid" value={formatCurrency(loan.totalPaid)} highlightColor={color} />
        </div>

        {/* Repayment schedule */}
        <div className="bg-card rounded-2xl border border-themed transition-colors overflow-hidden">
          <div className="px-4 pt-4 pb-2.5">
            <h3 className="font-bold text-primary text-[15px] tracking-tight">Repayment Schedule</h3>
          </div>
          <div>
            {schedule.map((p) => {
              const isPaid = p.month <= loan.monthsPaid
              const isNext = p.month === loan.monthsPaid + 1
              return (
                <div
                  key={p.month}
                  className="px-4 py-3.5 flex items-start gap-3 border-t border-divider transition-colors"
                  style={isNext ? { backgroundColor: `${color}06` } : undefined}
                >
                  <div className="pt-0.5">
                    {isPaid ? (
                      <CheckCircle className="w-[18px] h-[18px] text-emerald-500" />
                    ) : isNext ? (
                      <CircleDot className="w-[18px] h-[18px]" style={{ color }} />
                    ) : (
                      <Clock className="w-[18px] h-[18px] text-muted" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-bold text-primary">
                        {p.month}/{loan.durationMonths}
                      </span>
                      <span className="text-[14px] font-bold text-primary">{formatCurrency(p.payment)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[11px] text-muted">
                        {p.date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {hasInterest && (
                        <span className="text-[11px] text-muted">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(p.principal)}</span>
                          {' + '}
                          <span className="text-red-500 dark:text-red-400 font-medium">{formatCurrency(p.interest)}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold mt-0.5 shrink-0 px-2.5 py-[3px] rounded-md uppercase tracking-wide ${
                      isPaid
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : !isNext
                          ? 'bg-subtle text-muted'
                          : ''
                    }`}
                    style={isNext ? { backgroundColor: `${color}10`, color } : undefined}
                  >
                    {isPaid ? 'Paid' : isNext ? 'Next' : 'Due'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Spacer for sticky CTA */}
        {!fullyPaid && <div className="h-24" />}

        {fullyPaid && (
          <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold py-4 rounded-2xl text-center text-[15px] border border-emerald-500/15 tracking-tight">
            Fully Paid
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      {!fullyPaid && (
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-page via-page to-transparent pt-6 pb-6 px-4">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setShowConfirm('pay')}
              className="w-full text-white font-bold py-4 rounded-2xl active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 text-[15px] tracking-tight hover:opacity-90"
              style={{ backgroundColor: color }}
            >
              Mark as Paid
            </button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEdit && (
        <LoanForm
          initial={loan}
          onSubmit={(data) => {
            updateLoan(loan.id, data)
            setShowEdit(false)
            showToast(`"${data.name}" updated`)
          }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-overlay z-50 flex items-center justify-center p-5 animate-fade-in">
          <div className="bg-card rounded-2xl p-6 max-w-[320px] w-full border border-themed transition-colors animate-scale-in">
            <h3 className="font-bold text-primary text-[18px] tracking-tight mb-2">
              {showConfirm === 'pay' ? 'Confirm Payment' : showConfirm === 'undo' ? 'Undo Payment' : 'Delete Loan'}
            </h3>
            {showConfirm === 'pay' ? (
              <div className="text-[13px] text-secondary mb-6 space-y-1">
                <p>Mark payment {loan.monthsPaid + 1}/{loan.durationMonths} of {formatCurrency(loan.monthlyPayment)} as paid?</p>
                {hasInterest && schedule[loan.monthsPaid] && (
                  <p className="text-[12px] text-muted">
                    {formatCurrency(schedule[loan.monthsPaid].principal)} principal + {formatCurrency(schedule[loan.monthsPaid].interest)} interest
                  </p>
                )}
              </div>
            ) : showConfirm === 'undo' ? (
              <p className="text-[13px] text-secondary mb-6">
                Undo payment {loan.monthsPaid}/{loan.durationMonths}? This will revert the last recorded payment.
              </p>
            ) : (
              <p className="text-[13px] text-secondary mb-6">
                Delete "{loan.name}"? This cannot be undone.
              </p>
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
                  if (showConfirm === 'pay') onMarkPaid()
                  else if (showConfirm === 'undo') {
                    undoMarkAsPaid(loan.id)
                    showToast('Payment reverted')
                  }
                  else onDelete()
                  setShowConfirm(null)
                }}
                className="flex-1 py-3 rounded-xl font-semibold text-[14px] text-white hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: showConfirm === 'pay' ? color : showConfirm === 'undo' ? '#F59E0B' : '#EF4444',
                }}
              >
                {showConfirm === 'pay' ? 'Confirm' : showConfirm === 'undo' ? 'Undo' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color, customColor }: { label: string; value: string; color?: string; customColor?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-1">{label}</p>
      <p
        className={`font-bold text-[15px] tracking-tight ${color || ''}`}
        style={customColor ? { color: customColor } : undefined}
      >
        {value}
      </p>
    </div>
  )
}

function InfoCard({
  icon,
  label,
  value,
  highlightColor,
}: {
  icon: React.ReactNode
  label: string
  value: string
  highlightColor?: string
}) {
  return (
    <div className="bg-card rounded-2xl p-3.5 border border-themed transition-colors">
      <div className="flex items-center gap-1 text-muted mb-1.5">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">{label}</span>
      </div>
      <p
        className={`font-bold text-[13px] tracking-tight ${highlightColor ? '' : 'text-primary'}`}
        style={highlightColor ? { color: highlightColor } : undefined}
      >
        {value}
      </p>
    </div>
  )
}
