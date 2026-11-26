import { PiggyBank } from 'lucide-react'
import type { ModuleDef } from '../../core/modules/types'
import SavingsWidget from '../home/SavingsWidget'
import QuickAddGoal from './QuickAddGoal'

export const savingsModule: ModuleDef = {
  id: 'savings',
  nav: [{ path: '/savings', label: 'Savings', description: 'Track your savings goals', icon: PiggyBank, group: 'money' }],
  quickAdd: [{ id: 'goal', label: 'Savings goal', icon: PiggyBank, Form: QuickAddGoal }],
  contextAdd: [{ path: '/savings', actionId: 'goal' }],
  widgets: [{ id: 'savings', title: 'Savings', defaultPosition: 40, Component: SavingsWidget }],
}
