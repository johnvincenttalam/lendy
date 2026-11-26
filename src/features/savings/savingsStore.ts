import { create } from 'zustand'
import type { SavingsGoal, SavingsGoalFormData, SavingsTransaction } from './savingsTypes'
import { isGoalReached } from './savingsUtils'
import { showToast } from '../../components/toastEvents'
import { triggerConfetti } from '../../components/confettiEvents'
import { persist } from '../storage/persist'


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
  /** Fills the store from storage: at start-up, and after a restore or undo. */
  hydrate: (data: { goals: SavingsGoal[]; transactions: SavingsTransaction[] }) => void
}

export const useSavingsStore = create<SavingsStore>((set, get) => ({
  goals: [],
  transactions: [],

  addGoal: (data) =>
    set((state) => {
      const newGoal: SavingsGoal = {
        ...data,
        id: crypto.randomUUID(),
        currentAmount: 0,
        createdAt: new Date().toISOString(),
      }
      const goals = [...state.goals, newGoal]
      persist({ savingsGoals: { next: goals, prev: state.goals } })
      showToast(`"${data.name}" added`)
      return { goals }
    }),

  updateGoal: (id, data) =>
    set((state) => {
      const goals = state.goals.map((goal) => (goal.id === id ? { ...goal, ...data } : goal))
      persist({ savingsGoals: { next: goals, prev: state.goals } })
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
      persist({ savingsGoals: { next: goals, prev: state.goals }, savingsTransactions: { next: transactions, prev: state.transactions } })
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
      persist({ savingsGoals: { next: goals, prev: state.goals }, savingsTransactions: { next: transactions, prev: state.transactions } })
      if (updated) showToast('Funds withdrawn')
      return { goals, transactions }
    }),

  deleteGoal: (id) =>
    set((state) => {
      const goal = state.goals.find((g) => g.id === id)
      const goals = state.goals.filter((g) => g.id !== id)
      const transactions = state.transactions.filter((t) => t.goalId !== id)
      persist({ savingsGoals: { next: goals, prev: state.goals }, savingsTransactions: { next: transactions, prev: state.transactions } })
      if (goal) showToast(`"${goal.name}" deleted`)
      return { goals, transactions }
    }),

  archiveGoal: (id) =>
    set((state) => {
      const goals = state.goals.map((g) => (g.id === id ? { ...g, archived: true } : g))
      persist({ savingsGoals: { next: goals, prev: state.goals } })
      const goal = goals.find((g) => g.id === id)
      if (goal) showToast(`"${goal.name}" archived`)
      return { goals }
    }),

  unarchiveGoal: (id) =>
    set((state) => {
      const goals = state.goals.map((g) => (g.id === id ? { ...g, archived: false } : g))
      persist({ savingsGoals: { next: goals, prev: state.goals } })
      const goal = goals.find((g) => g.id === id)
      if (goal) showToast(`"${goal.name}" restored`)
      return { goals }
    }),

  getTransactionsForGoal: (goalId) => {
    return get().transactions
      .filter((t) => t.goalId === goalId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  hydrate: ({ goals, transactions }) => set({ goals, transactions }),
}))
