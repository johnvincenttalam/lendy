import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, TrendingDown } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import CurrencyAmount from '../components/CurrencyAmount'
import ProgressBar from '../components/ProgressBar'
import OllieCharacter from '../features/ollie/OllieCharacter'
import type { OllieMood } from '../features/ollie/ollieTypes'
import { useLoanStore } from '../features/loans/loanStore'
import { useBillStore } from '../features/bills/billStore'
import { useIncomeStore } from '../features/finance/incomeStore'
import { formatCurrency } from '../features/loans/loanUtils'
import { cashLoanMonthly, checkNewLoan, currentMonthlyPayments, paymentSteps } from '../features/planner/plannerUtils'
import type { NewLoan, NewLoanCheck, Verdict } from '../features/planner/plannerUtils'

type Mode = 'standard' | 'installment'

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const shortDate = (iso: string) => parseISO(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const monthYear = (iso: string) => parseISO(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

const VERDICT: Record<Verdict, { mood: OllieMood; tint: string; bar: string; title: string }> = {
  comfortable: { mood: 'happy', tint: 'var(--tint-teal)', bar: 'var(--color-brand)', title: 'This fits comfortably.' },
  tight: { mood: 'thinking', tint: 'var(--tint-amber)', bar: '#F59E0B', title: "It fits, but it'd be tight." },
  over: { mood: 'alert', tint: 'var(--tint-red)', bar: '#EF4444', title: "I'd hold off on this one for now." },
  'no-income': { mood: 'thinking', tint: 'var(--tint-neutral)', bar: 'var(--color-brand)', title: 'I need your income to judge this.' },
}

function verdictDetail(c: NewLoanCheck): string {
  if (c.verdict === 'no-income') {
    return `It would bring your loan payments to ${formatCurrency(c.newMonthly)} a month. Set your monthly income in Settings and I can tell you whether that fits.`
  }
  const total = `Your loan payments would be ${formatCurrency(c.newMonthly)} a month, ${c.shareAfter}% of your income`
  if (c.verdict !== 'over') return `${total}, ${formatCurrency(c.roomAfter!)} under the comfortable limit of ${formatCurrency(c.limit!)}.`
  const over = `${total}: ${formatCurrency(-c.roomAfter!)} over the comfortable limit of ${formatCurrency(c.limit!)}.`
  if (c.neverFits) return `${over} This payment alone is more than the limit, so a smaller amount or a longer term would be needed.`
  if (c.fitsFrom) return `${over} It would fit from ${monthYear(c.fitsFrom.from)}, once ${c.fitsFrom.loans.join(' and ')} ${c.fitsFrom.loans.length === 1 ? 'is' : 'are'} paid off.`
  return over
}

const num = (s: string) => (s.trim() === '' ? NaN : Number(s))

export default function PlannerPage() {
  const navigate = useNavigate()
  const loans = useLoanStore((s) => s.loans)
  const bills = useBillStore((s) => s.bills)
  const monthlyIncome = useIncomeStore((s) => s.monthlyIncome)

  const [mode, setMode] = useState<Mode>('standard')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('')
  const [months, setMonths] = useState('')
  const [monthly, setMonthly] = useState('')

  const steps = useMemo(() => paymentSteps(loans, new Date()), [loans])
  const current = useMemo(() => currentMonthlyPayments(loans), [loans])

  const newLoan = useMemo((): NewLoan | null => {
    const m = num(months)
    if (!Number.isInteger(m) || m <= 0 || m > 600) return null
    if (mode === 'installment') {
      const pay = num(monthly)
      return pay > 0 ? { monthly: pay, months: m } : null
    }
    const a = num(amount)
    const r = rate.trim() === '' ? 0 : num(rate)
    if (!(a > 0) || !(r >= 0)) return null
    return { monthly: cashLoanMonthly(a, r, m), months: m, amount: a, monthlyRate: r }
  }, [mode, amount, rate, months, monthly])

  const check = useMemo(
    () => (newLoan ? checkNewLoan(loans, bills, monthlyIncome, newLoan, new Date()) : null),
    [newLoan, loans, bills, monthlyIncome],
  )

  const modeButton = (value: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={`flex-1 py-2 rounded-lg text-[12px] font-semibold tracking-tight transition-all ${
        mode === value ? 'bg-card text-primary' : 'text-muted hover:text-secondary'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <PageHeader title="Planner" subtitle="Try a loan before you take it" back />

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-4">
        {/* Try a new loan */}
        <section className="bg-card rounded-2xl border border-themed p-4 space-y-4" aria-labelledby="try-loan">
          <h2 id="try-loan" className="text-[15px] font-bold text-primary tracking-tight">Try a new loan</h2>

          <div className="flex rounded-xl bg-subtle p-1 gap-1">
            {modeButton('standard', 'Standard')}
            {modeButton('installment', 'Installment')}
          </div>
          {mode === 'installment' && (
            <p className="text-[11px] text-muted -mt-2">For gadget loans or installments where the monthly payment already includes interest.</p>
          )}

          {mode === 'standard' ? (
            <div className="grid grid-cols-3 gap-2.5">
              <PlannerField id="plan-amount" label="Amount (₱)">
                <input id="plan-amount" type="number" inputMode="decimal" placeholder="20,000" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field" />
              </PlannerField>
              <PlannerField id="plan-rate" label="Interest (%/mo)">
                <input id="plan-rate" type="number" step="0.01" inputMode="decimal" placeholder="3" value={rate} onChange={(e) => setRate(e.target.value)} className="input-field" />
              </PlannerField>
              <PlannerField id="plan-months" label="Months">
                <input id="plan-months" type="number" inputMode="numeric" placeholder="12" value={months} onChange={(e) => setMonths(e.target.value)} className="input-field" />
              </PlannerField>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <PlannerField id="plan-monthly" label="Monthly (₱)">
                <input id="plan-monthly" type="number" step="0.01" inputMode="decimal" placeholder="1,500" value={monthly} onChange={(e) => setMonthly(e.target.value)} className="input-field" />
              </PlannerField>
              <PlannerField id="plan-months" label="Months">
                <input id="plan-months" type="number" inputMode="numeric" placeholder="12" value={months} onChange={(e) => setMonths(e.target.value)} className="input-field" />
              </PlannerField>
            </div>
          )}

          {!check ? (
            <p className="text-[13px] text-muted">Fill in the loan to see what it would cost and whether it fits.</p>
          ) : (
            <div className="space-y-3.5 animate-fade-in">
              <dl className="grid grid-cols-3 gap-2 text-center">
                <Figure label="Monthly" value={check.monthly} />
                {check.totalInterest !== null ? <Figure label="Interest" value={check.totalInterest} /> : <div />}
                <Figure label="Total to pay" value={check.totalCost} />
              </dl>

              <div aria-live="polite" className="rounded-2xl p-3.5 flex gap-3 items-start" style={{ backgroundColor: VERDICT[check.verdict].tint }}>
                <OllieCharacter mood={VERDICT[check.verdict].mood} sizeClassName="w-[52px]" still />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-primary leading-snug">{VERDICT[check.verdict].title}</p>
                  <p className="text-[13px] text-secondary leading-snug mt-1">{verdictDetail(check)}</p>
                  {check.verdict === 'no-income' && (
                    <button type="button" onClick={() => navigate('/settings')} className="inline-flex items-center gap-1 mt-2 text-[13px] font-extrabold text-brand">
                      Set income <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {check.limit !== null && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[12px] font-semibold">
                    <span className="text-muted">Loan payments with this loan</span>
                    <span className="text-primary tabular-nums"><CurrencyAmount value={check.newMonthly} /> of <CurrencyAmount value={check.limit} /></span>
                  </div>
                  <ProgressBar value={(check.newMonthly / check.limit) * 100} label="Share of the comfortable limit" color={VERDICT[check.verdict].bar} />
                  {check.leftAfterAll !== null && (
                    <p className="text-[12px] text-muted">
                      Left from your income after all loans and bills: <span className={`font-semibold tabular-nums ${check.leftAfterAll < 0 ? 'text-red-500' : 'text-primary'}`}><CurrencyAmount value={check.leftAfterAll} /></span>
                    </p>
                  )}
                </div>
              )}

              {check.totalInterest !== null && (
                <p className="text-[11px] text-muted leading-snug">
                  Worked out with flat interest, like most Philippine lenders: the interest is fixed at the start, so paying early only saves money if your lender gives a rebate.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Payments ahead */}
        <section className="bg-card rounded-2xl border border-themed p-4" aria-labelledby="payments-ahead">
          <h2 id="payments-ahead" className="text-[15px] font-bold text-primary tracking-tight">Payments ahead</h2>
          <p className="text-[12px] text-muted mt-0.5">When your monthly loan payments go down, as each loan finishes.</p>
          {steps.some((s) => s.estimated) && (
            <p className="text-[11.5px] text-muted mt-1">Estimated dates are for loans that are behind: they assume you catch up now and pay monthly from here.</p>
          )}

          {steps.length === 0 ? (
            <p className="text-[13px] text-muted mt-3">No loans being paid right now.</p>
          ) : (
            <ol className="mt-3 space-y-0.5">
              <li className="flex items-center justify-between py-2">
                <span className="text-[13px] font-semibold text-primary">Now</span>
                <span className="text-[14px] font-bold font-display tabular-nums text-primary"><CurrencyAmount value={current} /><span className="text-[11px] text-muted font-semibold">/mo</span></span>
              </li>
              {steps.map((s) => (
                <li key={s.from} className="flex items-center justify-between gap-3 py-2 border-t border-themed">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-primary">From {shortDate(s.from)}</p>
                    <p className="text-[11.5px] text-muted truncate">{s.loans.join(', ')} done · last payment {shortDate(s.lastPayment)}{s.estimated && ' (estimated)'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[14px] font-bold font-display tabular-nums text-primary"><CurrencyAmount value={s.monthlyAfter} /><span className="text-[11px] text-muted font-semibold">/mo</span></p>
                    <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-0.5">
                      <TrendingDown className="w-3 h-3" /> <CurrencyAmount value={s.freed} />
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}

function PlannerField({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[12px] font-semibold text-muted mb-1.5 truncate">{label}</label>
      {children}
    </div>
  )
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-subtle px-2 py-2.5 min-w-0">
      <dt className="text-[11px] font-semibold text-muted">{label}</dt>
      <dd className="text-[14px] font-bold font-display tabular-nums text-primary mt-0.5 truncate"><CurrencyAmount value={value} /></dd>
    </div>
  )
}
