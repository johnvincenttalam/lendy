export type SavingsGoal = {
  id: string
  name: string
  color: string
  targetAmount: number
  currentAmount: number
  notes?: string
  createdAt: string
  archived?: boolean
}

export type SavingsTransaction = {
  id: string
  goalId: string
  type: 'deposit' | 'withdrawal'
  amount: number
  note?: string
  createdAt: string
}

export type SavingsGoalFormData = {
  name: string
  color: string
  targetAmount: number
  notes?: string
}
