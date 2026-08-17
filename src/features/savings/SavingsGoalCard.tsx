import { useNavigate } from 'react-router-dom'
import type { SavingsGoal } from './savingsTypes'
import { DEFAULT_COLOR } from '../loans/loanTypes'
import { progressPercent } from './savingsUtils'
import CurrencyAmount from '../../components/CurrencyAmount'

type Props = { goal: SavingsGoal }

export default function SavingsGoalCard({ goal }: Props) {
  const navigate = useNavigate()
  const color = goal.color || DEFAULT_COLOR
  const pct = progressPercent(goal)

  return (
    <button
      onClick={() => navigate(`/savings/${goal.id}`)}
      className="w-full bg-card rounded-2xl p-4 border border-themed text-left transition-all duration-200 active:scale-[0.97] hover:bg-card-hover group"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-10 h-10 rounded-[13px] flex items-center justify-center text-[14px] font-bold text-white shrink-0"
          style={{ backgroundColor: color }}
        >
          {goal.name.charAt(0).toUpperCase()}
        </div>
        <h3 className="font-semibold text-primary text-[15px] leading-tight tracking-tight flex-1 min-w-0 truncate">{goal.name}</h3>
      </div>

      <div className="flex justify-between items-end mb-3">
        <p className="text-[20px] font-bold font-mono tracking-tight leading-none" style={{ color }}>
          <CurrencyAmount value={goal.currentAmount} />
        </p>
        <p className="text-[12px] text-muted">
          of <CurrencyAmount value={goal.targetAmount} />
        </p>
      </div>

      <div className="w-full h-[6px] rounded-full overflow-hidden mb-2" style={{ backgroundColor: `${color}15` }}>
        <div
          className="h-[6px] rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.max(pct, 2)}%`, background: `linear-gradient(90deg, ${color}, ${color}dd)` }}
        />
      </div>
      <span className="text-[11px] font-semibold" style={{ color }}>{pct}% saved</span>
    </button>
  )
}
