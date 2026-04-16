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
  '#EF4444', // red
  '#EC4899', // pink
  '#A855F7', // violet
  '#3B82F6', // blue
  '#06B6D4', // cyan
  '#10B981', // emerald
  '#84CC16', // lime
  '#F59E0B', // amber
  '#64748B', // slate
]
