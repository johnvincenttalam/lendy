import { create } from 'zustand'
import type { Bill, BillFormData, BillPaymentRecord } from './billTypes'
import { advanceDueDate, paidForCycle, remainingForCycle } from './billUtils'
import { showToast } from '../../components/Toast'

const BILLS_KEY = 'loan-tracker-bills'
const BILL_PAYMENTS_KEY = 'loan-tracker-bill-payments'

function formatDue(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function loadBills(): Bill[] {
  try {
    const data = localStorage.getItem(BILLS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveBills(bills: Bill[]) {
  localStorage.setItem(BILLS_KEY, JSON.stringify(bills))
}

function loadBillPayments(): BillPaymentRecord[] {
  try {
    const data = localStorage.getItem(BILL_PAYMENTS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveBillPayments(payments: BillPaymentRecord[]) {
  localStorage.setItem(BILL_PAYMENTS_KEY, JSON.stringify(payments))
}

type BillStore = {
  bills: Bill[]
  billPayments: BillPaymentRecord[]
  addBill: (data: BillFormData) => void
  updateBill: (id: string, data: Partial<Bill>) => void
  recordBillPayment: (id: string, amount: number) => void
  undoBillPayment: (id: string) => void
  deleteBill: (id: string) => void
  archiveBill: (id: string) => void
  unarchiveBill: (id: string) => void
  getPaymentsForBill: (billId: string) => BillPaymentRecord[]
  importBackup: (json: string) => void
}

export const useBillStore = create<BillStore>((set, get) => ({
  bills: loadBills(),
  billPayments: loadBillPayments(),

  addBill: (data) =>
    set((state) => {
      const newBill: Bill = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }
      const bills = [...state.bills, newBill]
      saveBills(bills)
      showToast(`"${data.name}" added`)
      return { bills }
    }),

  updateBill: (id, data) =>
    set((state) => {
      const bills = state.bills.map((bill) => (bill.id === id ? { ...bill, ...data } : bill))
      saveBills(bills)
      return { bills }
    }),

  // Records `amount` against the cycle the bill is currently on. The cycle only
  // advances once its payments cover bill.amount, so a partial leaves the bill
  // due (and free to go overdue) until it's topped up.
  recordBillPayment: (id, amount) =>
    set((state) => {
      const target = state.bills.find((b) => b.id === id)
      if (!target || amount <= 0) return state

      const newRecord: BillPaymentRecord = {
        id: crypto.randomUUID(),
        billId: target.id,
        amount: Math.round(amount * 100) / 100,
        paidAt: new Date().toISOString(),
        dueDate: target.nextDueDate,
      }
      const billPayments = [...state.billPayments, newRecord]

      const covered = paidForCycle(target, billPayments) >= target.amount
      const bills = state.bills.map((bill) =>
        bill.id === id ? { ...bill, nextDueDate: covered ? advanceDueDate(bill.nextDueDate) : bill.nextDueDate } : bill
      )

      const stillDue = covered ? 0 : remainingForCycle(target, billPayments)
      setTimeout(() => {
        showToast(
          covered ? `"${target.name}" fully paid` : `Partial recorded — ${formatDue(stillDue)} still due`,
          { label: 'UNDO', onClick: () => get().undoBillPayment(id) },
        )
      }, 0)

      saveBills(bills)
      saveBillPayments(billPayments)
      return { bills, billPayments }
    }),

  undoBillPayment: (id) =>
    set((state) => {
      const billPaymentsForBill = state.billPayments.filter((p) => p.billId === id)
      const lastPayment = billPaymentsForBill[billPaymentsForBill.length - 1]
      if (!lastPayment) return state

      const bills = state.bills.map((bill) =>
        bill.id === id ? { ...bill, nextDueDate: lastPayment.dueDate } : bill
      )
      const billPayments = state.billPayments.filter((p) => p.id !== lastPayment.id)
      saveBills(bills)
      saveBillPayments(billPayments)
      showToast('Payment undone')
      return { bills, billPayments }
    }),

  deleteBill: (id) =>
    set((state) => {
      const bill = state.bills.find((b) => b.id === id)
      const bills = state.bills.filter((b) => b.id !== id)
      const billPayments = state.billPayments.filter((p) => p.billId !== id)
      saveBills(bills)
      saveBillPayments(billPayments)
      if (bill) showToast(`"${bill.name}" deleted`)
      return { bills, billPayments }
    }),

  archiveBill: (id) =>
    set((state) => {
      const bills = state.bills.map((b) => (b.id === id ? { ...b, archived: true } : b))
      saveBills(bills)
      const bill = bills.find((b) => b.id === id)
      if (bill) showToast(`"${bill.name}" archived`)
      return { bills }
    }),

  unarchiveBill: (id) =>
    set((state) => {
      const bills = state.bills.map((b) => (b.id === id ? { ...b, archived: false } : b))
      saveBills(bills)
      const bill = bills.find((b) => b.id === id)
      if (bill) showToast(`"${bill.name}" restored`)
      return { bills }
    }),

  getPaymentsForBill: (billId) => {
    return get().billPayments
      .filter((p) => p.billId === billId)
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
  },

  importBackup: (json) => {
    try {
      const data = JSON.parse(json)
      if (!Array.isArray(data.bills)) return
      const bills: Bill[] = data.bills.filter(
        (b: unknown): b is Bill =>
          !!b && typeof b === 'object' && typeof (b as Bill).id === 'string' && typeof (b as Bill).name === 'string'
      )
      const billPayments: BillPaymentRecord[] = Array.isArray(data.billPayments)
        ? data.billPayments.filter(
            (p: unknown): p is BillPaymentRecord =>
              !!p && typeof p === 'object' && typeof (p as BillPaymentRecord).id === 'string' && typeof (p as BillPaymentRecord).billId === 'string'
          )
        : []
      saveBills(bills)
      saveBillPayments(billPayments)
      set({ bills, billPayments })
    } catch {
      // Swallow — importAllData (Task 19) already validated the JSON parses
      // before calling any store's importBackup.
    }
  },
}))
