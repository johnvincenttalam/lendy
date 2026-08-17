import { useMemo, useState } from 'react'
import { PiggyBank, Archive } from 'lucide-react'
import { useSavingsStore } from '../features/savings/savingsStore'
import SavingsGoalCard from '../features/savings/SavingsGoalCard'
import EmptyState from '../components/EmptyState'
import CurrencyAmount from '../components/CurrencyAmount'
import { BRAND_GRADIENT } from '../constants/styles'

export default function SavingsPage() {
  const { goals } = useSavingsStore()
  const [showArchived, setShowArchived] = useState(false)

  const { activeGoals, archivedGoals } = useMemo(() => ({
    activeGoals: goals.filter((g) => !g.archived),
    archivedGoals: goals.filter((g) => g.archived),
  }), [goals])

  const totalSaved = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0)
  const visible = showArchived ? archivedGoals : activeGoals

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <div style={{ background: BRAND_GRADIENT }}>
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-5">
          <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight">Savings</h1>
          <p className="text-[12px] text-white/55 font-medium mb-4">
            {activeGoals.length} active {activeGoals.length === 1 ? 'goal' : 'goals'}
          </p>

          <div className="rounded-2xl p-4 bg-white/[0.13] backdrop-blur-sm border border-white/[0.12]">
            <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Total Saved</span>
            <p className="text-[28px] font-bold font-mono text-white tracking-tight mt-1">
              <CurrencyAmount value={totalSaved} />
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 pt-3 pb-28">
        {archivedGoals.length > 0 && (
          <div className="flex mb-3">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${
                showArchived ? 'bg-brand text-on-brand' : 'bg-subtle text-secondary hover:opacity-80'
              }`}
            >
              <Archive className="w-3 h-3" />
              Archived ({archivedGoals.length})
            </button>
          </div>
        )}

        <div className={visible.length === 0 ? '' : 'space-y-3'}>
          {visible.length === 0 ? (
            <EmptyState
              icon={PiggyBank}
              title={showArchived ? 'No archived goals' : 'No savings goals yet'}
              subtitle={showArchived ? undefined : 'Add a goal to start setting money aside'}
            >
              {!showArchived && (
                <p className="text-[13px] text-muted">Tap <span className="text-brand font-semibold">+</span> below to get started</p>
              )}
            </EmptyState>
          ) : (
            visible.map((goal) => <SavingsGoalCard key={goal.id} goal={goal} />)
          )}
        </div>
      </div>
    </div>
  )
}
