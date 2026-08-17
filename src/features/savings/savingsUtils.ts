import type { SavingsGoal } from './savingsTypes'

export function progress(goal: SavingsGoal): number {
  if (goal.targetAmount <= 0) return 0
  return Math.min(1, goal.currentAmount / goal.targetAmount)
}

export function progressPercent(goal: SavingsGoal): number {
  return Math.round(progress(goal) * 100)
}

export function isGoalReached(goal: SavingsGoal): boolean {
  return goal.targetAmount > 0 && goal.currentAmount >= goal.targetAmount
}
