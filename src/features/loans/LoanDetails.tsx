import { useState } from 'react'
import {
  ArrowLeft, Trash2, CheckCircle, Calendar, DollarSign,
  Clock, TrendingUp, PiggyBank, CircleDot, Palette, Pencil,
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
import ColorPicker from '../../components/ColorPicker'
import LoanForm from './LoanForm'
import { showToast } from '../../components/Toast'

type Props = {
  loan: Loan
  onMarkPaid: () => void
  onDelete: () => void
  onBack: () => void
}

export default function LoanDetails({ loan, onMarkPaid, onDelete, onBack }: Props) {
  const [showConfirm, setShowConfirm] = useState<'pay' | 'delete' | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const updateLoan = useLoanStore((s) => s.updateLoan)
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
        <div className="max-w-2xl mx-auto flex items-center justify-between px-3 py-3.5">
          <button onClick={onBack} className="w-8 h-8 rounded-full bg-subtle flex items-center justify-center hover:opacity-70 transition-opacity">
            <ArrowLeft className="w-4 h-4 text-secondary" />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {loan.name.charAt(0).toUpperCase()}
            </div>
            <h1 className="font-semibold text-primary text-[15px] tracking-tight">{loan.name}</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowEdit(true)}
              className="w-8 h-8 rounded-full bg-subtle flex items-center justify-center hover:opacity-70 transition-opacity"
            >
              <Pencil className="w-3.5 h-3.5 text-secondary" />
            </button>
            <button
              onClick={() => setShowConfirm('delete')}
              className="w-8 h-8 rounded-full bg-red-500/8 dark:bg-red-500/10 flex items-center justify-center hover:opacity-70 transition-opacity"
            >
              <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 pt-4 pb-8 space-y-4">
        {/* Hero balance */}
        <div className="bg-card rounded-2xl border border-themed transition-colors overflow-hidden">
          <div className="px-3 pt-5 pb-4 text-center">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">Remaining Balance</p>
            <p className="text-[34px] font-bold text-primary tracking-tighter leading-none">{formatCurrency(remBalance)}</p>
            {hasInterest && (
              <p className="text-[12px] text-muted mt-1.5">
                Principal: {formatCurrency(remPrincipal)}
              </p>
            )}
          </div>

          <div className="px-3 pb-4">
            <div className="w-full h-2 rounded-full" style={{ backgroundColor: `${color}18` }}>
              <div
                className="h-2 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <span
                className="text-[11px] font-semibold px-2 py-[3px] rounded-full"
                style={{ backgroundColor: `${color}12`, color }}
              >
                {pct}% complete
              </span>
              <span className="text-[12px] text-muted">{left} months left</span>
            </div>
          </div>
        </div>

        {/* Color picker */}
        <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="flex items-center gap-2 w-full"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
              <Palette className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <span className="text-[14px] font-semibold text-primary tracking-tight flex-1 text-left">Color</span>
            <div className="w-6 h-6 rounded-lg border border-themed" style={{ backgroundColor: color }} />
          </button>
          {showColorPicker && (
            <div className="mt-3 pt-3 border-t border-divider">
              <ColorPicker
                value={color}
                onChange={(c) => updateLoan(loan.id, { color: c })}
              />
            </div>
          )}
        </div>

        {/* Interest overview */}
        {hasInterest && (
          <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}12` }}>
                <TrendingUp className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <h3 className="font-semibold text-primary text-[14px] tracking-tight">Interest</h3>
              <span
                className="ml-auto text-[11px] font-semibold px-2 py-[3px] rounded-full"
                style={{ backgroundColor: `${color}12`, color }}
              >
                {loan.interestRate}%/mo
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Stat label="Total Interest" value={formatCurrency(totalInterestOverLife(loan))} color="text-red-500 dark:text-red-400" />
              <Stat label="Total Repayment" value={formatCurrency(totalCostOfLoan(loan))} color="text-primary" />
              <Stat label="Interest Paid" value={formatCurrency(interestPaidSoFar(loan))} customColor={color} />
              <Stat label="Interest Left" value={formatCurrency(interestRemaining(loan))} color="text-muted" />
            </div>
          </div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-3 gap-3">
          <InfoCard icon={<DollarSign className="w-3.5 h-3.5" />} label="Amount" value={formatCurrency(loan.totalAmount)} />
          <InfoCard icon={<DollarSign className="w-3.5 h-3.5" />} label="Monthly" value={formatCurrency(loan.monthlyPayment)} highlightColor={color} />
          <InfoCard icon={<CheckCircle className="w-3.5 h-3.5" />} label="Paid" value={`${loan.monthsPaid}/${loan.durationMonths}`} />
          <InfoCard icon={<Calendar className="w-3.5 h-3.5" />} label="Start" value={new Date(loan.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} />
          <InfoCard icon={<Calendar className="w-3.5 h-3.5" />} label="End" value={new Date(end).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} />
          <InfoCard icon={<PiggyBank className="w-3.5 h-3.5" />} label="Total Paid" value={formatCurrency(loan.totalPaid)} highlightColor={color} />
        </div>

        {/* Repayment schedule */}
        <div className="bg-card rounded-2xl border border-themed transition-colors overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <h3 className="font-semibold text-primary text-[14px] tracking-tight">Repayment Schedule</h3>
          </div>
          <div className="max-h-[360px] overflow-y-auto custom-scroll">
            {schedule.map((p) => {
              const isPaid = p.month <= loan.monthsPaid
              const isNext = p.month === loan.monthsPaid + 1
              return (
                <div
                  key={p.month}
                  className="px-4 py-3 flex items-start gap-3 border-t border-divider transition-colors"
                  style={isNext ? { backgroundColor: `${color}08` } : undefined}
                >
                  <div className="pt-0.5">
                    {isPaid ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : isNext ? (
                      <CircleDot className="w-4 h-4" style={{ color }} />
                    ) : (
                      <Clock className="w-4 h-4 text-muted" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-primary">
                        {p.month}/{loan.durationMonths}
                      </span>
                      <span className="text-[13px] font-bold text-primary">{formatCurrency(p.payment)}</span>
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
                    className={`text-[10px] font-semibold mt-0.5 shrink-0 px-2 py-[2px] rounded-md ${
                      isPaid
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : !isNext
                          ? 'bg-subtle text-muted'
                          : ''
                    }`}
                    style={isNext ? { backgroundColor: `${color}12`, color } : undefined}
                  >
                    {isPaid ? 'Paid' : isNext ? 'Next' : 'Due'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* CTA */}
        {!fullyPaid && (
          <button
            onClick={() => setShowConfirm('pay')}
            className="w-full text-white font-semibold py-4 rounded-2xl active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 text-[15px] tracking-tight hover:opacity-90"
            style={{ backgroundColor: color }}
          >
            Mark as Paid
          </button>
        )}

        {fullyPaid && (
          <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold py-4 rounded-2xl text-center text-[15px] border border-emerald-500/15">
            Fully Paid
          </div>
        )}
      </div>

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
          <div className="bg-card rounded-2xl p-5 max-w-[320px] w-full border border-themed transition-colors animate-scale-in">
            <h3 className="font-bold text-primary text-[17px] tracking-tight mb-1.5">
              {showConfirm === 'pay' ? 'Confirm Payment' : 'Delete Loan'}
            </h3>
            {showConfirm === 'pay' ? (
              <div className="text-[13px] text-secondary mb-5 space-y-1">
                <p>Mark payment {loan.monthsPaid + 1}/{loan.durationMonths} of {formatCurrency(loan.monthlyPayment)} as paid?</p>
                {hasInterest && schedule[loan.monthsPaid] && (
                  <p className="text-[12px] text-muted">
                    {formatCurrency(schedule[loan.monthsPaid].principal)} principal + {formatCurrency(schedule[loan.monthsPaid].interest)} interest
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-secondary mb-5">
                Delete "{loan.name}"? This cannot be undone.
              </p>
            )}
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 py-2.5 rounded-xl bg-subtle text-secondary font-semibold text-[14px] hover:opacity-80 transition-opacity"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showConfirm === 'pay') onMarkPaid()
                  else onDelete()
                  setShowConfirm(null)
                }}
                className="flex-1 py-2.5 rounded-xl font-semibold text-[14px] text-white hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: showConfirm === 'pay' ? color : '#EF4444',
                }}
              >
                {showConfirm === 'pay' ? 'Confirm' : 'Delete'}
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
      <p className="text-[11px] font-medium text-muted uppercase tracking-wider mb-0.5">{label}</p>
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
    <div className="bg-card rounded-2xl p-3 border border-themed transition-colors">
      <div className="flex items-center gap-1 text-muted mb-1">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide whitespace-nowrap">{label}</span>
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
