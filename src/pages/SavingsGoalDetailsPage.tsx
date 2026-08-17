import { useParams, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useSavingsStore } from '../features/savings/savingsStore'
import SavingsGoalDetails from '../features/savings/SavingsGoalDetails'
import EmptyState from '../components/EmptyState'

export default function SavingsGoalDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { goals, deleteGoal } = useSavingsStore()
  const goal = goals.find((g) => g.id === id)

  if (!goal) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center transition-colors duration-300">
        <EmptyState icon={Search} title="Goal not found" subtitle="This goal may have been deleted, or the link is invalid">
          <button
            onClick={() => navigate('/savings')}
            className="bg-brand text-on-brand text-[13px] font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity active:scale-95"
          >
            Back to savings
          </button>
        </EmptyState>
      </div>
    )
  }

  return (
    <SavingsGoalDetails
      goal={goal}
      onDelete={() => {
        deleteGoal(goal.id)
        navigate('/savings')
      }}
      onBack={() => navigate(-1)}
    />
  )
}
