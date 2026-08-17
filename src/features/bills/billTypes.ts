export type Bill = {
  id: string
  name: string
  color: string
  category: string
  amount: number
  nextDueDate: string // ISO date (YYYY-MM-DD) — the next unpaid cycle
  notes?: string
  createdAt: string
  archived?: boolean
}

export type BillPaymentRecord = {
  id: string
  billId: string
  amount: number
  paidAt: string // ISO datetime, when marked paid
  dueDate: string // ISO date, the cycle this payment covered
}

export type BillFormData = Omit<Bill, 'id' | 'createdAt'>

export const BILL_CATEGORIES = [
  'Rent', 'Utilities', 'Internet/Phone', 'Subscription', 'Insurance', 'Transportation', 'Other',
] as const
