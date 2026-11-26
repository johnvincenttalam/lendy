import { create } from 'zustand'
import type { Bill, BillFormData, BillPaymentRecord } from './billTypes'
import { advanceDueDate, paidForCycle, remainingForCycle } from './billUtils'
import { showToast } from '../../components/toastEvents'
import { persist } from '../storage/persist'


function formatDue(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
  /** Fills the store from storage: at start-up, and after a restore or undo. */
  hydrate: (data: { bills: Bill[]; billPayments: BillPaymentRecord[] }) => void
}

export const useBillStore = create<BillStore>((set, get) => ({
  bills: [],
  billPayments: [],

  addBill: (data) =>
    set((state) => {
      const newBill: Bill = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }
      const bills = [...state.bills, newBill]
      persist({ bills: { next: bills, prev: state.bills } })
      showToast(`"${data.name}" added`)
      return { bills }
    }),

  updateBill: (id, data) =>
    set((state) => {
      const bills = state.bills.map((bill) => (bill.id === id ? { ...bill, ...data } : bill))
      persist({ bills: { next: bills, prev: state.bills } })
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

      persist({ bills: { next: bills, prev: state.bills }, billPayments: { next: billPayments, prev: state.billPayments } })
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
      persist({ bills: { next: bills, prev: state.bills }, billPayments: { next: billPayments, prev: state.billPayments } })
      showToast('Payment undone')
      return { bills, billPayments }
    }),

  deleteBill: (id) =>
    set((state) => {
      const bill = state.bills.find((b) => b.id === id)
      const bills = state.bills.filter((b) => b.id !== id)
      const billPayments = state.billPayments.filter((p) => p.billId !== id)
      persist({ bills: { next: bills, prev: state.bills }, billPayments: { next: billPayments, prev: state.billPayments } })
      if (bill) showToast(`"${bill.name}" deleted`)
      return { bills, billPayments }
    }),

  archiveBill: (id) =>
    set((state) => {
      const bills = state.bills.map((b) => (b.id === id ? { ...b, archived: true } : b))
      persist({ bills: { next: bills, prev: state.bills } })
      const bill = bills.find((b) => b.id === id)
      if (bill) showToast(`"${bill.name}" archived`)
      return { bills }
    }),

  unarchiveBill: (id) =>
    set((state) => {
      const bills = state.bills.map((b) => (b.id === id ? { ...b, archived: false } : b))
      persist({ bills: { next: bills, prev: state.bills } })
      const bill = bills.find((b) => b.id === id)
      if (bill) showToast(`"${bill.name}" restored`)
      return { bills }
    }),

  getPaymentsForBill: (billId) => {
    return get().billPayments
      .filter((p) => p.billId === billId)
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
  },

  hydrate: ({ bills, billPayments }) => set({ bills, billPayments }),
}))
