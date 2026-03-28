export type Loan = {
  id: string
  name: string
  color: string
  totalAmount: number
  monthlyPayment: number
  interestRate: number // monthly interest rate (e.g. 4.95 for 4.95%/month)
  durationMonths: number
  startDate: string
  monthsPaid: number
  totalPaid: number
  totalInterestPaid: number
  createdAt: string
}

export type LoanFormData = Omit<Loan, 'id' | 'monthsPaid' | 'totalPaid' | 'totalInterestPaid' | 'createdAt'>

export type PaymentBreakdown = {
  month: number
  date: Date
  payment: number
  principal: number
  interest: number
}

export const LOAN_COLORS = [
  '#F3622D', // brand orange
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#10B981', // emerald
  '#F59E0B', // amber
  '#06B6D4', // cyan
  '#EF4444', // red
  '#6366F1', // indigo
  '#14B8A6', // teal
  '#F97316', // orange
  '#84CC16', // lime
]
