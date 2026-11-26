import SavingsGoalForm from './SavingsGoalForm'
import { useSavingsStore } from './savingsStore'

export default function QuickAddGoal({ onClose }: { onClose: () => void }) {
  const addGoal = useSavingsStore((s) => s.addGoal)
  return (
    <SavingsGoalForm
      onSubmit={(data) => {
        addGoal(data)
        onClose()
      }}
      onClose={onClose}
    />
  )
}
