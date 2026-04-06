import { Wallet, CreditCard, CalendarCheck, TrendingUp, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '../features/loans/loanUtils'
import { BRAND_GRADIENT } from '../constants/styles'
import ThemeToggle from './ThemeToggle'

type Props = {
  totalDebt: number
  totalMonthly: number
  loanCount: number
  totalInterest: number
  debtFreeDate: Date | null
  debtToIncome: number
  hasIncome: boolean
  overdueCount?: number
  overdueAmount?: number
}

export default function SummaryHeader({
  totalDebt,
  totalMonthly,
  loanCount,
  totalInterest,
  debtFreeDate,
  debtToIncome,
  hasIncome,
  overdueCount = 0,
  overdueAmount = 0,
}: Props) {
  const dtiPercent = Math.round(debtToIncome * 100)
  const dtiColor =
    dtiPercent > 50 ? 'text-red-300' : dtiPercent > 30 ? 'text-amber-300' : 'text-emerald-300'

  return (
    <div
      className="relative transition-colors duration-300"
      style={{ background: BRAND_GRADIENT }}
    >
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <div className="relative max-w-2xl mx-auto px-4 pt-5 pb-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}lendy.png`} alt="Lendy" className="w-10 h-10 rounded-[13px]" />
            <div>
              <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight">Lendy</h1>
              <p className="text-[12px] text-white/55 font-medium">
                {loanCount} active {loanCount === 1 ? 'loan' : 'loans'}
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {overdueCount > 0 && (
          <div className="mb-4 rounded-xl bg-red-500/90 backdrop-blur-sm border border-red-400/30 p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-white">
                {overdueCount} overdue {overdueCount === 1 ? 'payment' : 'payments'}
              </p>
              <p className="text-[11px] text-white/70">
                {formatCurrency(overdueAmount)} total due
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4 bg-white/[0.13] backdrop-blur-sm border border-white/[0.12]">
            <div className="flex items-center gap-1.5 mb-2.5">
              <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center">
                <Wallet className="w-3.5 h-3.5 text-white/90" />
              </div>
              <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Debt</span>
            </div>
            <p className="text-[22px] font-bold text-white tracking-tight">{formatCurrency(totalDebt)}</p>
          </div>
          <div className="rounded-2xl p-4 bg-white/[0.13] backdrop-blur-sm border border-white/[0.12]">
            <div className="flex items-center gap-1.5 mb-2.5">
              <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-white/90" />
              </div>
              <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Monthly</span>
            </div>
            <p className="text-[22px] font-bold text-white tracking-tight">{formatCurrency(totalMonthly)}</p>
          </div>
        </div>

        {/* Extra stats row */}
        {loanCount > 0 && (
          <div className={`grid ${hasIncome ? 'grid-cols-3' : 'grid-cols-2'} gap-2.5 mt-3`}>
            <div className="rounded-xl p-2.5 bg-white/[0.08] border border-white/[0.06]">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="w-3 h-3 text-white/50" />
                <span className="text-[10px] font-medium text-white/45 uppercase tracking-wider">Interest</span>
              </div>
              <p className="text-[14px] font-bold text-white tracking-tight">{formatCurrency(totalInterest)}</p>
            </div>
            <div className="rounded-xl p-2.5 bg-white/[0.08] border border-white/[0.06]">
              <div className="flex items-center gap-1 mb-1">
                <CalendarCheck className="w-3 h-3 text-white/50" />
                <span className="text-[10px] font-medium text-white/45 uppercase tracking-wider">Debt-free</span>
              </div>
              <p className="text-[14px] font-bold text-white tracking-tight">
                {debtFreeDate
                  ? debtFreeDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : 'Now'}
              </p>
            </div>
            {hasIncome && (
              <div className="rounded-xl p-2.5 bg-white/[0.08] border border-white/[0.06]">
                <div className="flex items-center gap-1 mb-1">
                  <Wallet className="w-3 h-3 text-white/50" />
                  <span className="text-[10px] font-medium text-white/45 uppercase tracking-wider">DTI</span>
                </div>
                <p className={`text-[14px] font-bold tracking-tight ${dtiColor}`}>
                  {dtiPercent}%
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
