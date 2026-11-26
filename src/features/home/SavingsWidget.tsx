import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, PiggyBank } from 'lucide-react'
import { useSavingsStore } from '../savings/savingsStore'
import { isGoalReached, progressPercent } from '../savings/savingsUtils'
import CurrencyAmount from '../../components/CurrencyAmount'
import ProgressBar from '../../components/ProgressBar'

/** Total saved against total targets, and the goal nearest its target. Hidden with no goals. */
export default function SavingsWidget() {
  const goals = useSavingsStore((s) => s.goals)
  const navigate = useNavigate()
  const active = useMemo(() => goals.filter((g) => !g.archived), [goals])
  if (active.length === 0) return null

  const saved = active.reduce((sum, g) => sum + g.currentAmount, 0)
  const target = active.reduce((sum, g) => sum + g.targetAmount, 0)
  const percent = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0
  const closest = active
    .filter((g) => !isGoalReached(g))
    .sort((a, b) => progressPercent(b) - progressPercent(a))[0]

  return (
    <section aria-labelledby="savings-title" className="rounded-3xl bg-card p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 id="savings-title" className="flex items-center gap-1.5 text-[17px] font-extrabold text-primary tracking-tight">
          <PiggyBank className="w-4 h-4 text-brand" strokeWidth={2.5} /> Savings
        </h2>
        <button
          type="button"
          onClick={() => navigate('/savings')}
          className="flex items-center gap-0.5 text-[13px] font-bold text-brand hover:opacity-80 transition-opacity"
        >
          View <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-[15px] text-secondary">
        <span className="text-[22px] font-extrabold font-display tabular-nums text-primary"><CurrencyAmount value={saved} /></span>
        {' '}saved of <CurrencyAmount value={target} />
      </p>
      <ProgressBar value={percent} label="Saved" size="md" className="mt-3" />
      <p className="text-[13px] text-muted mt-2.5">
        {closest
          ? <>Closest: <span className="font-semibold text-primary">{closest.name}</span> at {progressPercent(closest)}%</>
          : 'Every goal reached. Well done!'}
      </p>
    </section>
  )
}
