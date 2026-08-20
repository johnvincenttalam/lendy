import { useState, useRef, useCallback } from 'react'
import { X, RotateCcw, AlertTriangle } from 'lucide-react'
import type { Loan, LoanFormData } from './loanTypes'
import { LOAN_TAGS, DEFAULT_COLOR } from './loanTypes'
import { offScheduleAmount, suggestedMonthlyPayment } from './loanUtils'
import ColorPicker from '../../components/ColorPicker'
import CurrencyAmount from '../../components/CurrencyAmount'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

type Props = {
  onSubmit: (data: LoanFormData) => void
  onClose: () => void
  initial?: Loan
}

export default function LoanForm({ onSubmit, onClose, initial }: Props) {
  const isEdit = !!initial
  const [mode, setMode] = useState<'standard' | 'installment'>(
    initial && initial.interestRate === 0 ? 'installment' : 'standard'
  )
  const isInstallment = mode === 'installment'
  useBodyScrollLock(true)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef<number | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragStartY.current = clientY
    setIsDragging(true)
  }, [])

  const handleDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (dragStartY.current === null) return
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const delta = Math.max(0, clientY - dragStartY.current)
    setDragY(delta)
  }, [])

  const handleDragEnd = useCallback(() => {
    if (dragY > 120) {
      onClose()
    } else {
      setDragY(0)
    }
    dragStartY.current = null
    setIsDragging(false)
  }, [dragY, onClose])

  const [name, setName] = useState(initial?.name ?? '')
  const [tag, setTag] = useState(initial?.tag ?? '')
  const [color, setColor] = useState(initial?.color ?? DEFAULT_COLOR)
  const [totalAmount, setTotalAmount] = useState(initial ? String(initial.totalAmount) : '')
  const [interestRate, setInterestRate] = useState(initial ? String(initial.interestRate) : '')
  const [monthlyPayment, setMonthlyPayment] = useState(initial ? String(initial.monthlyPayment) : '')
  // In standard mode the monthly is derived from amount/rate/tenure. It only stops
  // tracking them once the user types their own figure — or arrives already off
  // schedule, in which case we preserve what they recorded rather than rewriting it.
  const [monthlyOverridden, setMonthlyOverridden] = useState(
    () => !!initial && initial.interestRate !== 0 && offScheduleAmount(initial) !== null
  )
  const [durationMonths, setDurationMonths] = useState(initial ? String(initial.durationMonths) : '')
  const [startDate, setStartDate] = useState(initial?.startDate ?? new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function clearError(field: string) {
    setErrors((prev) => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const months = Number(durationMonths) || 0
  const typedMonthly = Number(monthlyPayment) || 0
  const amt = isInstallment ? typedMonthly * months : Number(totalAmount) || 0
  const rate = isInstallment ? 0 : Number(interestRate) || 0
  const canAutoCalc = amt > 0 && months > 0

  const suggested = suggestedMonthlyPayment(amt, rate, months)
  const derived = Math.round(suggested * 100) / 100
  const derivedStr = canAutoCalc && derived > 0 ? derived.toFixed(2) : ''

  // Standard mode shows the derived figure until the user overrides it; installment
  // mode keeps the monthly as a real input, since there it drives the total instead.
  const monthlyValue = isInstallment || monthlyOverridden ? monthlyPayment : derivedStr
  const monthly = isInstallment ? typedMonthly : Number(monthlyValue) || 0
  const offSchedule =
    !isInstallment && monthlyOverridden && canAutoCalc && derived > 0 && Math.abs(monthly - derived) > 0.005

  const totalInterest = amt * (rate / 100) * months
  const totalCost = amt + totalInterest

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Name is required'
    if (!isInstallment && (!totalAmount || amt <= 0)) newErrors.totalAmount = 'Enter a valid amount'
    if (!isInstallment && interestRate !== '' && Number(interestRate) < 0) newErrors.interestRate = 'Cannot be negative'
    if (isInstallment) {
      if (!monthlyPayment || monthly <= 0) newErrors.monthlyPayment = 'Enter a valid payment'
    } else if (monthlyOverridden && monthly <= 0) {
      newErrors.monthlyPayment = 'Enter a valid payment'
    }
    if (!durationMonths || months <= 0) newErrors.durationMonths = 'Enter valid duration'
    else if (isEdit && initial && months < initial.monthsPaid) newErrors.durationMonths = `Min ${initial.monthsPaid} (already paid)`
    if (!startDate) newErrors.startDate = 'Required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      name: name.trim(),
      color,
      tag: tag || undefined,
      notes: notes.trim() || undefined,
      totalAmount: isInstallment ? monthly * months : amt,
      interestRate: isInstallment ? 0 : rate,
      monthlyPayment: monthly,
      durationMonths: months,
      startDate,
    })
  }

  return (
    <div
      className="fixed inset-0 bg-overlay z-50 flex items-end sm:items-center justify-center animate-fade-in"
    >
      <div
        ref={sheetRef}
        className="bg-card w-full h-full sm:h-auto sm:max-w-lg sm:rounded-2xl rounded-none sm:max-h-[92vh] overflow-y-auto border-0 sm:border border-themed animate-slide-up custom-scroll"
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Handle bar - draggable */}
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

        <div className="sticky top-0 z-10 bg-card flex items-center justify-between px-5 pt-3 pb-4 sm:static sm:pt-5 sm:border-b-0 border-b border-divider">
          <h2 className="text-[20px] font-bold text-primary tracking-tight">{isEdit ? 'Edit Loan' : 'New Loan'}</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center hover:opacity-60 transition-opacity">
            <X className="w-[18px] h-[18px] text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4">
          {/* Mode toggle */}
          <div className="flex rounded-xl bg-subtle p-1 gap-1">
            <button
              type="button"
              onClick={() => { setMode('standard'); setMonthlyOverridden(false); setErrors({}) }}
              aria-pressed={!isInstallment}
              className={`flex-1 py-2 rounded-lg text-[12px] font-semibold tracking-tight transition-all ${
                !isInstallment ? 'bg-card text-primary' : 'text-muted hover:text-secondary'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => { setMode('installment'); setMonthlyPayment((v) => v || derivedStr); setErrors({}) }}
              aria-pressed={isInstallment}
              className={`flex-1 py-2 rounded-lg text-[12px] font-semibold tracking-tight transition-all ${
                isInstallment ? 'bg-card text-primary' : 'text-muted hover:text-secondary'
              }`}
            >
              Installment
            </button>
          </div>

          {isInstallment && (
            <p className="text-[11px] text-muted">
              For gadget loans or installments where the monthly payment already includes interest.
            </p>
          )}

          <Field label="Loan Name" id="loan-name" error={errors.name}>
            <input
              id="loan-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); clearError('name') }}
              placeholder={isInstallment ? 'e.g. iPhone 16' : 'e.g. Cash Loan'}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'loan-name-error' : undefined}
              className="input-field"
            />
          </Field>

          <Field label="Tag">
            <div className="flex flex-wrap gap-1.5">
              {LOAN_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(tag === t ? '' : t)}
                  aria-pressed={tag === t}
                  className={`text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all ${
                    tag === t
                      ? 'text-white'
                      : 'bg-subtle text-secondary hover:opacity-80'
                  }`}
                  style={tag === t ? { backgroundColor: color } : undefined}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Color">
            <ColorPicker value={color} onChange={setColor} />
          </Field>

          {isInstallment ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monthly (₱)" id="loan-monthly" error={errors.monthlyPayment}>
                <input
                  id="loan-monthly"
                  type="number"
                  step="0.01"
                  value={monthlyPayment}
                  onChange={(e) => { setMonthlyPayment(e.target.value); clearError('monthlyPayment') }}
                  inputMode="decimal" placeholder="2,200"
                  aria-invalid={!!errors.monthlyPayment}
                  aria-describedby={errors.monthlyPayment ? 'loan-monthly-error' : undefined}
                  className="input-field"
                />
              </Field>
              <Field label="Tenure (months)" id="loan-duration" error={errors.durationMonths}>
                <input
                  id="loan-duration"
                  type="number"
                  value={durationMonths}
                  onChange={(e) => { setDurationMonths(e.target.value); clearError('durationMonths') }}
                  inputMode="numeric" placeholder="6"
                  aria-invalid={!!errors.durationMonths}
                  aria-describedby={errors.durationMonths ? 'loan-duration-error' : undefined}
                  className="input-field"
                />
              </Field>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (₱)" id="loan-amount" error={errors.totalAmount}>
                  <input
                    id="loan-amount"
                    type="number"
                    value={totalAmount}
                    onChange={(e) => { setTotalAmount(e.target.value); clearError('totalAmount') }}
                    inputMode="decimal" placeholder="2,500"
                    aria-invalid={!!errors.totalAmount}
                    aria-describedby={errors.totalAmount ? 'loan-amount-error' : undefined}
                    className="input-field"
                  />
                </Field>
                <Field label="Interest (%/mo)" id="loan-interest" error={errors.interestRate}>
                  <input
                    id="loan-interest"
                    type="number"
                    step="0.01"
                    value={interestRate}
                    onChange={(e) => { setInterestRate(e.target.value); clearError('interestRate') }}
                    inputMode="decimal" placeholder="4.95"
                    aria-invalid={!!errors.interestRate}
                    aria-describedby={errors.interestRate ? 'loan-interest-error' : undefined}
                    className="input-field"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Tenure (months)" id="loan-duration" error={errors.durationMonths}>
                  <input
                    id="loan-duration"
                    type="number"
                    value={durationMonths}
                    onChange={(e) => { setDurationMonths(e.target.value); clearError('durationMonths') }}
                    inputMode="numeric" placeholder="6"
                    aria-invalid={!!errors.durationMonths}
                    aria-describedby={errors.durationMonths ? 'loan-duration-error' : undefined}
                    className="input-field"
                  />
                </Field>
                <Field label="Monthly (₱)" id="loan-monthly" error={errors.monthlyPayment}>
                  <div className="flex gap-1.5">
                    <input
                      id="loan-monthly"
                      type="number"
                      step="0.01"
                      value={monthlyValue}
                      onChange={(e) => {
                        setMonthlyOverridden(true)
                        setMonthlyPayment(e.target.value)
                        clearError('monthlyPayment')
                      }}
                      inputMode="decimal" placeholder="540.41"
                      aria-invalid={!!errors.monthlyPayment}
                      aria-describedby={
                        errors.monthlyPayment
                          ? 'loan-monthly-error'
                          : offSchedule
                            ? 'loan-monthly-hint'
                            : undefined
                      }
                      className="input-field"
                    />
                    {monthlyOverridden && derivedStr && (
                      <button
                        type="button"
                        onClick={() => {
                          setMonthlyOverridden(false)
                          setMonthlyPayment('')
                          clearError('monthlyPayment')
                        }}
                        className="shrink-0 w-10 flex items-center justify-center hover:opacity-60 transition-opacity"
                        title="Reset to the computed payment"
                        aria-label="Reset to the computed monthly payment"
                      >
                        <RotateCcw className="w-4 h-4" style={{ color }} />
                      </button>
                    )}
                  </div>
                  {!errors.monthlyPayment && offSchedule && (
                    <p id="loan-monthly-hint" className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 mt-[2px] shrink-0" />
                      <span>
                        Off schedule — computed is <CurrencyAmount value={derived} />
                      </span>
                    </p>
                  )}
                  {!errors.monthlyPayment && !offSchedule && canAutoCalc && (
                    <p className="text-[11px] text-muted mt-1">Computed from amount, rate &amp; tenure</p>
                  )}
                </Field>
              </div>
            </>
          )}

          <Field label="Start Date" id="loan-start-date" error={errors.startDate}>
            <input
              id="loan-start-date"
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); clearError('startDate') }}
              aria-invalid={!!errors.startDate}
              aria-describedby={errors.startDate ? 'loan-start-date-error' : undefined}
              className="input-field"
            />
          </Field>

          <Field label="Notes" id="loan-notes">
            <textarea
              id="loan-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What's this loan for? (optional)"
              maxLength={300}
              rows={3}
              className="input-field resize-none"
            />
          </Field>

          {canAutoCalc && (
            <div
              className="rounded-2xl p-3.5 space-y-2 border"
              style={{ borderColor: `${color}20`, backgroundColor: `${color}08` }}
            >
              {isInstallment && (
                <>
                  <Row label="Total amount">
                    <span className="font-semibold text-primary text-[13px]"><CurrencyAmount value={monthly * months} /></span>
                  </Row>
                  <div className="h-px border-t border-divider" />
                </>
              )}
              <Row label="End date">
                <span className="font-semibold text-[13px]" style={{ color }}>
                  {(() => {
                    const d = new Date(startDate)
                    d.setMonth(d.getMonth() + months)
                    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                  })()}
                </span>
              </Row>
              {rate > 0 && (
                <>
                  <div className="h-px border-t border-divider" />
                  <Row label="Total interest">
                    <span className="font-semibold text-red-500 dark:text-red-400 text-[13px]"><CurrencyAmount value={totalInterest} /></span>
                  </Row>
                  <div className="h-px border-t border-divider" />
                  <Row label="Total repayment">
                    <span className="font-semibold text-primary text-[13px]"><CurrencyAmount value={totalCost} /></span>
                  </Row>
                </>
              )}
            </div>
          )}

          <button
            type="submit"
            className="w-full text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all duration-200 text-[15px] tracking-tight hover:opacity-90"
            style={{ backgroundColor: color }}
          >
            {isEdit ? 'Save Changes' : 'Add Loan'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[13px] text-secondary">{label}</span>
      {children}
    </div>
  )
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string
  id?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">{label}</label>
      <div className={error ? 'rounded-[14px] ring-2 ring-red-500/50' : undefined}>{children}</div>
      {error && <p id={id ? `${id}-error` : undefined} className="text-[11px] text-red-500 dark:text-red-400 mt-1 font-medium">{error}</p>}
    </div>
  )
}
