export type Loan = {
  id: string
  name: string
  color: string
  tag?: string
  totalAmount: number
  monthlyPayment: number
  interestRate: number // monthly interest rate (e.g. 4.95 for 4.95%/month)
  durationMonths: number
  startDate: string
  monthsPaid: number
  totalPaid: number
  totalInterestPaid: number
  createdAt: string
  archived?: boolean
}

export type PaymentRecord = {
  id: string
  loanId: string
  amount: number
  principal: number
  interest: number
  paidAt: string // ISO date string of when user marked it paid
  dueDate: string // the scheduled due date for this payment
  month: number // which month number (1-based) in the loan schedule
}

export type LoanFormData = Omit<Loan, 'id' | 'monthsPaid' | 'totalPaid' | 'totalInterestPaid' | 'createdAt'>

export const LOAN_TAGS = [
  'Gadget', 'Cash Loan', 'Vehicle', 'Housing', 'Personal', 'Education', 'Business', 'Other',
] as const

export type PaymentBreakdown = {
  month: number
  date: Date
  payment: number
  principal: number
  interest: number
}

export const DEFAULT_COLOR = '#F3622D'

export const LOAN_COLORS = [
  DEFAULT_COLOR, // brand orange
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
