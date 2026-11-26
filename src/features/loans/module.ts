import { CreditCard } from 'lucide-react'
import type { ModuleDef } from '../../core/modules/types'
import MoneySummaryWidget from '../home/MoneySummaryWidget'
import LoansWidget from './LoansWidget'
import QuickAddLoan from './QuickAddLoan'
import { loanDeadlines } from './loanDeadlines'

export const loansModule: ModuleDef = {
  id: 'loans',
  quickAdd: [{ id: 'loan', label: 'Loan', icon: CreditCard, Form: QuickAddLoan }],
  // A loan added inside the private folder belongs in it.
  contextAdd: [{ path: '/private', actionId: 'loan', privateLoan: true }],
  widgets: [
    { id: 'money-summary', title: 'Money summary', defaultPosition: 20, Component: MoneySummaryWidget },
    { id: 'loans', title: 'Your loans', defaultPosition: 50, Component: LoansWidget },
  ],
  deadlines: loanDeadlines,
}
