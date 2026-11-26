import { Receipt } from 'lucide-react'
import type { ModuleDef } from '../../core/modules/types'
import QuickAddBill from './QuickAddBill'
import { billDeadlines } from './billDeadlines'

export const billsModule: ModuleDef = {
  id: 'bills',
  nav: [{ path: '/bills', label: 'Bills', description: 'Track your monthly bills', icon: Receipt, group: 'money' }],
  quickAdd: [{ id: 'bill', label: 'Bill', icon: Receipt, Form: QuickAddBill }],
  contextAdd: [{ path: '/bills', actionId: 'bill' }],
  deadlines: billDeadlines,
}
