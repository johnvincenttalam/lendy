import { create } from 'zustand'
import type { SavingsGoal, SavingsGoalFormData, SavingsTransaction } from './savingsTypes'
import { isGoalReached } from './savingsUtils'
import { showToast } from '../../components/Toast'
import { triggerConfetti } from '../../components/Confetti'

const GOALS_KEY = 'loan-tracker-savings-goals'
const TRANSACTIONS_KEY = 'loan-tracker-savings-transactions'

function loadGoals(): SavingsGoal[] {
  try {
    const data = localStorage.getItem(GOALS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveGoals(goals: SavingsGoal[]) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals))
}

function loadTransactions(): SavingsTransaction[] {
  try {
    const data = localStorage.getItem(TRANSACTIONS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveTransactions(transactions: SavingsTransaction[]) {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions))
}

type SavingsStore = {
  goals: SavingsGoal[]
  transactions: SavingsTransaction[]
  addGoal: (data: SavingsGoalFormData) => void
  updateGoal: (id: string, data: Partial<SavingsGoalFormData>) => void
  addFunds: (goalId: string, amount: number, note?: string) => void
  withdrawFunds: (goalId: string, amount: number, note?: string) => void
  deleteGoal: (id: string) => void
  archiveGoal: (id: string) => void
  unarchiveGoal: (id: string) => void
  getTransactionsForGoal: (goalId: string) => SavingsTransaction[]
  importBackup: (json: string) => void
}

export const useSavingsStore = create<SavingsStore>((set, get) => ({
  goals: loadGoals(),
  transactions: loadTransactions(),

  addGoal: (data) =>
    set((state) => {
      const newGoal: SavingsGoal = {
        ...data,
        id: crypto.randomUUID(),
        currentAmount: 0,
        createdAt: new Date().toISOString(),
      }
      const goals = [...state.goals, newGoal]
      saveGoals(goals)
      showToast(`"${data.name}" added`)
      return { goals }
    }),

  updateGoal: (id, data) =>
    set((state) => {
      const goals = state.goals.map((goal) => (goal.id === id ? { ...goal, ...data } : goal))
      saveGoals(goals)
      return { goals }
    }),

  addFunds: (goalId, amount, note) =>
    set((state) => {
      let updated = false
      const goals = state.goals.map((goal) => {
        if (goal.id !== goalId) return goal
        updated = true
        const wasReached = isGoalReached(goal)
        const next = { ...goal, currentAmount: Math.round((goal.currentAmount + amount) * 100) / 100 }
        setTimeout(() => {
          if (!wasReached && isGoalReached(next)) {
            triggerConfetti()
            showToast(`"${goal.name}" reached its goal!`)
          } else {
            showToast('Funds added')
          }
        }, 0)
        return next
      })
      const transactions = updated
        ? [...state.transactions, {
            id: crypto.randomUUID(),
            goalId,
            type: 'deposit' as const,
            amount,
            note: note || undefined,
            createdAt: new Date().toISOString(),
          }]
        : state.transactions
      saveGoals(goals)
      saveTransactions(transactions)
      return { goals, transactions }
    }),

  withdrawFunds: (goalId, amount, note) =>
    set((state) => {
      let updated = false
      const goals = state.goals.map((goal) => {
        if (goal.id !== goalId) return goal
        updated = true
        return { ...goal, currentAmount: Math.max(0, Math.round((goal.currentAmount - amount) * 100) / 100) }
      })
      const transactions = updated
        ? [...state.transactions, {
            id: crypto.randomUUID(),
            goalId,
            type: 'withdrawal' as const,
            amount,
            note: note || undefined,
            createdAt: new Date().toISOString(),
          }]
        : state.transactions
      saveGoals(goals)
      saveTransactions(transactions)
      if (updated) showToast('Funds withdrawn')
      return { goals, transactions }
    }),

  deleteGoal: (id) =>
    set((state) => {
      const goal = state.goals.find((g) => g.id === id)
      const goals = state.goals.filter((g) => g.id !== id)
      const transactions = state.transactions.filter((t) => t.goalId !== id)
      saveGoals(goals)
      saveTransactions(transactions)
      if (goal) showToast(`"${goal.name}" deleted`)
      return { goals, transactions }
    }),

  archiveGoal: (id) =>
    set((state) => {
      const goals = state.goals.map((g) => (g.id === id ? { ...g, archived: true } : g))
      saveGoals(goals)
      const goal = goals.find((g) => g.id === id)
      if (goal) showToast(`"${goal.name}" archived`)
      return { goals }
    }),

  unarchiveGoal: (id) =>
    set((state) => {
      const goals = state.goals.map((g) => (g.id === id ? { ...g, archived: false } : g))
      saveGoals(goals)
      const goal = goals.find((g) => g.id === id)
      if (goal) showToast(`"${goal.name}" restored`)
      return { goals }
    }),

  getTransactionsForGoal: (goalId) => {
    return get().transactions
      .filter((t) => t.goalId === goalId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  importBackup: (json) => {
    try {
      const data = JSON.parse(json)
      if (!Array.isArray(data.savingsGoals)) return
      const goals: SavingsGoal[] = data.savingsGoals
      const transactions: SavingsTransaction[] = Array.isArray(data.savingsTransactions) ? data.savingsTransactions : []
      saveGoals(goals)
      saveTransactions(transactions)
      set({ goals, transactions })
    } catch {
      // Swallow — importAllData (Task 19) already validated the JSON parses.
    }
  },
}))
