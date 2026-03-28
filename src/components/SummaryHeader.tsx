import { Wallet, CreditCard, CalendarCheck, TrendingUp } from 'lucide-react'
import { formatCurrency } from '../features/loans/loanUtils'
import ThemeToggle from './ThemeToggle'

type Props = {
  totalDebt: number
  totalMonthly: number
  loanCount: number
  totalInterest: number
  debtFreeDate: Date | null
  debtToIncome: number
  hasIncome: boolean
}

export default function SummaryHeader({
  totalDebt,
  totalMonthly,
  loanCount,
  totalInterest,
  debtFreeDate,
  debtToIncome,
  hasIncome,
}: Props) {
  const dtiPercent = Math.round(debtToIncome * 100)
  const dtiColor =
    dtiPercent > 50 ? 'text-red-300' : dtiPercent > 30 ? 'text-amber-300' : 'text-emerald-300'

  return (
    <div className="bg-brand sticky top-0 z-10 transition-colors duration-300">
      <div className="max-w-2xl mx-auto px-3 pt-5 pb-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <img src="/lendy.png" alt="Lendy" className="w-9 h-9 rounded-xl" />
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight leading-tight">Lendy</h1>
              <p className="text-[12px] text-white/60">
                {loanCount} active {loanCount === 1 ? 'loan' : 'loans'}
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-3.5 bg-white/15 border border-white/10">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center">
                <Wallet className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">Debt</span>
            </div>
            <p className="text-xl font-bold text-white tracking-tight">{formatCurrency(totalDebt)}</p>
          </div>
          <div className="rounded-2xl p-3.5 bg-white/15 border border-white/10">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">Monthly</span>
            </div>
            <p className="text-xl font-bold text-white tracking-tight">{formatCurrency(totalMonthly)}</p>
          </div>
        </div>

        {/* Extra stats row */}
        {loanCount > 0 && (
          <div className={`grid ${hasIncome ? 'grid-cols-3' : 'grid-cols-2'} gap-3 mt-3`}>
            <div className="rounded-xl p-2.5 bg-white/10 border border-white/5">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="w-3 h-3 text-white/60" />
                <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Interest</span>
              </div>
              <p className="text-[14px] font-bold text-white tracking-tight">{formatCurrency(totalInterest)}</p>
            </div>
            <div className="rounded-xl p-2.5 bg-white/10 border border-white/5">
              <div className="flex items-center gap-1 mb-1">
                <CalendarCheck className="w-3 h-3 text-white/60" />
                <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Debt-free</span>
              </div>
              <p className="text-[14px] font-bold text-white tracking-tight">
                {debtFreeDate
                  ? debtFreeDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : 'Now'}
              </p>
            </div>
            {hasIncome && (
              <div className="rounded-xl p-2.5 bg-white/10 border border-white/5">
                <div className="flex items-center gap-1 mb-1">
                  <Wallet className="w-3 h-3 text-white/60" />
                  <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">DTI</span>
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
