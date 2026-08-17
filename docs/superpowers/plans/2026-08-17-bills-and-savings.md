# Bills and Savings Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new trackable entities alongside Loans — recurring **Bills** (rent, utilities, subscriptions — no payoff date) and goal-based **Savings** — each with their own page, reachable from a new "More" bottom-nav tab, with JSON backup covering all three.

**Architecture:** Two new feature folders (`src/features/bills/`, `src/features/savings/`) mirror the existing `src/features/loans/` pattern exactly: a types file, a utils file for pure logic, a Zustand store persisted to localStorage, a card component, a form component, and a details component. Two new "fat" list pages (`BillsPage.tsx`, `SavingsPage.tsx`) mirror `Dashboard.tsx`; two new thin detail-page wrappers (`BillDetailsPage.tsx`, `SavingsGoalDetailsPage.tsx`) mirror `LoanDetailsPage.tsx`. The bottom nav's Analytics slot becomes "More", a new menu page linking to Analytics/Bills/Savings. Backup composition moves into a new `src/utils/backup.ts` that reads all three stores directly — `loanStore.ts` itself needs zero changes.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind v4 (utility classes + the existing `.input-field`/theme CSS variables), Zustand (`create`), `react-router-dom` (`HashRouter`), `lucide-react` icons.

**Spec:** `docs/superpowers/specs/2026-08-17-bills-and-savings-design.md`

## Global Constraints

- This project has no automated test runner (no `test` script in `package.json`). "Testing" a step means: `npx tsc -b` and `npx eslint <file(s)>` both exit clean, plus the manual browser verification described in each task (run `npm run dev`, exercise the feature at `http://localhost:5173`).
- Reuse `LOAN_COLORS`/`DEFAULT_COLOR` from `src/features/loans/loanTypes.ts` and `ColorPicker.tsx` as-is for Bills and Savings colors — do not duplicate or rename them.
- Reuse `CurrencyAmount` (`src/components/CurrencyAmount.tsx`) for every rendered money value — never call `formatCurrency` directly in new JSX, and never hardcode a `₱` character.
- No notifications/reminders for bills. No integration into Calendar or Analytics (no due-date merging, no debt-to-income inclusion). Home dashboard (`Dashboard.tsx`/`SummaryHeader.tsx`) stays untouched. No sort dropdown or grid/list toggle on `BillsPage`/`SavingsPage`. No CSV export for bills/savings (JSON backup only). These are explicit out-of-scope items from the spec — do not add them "while you're in there."
- `loanStore.ts` must not be modified by this plan — every task that needs loan data reads it via the existing `useLoanStore` hook/`getState()`.
- Match existing visual conventions exactly: card padding/radius (`bg-card rounded-2xl border border-themed`), the bottom-sheet form container classes, the confirmation-modal container classes, `text-[Npx]` sizing, `font-mono` on money hero/card values — copy these from the Loans equivalents shown inline in each task rather than inventing new ones.
- Commit after every task, using the exact `git add`/`git commit` commands given in that task's last step.

---

### Task 1: Bill data types

**Files:**
- Create: `src/features/bills/billTypes.ts`

**Interfaces:**
- Produces: `Bill`, `BillPaymentRecord`, `BillFormData`, `BILL_CATEGORIES` — consumed by every later Bills task.

- [ ] **Step 1: Create the file**

```ts
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/bills/billTypes.ts
git commit -m "Add Bill data types"
```

---

### Task 2: Bill utils (due-date rollover, overdue detection)

**Files:**
- Create: `src/features/bills/billUtils.ts`

**Interfaces:**
- Consumes: `Bill` (Task 1); `getDaysInMonth`, `today`, `daysBetween`, `startOfDay` from `src/utils/dateUtils.ts` (already exist, unchanged).
- Produces: `nextOccurrenceOfDay(dueDay, from)`, `advanceDueDate(current)`, `isBillOverdue(bill)`, `billDaysOverdue(bill)` — consumed by `billStore.ts` (Task 3), `BillForm.tsx` (Task 4), `BillCard.tsx` (Task 5), `BillDetails.tsx` (Task 7), `BillsPage.tsx` (Task 6).

- [ ] **Step 1: Create the file**

```ts
import type { Bill } from './billTypes'
import { getDaysInMonth, today, daysBetween, startOfDay } from '../../utils/dateUtils'

function clampToMonth(year: number, month: number, day: number): Date {
  const lastDay = getDaysInMonth(year, month)
  return new Date(year, month, Math.min(day, lastDay))
}

/**
 * Nearest occurrence of `dueDay` on/after `from`, clamped to the month's
 * actual last day (e.g. day 31 in February -> Feb 28/29).
 */
export function nextOccurrenceOfDay(dueDay: number, from: Date): Date {
  const candidate = clampToMonth(from.getFullYear(), from.getMonth(), dueDay)
  if (candidate >= startOfDay(from)) return candidate
  return clampToMonth(from.getFullYear(), from.getMonth() + 1, dueDay)
}

/**
 * Advances a due date by one month, keeping the same day-of-month
 * (clamped to the target month's length) rather than drifting to
 * whenever the bill happened to be paid.
 */
export function advanceDueDate(current: string): string {
  const d = new Date(current)
  const next = clampToMonth(d.getFullYear(), d.getMonth() + 1, d.getDate())
  return next.toISOString().split('T')[0]
}

export function isBillOverdue(bill: Bill): boolean {
  if (bill.archived) return false
  return startOfDay(new Date(bill.nextDueDate)) < today()
}

export function billDaysOverdue(bill: Bill): number {
  if (!isBillOverdue(bill)) return 0
  return daysBetween(bill.nextDueDate, today())
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Manual sanity check via browser console**

Run `npm run dev`, open the app in a browser, open devtools console, and paste:

```js
const mod = await import('/src/features/bills/billUtils.ts')
mod.nextOccurrenceOfDay(31, new Date(2026, 1, 5)).toISOString().split('T')[0] // expect 2026-02-28 (Feb clamp)
mod.advanceDueDate('2026-01-31') // expect '2026-02-28'
mod.advanceDueDate('2026-02-28') // expect '2026-03-28' (not clamped once no longer Jan 31st input)
```

Expected: values match the comments above (February clamps day 31 down to its actual last day).

- [ ] **Step 4: Commit**

```bash
git add src/features/bills/billUtils.ts
git commit -m "Add bill due-date rollover and overdue utilities"
```

---

### Task 3: Bill store

**Files:**
- Create: `src/features/bills/billStore.ts`

**Interfaces:**
- Consumes: `Bill`, `BillFormData`, `BillPaymentRecord` (Task 1); `advanceDueDate` (Task 2); `showToast` from `src/components/Toast.tsx` (existing, signature `showToast(message: string, action?: { label: string; onClick: () => void }): void`).
- Produces: `useBillStore` hook exposing `bills: Bill[]`, `billPayments: BillPaymentRecord[]`, `addBill(data: BillFormData): void`, `updateBill(id: string, data: Partial<Bill>): void`, `markBillPaid(id: string): void`, `undoBillPayment(id: string): void`, `deleteBill(id: string): void`, `archiveBill(id: string): void`, `unarchiveBill(id: string): void`, `getPaymentsForBill(billId: string): BillPaymentRecord[]`, `importBackup(json: string): void` — consumed by every later Bills UI task and by `backup.ts` (Task 19).

- [ ] **Step 1: Create the file**

```ts
import { create } from 'zustand'
import type { Bill, BillFormData, BillPaymentRecord } from './billTypes'
import { advanceDueDate } from './billUtils'
import { showToast } from '../../components/Toast'

const BILLS_KEY = 'loan-tracker-bills'
const BILL_PAYMENTS_KEY = 'loan-tracker-bill-payments'

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
  markBillPaid: (id: string) => void
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

  markBillPaid: (id) =>
    set((state) => {
      let newRecord: BillPaymentRecord | null = null
      const bills = state.bills.map((bill) => {
        if (bill.id !== id) return bill

        newRecord = {
          id: crypto.randomUUID(),
          billId: bill.id,
          amount: bill.amount,
          paidAt: new Date().toISOString(),
          dueDate: bill.nextDueDate,
        }

        setTimeout(() => {
          showToast(`"${bill.name}" marked paid`, {
            label: 'UNDO',
            onClick: () => get().undoBillPayment(id),
          })
        }, 0)

        return { ...bill, nextDueDate: advanceDueDate(bill.nextDueDate) }
      })
      const billPayments = newRecord ? [...state.billPayments, newRecord] : state.billPayments
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
      const bills: Bill[] = data.bills
      const billPayments: BillPaymentRecord[] = Array.isArray(data.billPayments) ? data.billPayments : []
      saveBills(bills)
      saveBillPayments(billPayments)
      set({ bills, billPayments })
    } catch {
      // Swallow — importAllData (Task 19) already validated the JSON parses
      // before calling any store's importBackup.
    }
  },
}))
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/bills/billStore.ts
git commit -m "Add bill Zustand store"
```

---

### Task 4: Bill form

**Files:**
- Create: `src/features/bills/BillForm.tsx`

**Interfaces:**
- Consumes: `Bill`, `BillFormData`, `BILL_CATEGORIES` (Task 1); `nextOccurrenceOfDay` (Task 2); `DEFAULT_COLOR` from `src/features/loans/loanTypes.ts` (existing); `ColorPicker` from `src/components/ColorPicker.tsx` (existing, props `{ value: string; onChange: (color: string) => void }`); `useBodyScrollLock` from `src/hooks/useBodyScrollLock.ts` (existing).
- Produces: `BillForm` component, props `{ onSubmit: (data: BillFormData) => void; onClose: () => void; initial?: Bill }` — consumed by `BillDetails.tsx` (Task 7, edit mode) and `App.tsx` (Task 18, create mode).

- [ ] **Step 1: Create the file**

```tsx
import { useState, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import type { Bill, BillFormData } from './billTypes'
import { BILL_CATEGORIES } from './billTypes'
import { DEFAULT_COLOR } from '../loans/loanTypes'
import { nextOccurrenceOfDay } from './billUtils'
import ColorPicker from '../../components/ColorPicker'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

type Props = {
  onSubmit: (data: BillFormData) => void
  onClose: () => void
  initial?: Bill
}

function computeNextDueDate(dueDayNum: number, initial?: Bill): string {
  if (initial) {
    const initialDay = new Date(initial.nextDueDate).getDate()
    if (initialDay === dueDayNum) return initial.nextDueDate
  }
  return nextOccurrenceOfDay(dueDayNum, new Date()).toISOString().split('T')[0]
}

export default function BillForm({ onSubmit, onClose, initial }: Props) {
  const isEdit = !!initial
  useBodyScrollLock(true)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef<number | null>(null)

  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragStartY.current = clientY
    setIsDragging(true)
  }, [])

  const handleDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (dragStartY.current === null) return
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const delta = Math.max(0, clientY - dragStartY.current)
    setDragY(delta)
  }, [])

  const handleDragEnd = useCallback(() => {
    if (dragY > 120) {
      onClose()
    } else {
      setDragY(0)
    }
    dragStartY.current = null
    setIsDragging(false)
  }, [dragY, onClose])

  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [color, setColor] = useState(initial?.color ?? DEFAULT_COLOR)
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [dueDay, setDueDay] = useState(initial ? String(new Date(initial.nextDueDate).getDate()) : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function clearError(field: string) {
    setErrors((prev) => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Name is required'
    if (!amount || Number(amount) <= 0) newErrors.amount = 'Enter a valid amount'
    const dueDayNum = Number(dueDay)
    if (!dueDay || dueDayNum < 1 || dueDayNum > 31) newErrors.dueDay = 'Enter a day from 1-31'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    const dueDayNum = Number(dueDay)
    onSubmit({
      name: name.trim(),
      color,
      category: category || 'Other',
      amount: Number(amount),
      nextDueDate: computeNextDueDate(dueDayNum, initial),
      notes: notes.trim() || undefined,
      archived: initial?.archived,
    })
  }

  return (
    <div className="fixed inset-0 bg-overlay z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div
        className="bg-card w-full h-full sm:h-auto sm:max-w-lg sm:rounded-2xl rounded-none sm:max-h-[92vh] overflow-y-auto border-0 sm:border border-themed animate-slide-up custom-scroll"
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          className="flex justify-center pt-3 pb-1 sm:hidden cursor-grab active:cursor-grabbing"
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={() => { if (isDragging) handleDragEnd() }}
        >
          <div className="w-9 h-1 rounded-full bg-muted opacity-40" />
        </div>

        <div className="sticky top-0 z-10 bg-card flex items-center justify-between px-5 pt-3 pb-4 sm:static sm:pt-5 sm:border-b-0 border-b border-divider">
          <h2 className="text-[20px] font-bold text-primary tracking-tight">{isEdit ? 'Edit Bill' : 'New Bill'}</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center hover:opacity-60 transition-opacity">
            <X className="w-[18px] h-[18px] text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4">
          <Field label="Bill Name" id="bill-name" error={errors.name}>
            <input
              id="bill-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); clearError('name') }}
              placeholder="e.g. Electricity"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'bill-name-error' : undefined}
              className="input-field"
            />
          </Field>

          <Field label="Category">
            <div className="flex flex-wrap gap-1.5">
              {BILL_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(category === c ? '' : c)}
                  aria-pressed={category === c}
                  className={`text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all ${
                    category === c ? 'text-white' : 'bg-subtle text-secondary hover:opacity-80'
                  }`}
                  style={category === c ? { backgroundColor: color } : undefined}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Color">
            <ColorPicker value={color} onChange={setColor} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₱)" id="bill-amount" error={errors.amount}>
              <input
                id="bill-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); clearError('amount') }}
                inputMode="decimal" placeholder="1,500"
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? 'bill-amount-error' : undefined}
                className="input-field"
              />
            </Field>
            <Field label="Due day of month" id="bill-due-day" error={errors.dueDay}>
              <input
                id="bill-due-day"
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => { setDueDay(e.target.value); clearError('dueDay') }}
                inputMode="numeric" placeholder="15"
                aria-invalid={!!errors.dueDay}
                aria-describedby={errors.dueDay ? 'bill-due-day-error' : undefined}
                className="input-field"
              />
            </Field>
          </div>

          <Field label="Notes" id="bill-notes">
            <textarea
              id="bill-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What's this bill for? (optional)"
              maxLength={300}
              rows={3}
              className="input-field resize-none"
            />
          </Field>

          <button
            type="submit"
            className="w-full text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all duration-200 text-[15px] tracking-tight hover:opacity-90"
            style={{ backgroundColor: color }}
          >
            {isEdit ? 'Save Changes' : 'Add Bill'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string
  id?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">{label}</label>
      <div className={error ? 'rounded-[14px] ring-2 ring-red-500/50' : undefined}>{children}</div>
      {error && <p id={id ? `${id}-error` : undefined} className="text-[11px] text-red-500 dark:text-red-400 mt-1 font-medium">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `npx tsc -b && npx eslint src/features/bills/BillForm.tsx`
Expected: no errors. (`BillForm` isn't rendered anywhere yet, so there's no manual browser check for this task — that happens once `BillsPage`, Task 6, wires it up.)

- [ ] **Step 3: Commit**

```bash
git add src/features/bills/BillForm.tsx
git commit -m "Add BillForm component"
```

---

### Task 5: Bill card

**Files:**
- Create: `src/features/bills/BillCard.tsx`

**Interfaces:**
- Consumes: `Bill` (Task 1); `isBillOverdue`, `billDaysOverdue` (Task 2); `DEFAULT_COLOR` (existing); `CurrencyAmount` from `src/components/CurrencyAmount.tsx` (existing, props `{ value: number }`).
- Produces: `BillCard` component, props `{ bill: Bill }` — consumed by `BillsPage.tsx` (Task 6).

- [ ] **Step 1: Create the file**

```tsx
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import type { Bill } from './billTypes'
import { DEFAULT_COLOR } from '../loans/loanTypes'
import { isBillOverdue, billDaysOverdue } from './billUtils'
import CurrencyAmount from '../../components/CurrencyAmount'

type Props = { bill: Bill }

export default function BillCard({ bill }: Props) {
  const navigate = useNavigate()
  const color = bill.color || DEFAULT_COLOR
  const overdue = isBillOverdue(bill)
  const overdueDays = billDaysOverdue(bill)
  const dueDate = new Date(bill.nextDueDate)

  return (
    <button
      onClick={() => navigate(`/bills/${bill.id}`)}
      className="w-full bg-card rounded-2xl p-4 border border-themed text-left transition-all duration-200 active:scale-[0.97] hover:bg-card-hover group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-[13px] flex items-center justify-center text-[14px] font-bold text-white shrink-0"
            style={{ backgroundColor: color }}
          >
            {bill.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-primary text-[15px] leading-tight tracking-tight">{bill.name}</h3>
            <span className="text-[10px] font-semibold text-muted bg-subtle px-1.5 py-[1px] rounded-md">{bill.category}</span>
          </div>
        </div>
        {overdue && (
          <span className="text-[11px] font-semibold bg-red-500/10 text-red-500 px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
            <AlertTriangle className="w-3 h-3" />
            {overdueDays}d overdue
          </span>
        )}
      </div>

      <div className="flex justify-between items-end">
        <p className="text-[20px] font-bold font-mono tracking-tight leading-none" style={{ color }}>
          <CurrencyAmount value={bill.amount} />
        </p>
        <span className={`text-[12px] font-medium ${overdue ? 'text-red-500' : 'text-muted'}`}>
          {overdue ? 'Overdue' : `Due ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
        </span>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `npx tsc -b && npx eslint src/features/bills/BillCard.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/bills/BillCard.tsx
git commit -m "Add BillCard component"
```

---

### Task 6: Bills list page + `/bills` route

**Files:**
- Create: `src/pages/BillsPage.tsx`
- Modify: `src/App.tsx:1-16` (imports), `:37-43` (routes)

**Interfaces:**
- Consumes: `useBillStore` (Task 3); `isBillOverdue` (Task 2); `BillCard` (Task 5); `EmptyState` from `src/components/EmptyState.tsx` (existing, props `{ icon: LucideIcon; title: string; subtitle?: string; children?: ReactNode }`); `CurrencyAmount` (existing); `BRAND_GRADIENT` from `src/constants/styles.ts` (existing).
- Produces: `BillsPage` default export, mounted at route `/bills` — consumed by `App.tsx`'s router and, later, by `BottomNav`'s "More" active-state check (Task 17) and `App.tsx`'s add-button routing (Task 18).

- [ ] **Step 1: Create `src/pages/BillsPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { Receipt, AlertTriangle, Archive } from 'lucide-react'
import { useBillStore } from '../features/bills/billStore'
import { isBillOverdue } from '../features/bills/billUtils'
import BillCard from '../features/bills/BillCard'
import EmptyState from '../components/EmptyState'
import CurrencyAmount from '../components/CurrencyAmount'
import { BRAND_GRADIENT } from '../constants/styles'

export default function BillsPage() {
  const { bills } = useBillStore()
  const [showArchived, setShowArchived] = useState(false)

  const { activeBills, archivedBills } = useMemo(() => ({
    activeBills: bills.filter((b) => !b.archived),
    archivedBills: bills.filter((b) => b.archived),
  }), [bills])

  const totalMonthly = activeBills.reduce((sum, b) => sum + b.amount, 0)
  const overdueBills = useMemo(() => activeBills.filter(isBillOverdue), [activeBills])
  const overdueAmount = overdueBills.reduce((sum, b) => sum + b.amount, 0)

  const visible = showArchived ? archivedBills : activeBills
  const sorted = useMemo(
    () => [...visible].sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()),
    [visible],
  )

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <div style={{ background: BRAND_GRADIENT }}>
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-5">
          <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight">Bills</h1>
          <p className="text-[12px] text-white/55 font-medium mb-4">
            {activeBills.length} active {activeBills.length === 1 ? 'bill' : 'bills'}
          </p>

          {overdueBills.length > 0 && (
            <div className="mb-4 rounded-xl bg-red-500/90 backdrop-blur-sm border border-red-400/30 p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white">
                  {overdueBills.length} overdue {overdueBills.length === 1 ? 'bill' : 'bills'}
                </p>
                <p className="text-[11px] text-white/70">
                  <CurrencyAmount value={overdueAmount} /> total due
                </p>
              </div>
            </div>
          )}

          <div className="rounded-2xl p-4 bg-white/[0.13] backdrop-blur-sm border border-white/[0.12]">
            <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Monthly Bills</span>
            <p className="text-[28px] font-bold font-mono text-white tracking-tight mt-1">
              <CurrencyAmount value={totalMonthly} />
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 pt-3 pb-28">
        {archivedBills.length > 0 && (
          <div className="flex mb-3">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${
                showArchived ? 'bg-brand text-on-brand' : 'bg-subtle text-secondary hover:opacity-80'
              }`}
            >
              <Archive className="w-3 h-3" />
              Archived ({archivedBills.length})
            </button>
          </div>
        )}

        <div className={sorted.length === 0 ? '' : 'space-y-3'}>
          {sorted.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={showArchived ? 'No archived bills' : 'No bills yet'}
              subtitle={showArchived ? undefined : 'Add your first recurring bill to start budgeting'}
            >
              {!showArchived && (
                <p className="text-[13px] text-muted">Tap <span className="text-brand font-semibold">+</span> below to get started</p>
              )}
            </EmptyState>
          ) : (
            sorted.map((bill) => <BillCard key={bill.id} bill={bill} />)
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the route into `src/App.tsx`**

Find:

```tsx
import Dashboard from './pages/Dashboard'
import LoanDetailsPage from './pages/LoanDetailsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import CalendarPage from './pages/CalendarPage'
```

Change to:

```tsx
import Dashboard from './pages/Dashboard'
import LoanDetailsPage from './pages/LoanDetailsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import CalendarPage from './pages/CalendarPage'
import BillsPage from './pages/BillsPage'
```

Find:

```tsx
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/loan/:id" element={<LoanDetailsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
```

Change to:

```tsx
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/loan/:id" element={<LoanDetailsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/bills" element={<BillsPage />} />
      </Routes>
```

- [ ] **Step 3: Verify it compiles and lints**

Run: `npx tsc -b && npx eslint src/pages/BillsPage.tsx src/App.tsx`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run `npm run dev`, navigate the browser to `http://localhost:5173/#/bills` directly (the nav tab isn't wired yet — that's Task 17). Confirm: an empty state ("No bills yet") renders with a gradient header showing "Bills" / "0 active bills" and a "Monthly Bills ₱0.00" card. The **+** button still opens the loan form for now (expected — Task 18 makes it context-aware); ignore it in this check.

- [ ] **Step 5: Commit**

```bash
git add src/pages/BillsPage.tsx src/App.tsx
git commit -m "Add BillsPage and /bills route"
```

---

### Task 7: Bill details page + `/bills/:id` route

**Files:**
- Create: `src/features/bills/BillDetails.tsx`, `src/pages/BillDetailsPage.tsx`
- Modify: `src/App.tsx` (import + route, same pattern as Task 6 Step 2)

**Interfaces:**
- Consumes: `Bill` (Task 1); `isBillOverdue`, `billDaysOverdue` (Task 2); `useBillStore` (Task 3, specifically `undoBillPayment`, `updateBill`, `archiveBill`, `unarchiveBill`, `billPayments`); `BillForm` (Task 4); `DEFAULT_COLOR` (existing); `showToast` (existing); `useBodyScrollLock` (existing); `CurrencyAmount` (existing).
- Produces: `BillDetails` component, props `{ bill: Bill; onMarkPaid: () => void; onDelete: () => void; onBack: () => void }`; `BillDetailsPage` default export mounted at `/bills/:id`.

- [ ] **Step 1: Create `src/features/bills/BillDetails.tsx`**

```tsx
import { useState, useMemo } from 'react'
import {
  ArrowLeft, Trash2, Calendar, DollarSign, Tag, Pencil, Undo2, Archive, ArchiveRestore,
  AlertTriangle, MoreVertical, CheckCircle,
} from 'lucide-react'
import { DEFAULT_COLOR } from '../loans/loanTypes'
import type { Bill } from './billTypes'
import { isBillOverdue, billDaysOverdue } from './billUtils'
import { useBillStore } from './billStore'
import BillForm from './BillForm'
import { showToast } from '../../components/Toast'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import CurrencyAmount from '../../components/CurrencyAmount'

type Props = {
  bill: Bill
  onMarkPaid: () => void
  onDelete: () => void
  onBack: () => void
}

export default function BillDetails({ bill, onMarkPaid, onDelete, onBack }: Props) {
  const [showConfirm, setShowConfirm] = useState<'pay' | 'undo' | 'archive' | 'delete' | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  useBodyScrollLock(showConfirm !== null || showEdit)
  const updateBill = useBillStore((s) => s.updateBill)
  const undoBillPayment = useBillStore((s) => s.undoBillPayment)
  const archiveBill = useBillStore((s) => s.archiveBill)
  const unarchiveBill = useBillStore((s) => s.unarchiveBill)
  const billPayments = useBillStore((s) => s.billPayments)
  const payments = useMemo(
    () => billPayments.filter((p) => p.billId === bill.id).sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()),
    [billPayments, bill.id],
  )
  const color = bill.color || DEFAULT_COLOR
  const overdue = isBillOverdue(bill)
  const overdueDays = billDaysOverdue(bill)
  const dueDate = new Date(bill.nextDueDate)

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      {/* Header */}
      <div className="bg-header backdrop-blur-header border-b border-themed sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2 px-4 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button onClick={onBack} className="w-9 h-9 flex-shrink-0 flex items-center justify-center hover:opacity-60 transition-opacity">
              <ArrowLeft className="w-[18px] h-[18px] text-secondary" />
            </button>
            <div
              className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-[12px] font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {bill.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-primary text-[16px] tracking-tight truncate">{bill.name}</h1>
              <span className="text-[10px] font-semibold text-muted bg-subtle px-1.5 py-[1px] rounded-md">{bill.category}</span>
            </div>
          </div>
          <div className="flex items-center flex-shrink-0 relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="w-9 h-9 flex items-center justify-center hover:opacity-60 transition-opacity"
              title="More actions"
              aria-haspopup="menu"
              aria-expanded={showMenu}
            >
              <MoreVertical className="w-[18px] h-[18px] text-secondary" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <div role="menu" className="absolute right-0 top-11 bg-card border border-themed rounded-xl z-40 py-1 min-w-[180px] shadow-lg animate-scale-in">
                  <button
                    role="menuitem"
                    onClick={() => { setShowMenu(false); setShowEdit(true) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-secondary hover:bg-subtle transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  {payments.length > 0 && !bill.archived && (
                    <button
                      role="menuitem"
                      onClick={() => { setShowMenu(false); setShowConfirm('undo') }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-secondary hover:bg-subtle transition-colors"
                    >
                      <Undo2 className="w-4 h-4" />
                      Undo last payment
                    </button>
                  )}
                  <button
                    role="menuitem"
                    onClick={() => { setShowMenu(false); setShowConfirm('archive') }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-secondary hover:bg-subtle transition-colors"
                  >
                    {bill.archived ? (
                      <>
                        <ArchiveRestore className="w-4 h-4 text-amber-500" />
                        Restore bill
                      </>
                    ) : (
                      <>
                        <Archive className="w-4 h-4" />
                        Archive bill
                      </>
                    )}
                  </button>
                  <div className="my-1 border-t border-themed" />
                  <button
                    role="menuitem"
                    onClick={() => { setShowMenu(false); setShowConfirm('delete') }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-red-500 dark:text-red-400 hover:bg-subtle transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete bill
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-8 space-y-4">
        {/* Hero */}
        <div className="bg-card rounded-2xl border border-themed transition-colors overflow-hidden">
          {bill.archived && (
            <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold uppercase tracking-wider text-center py-2 border-b border-amber-500/20">
              Archived
            </div>
          )}
          {overdue && (
            <div className="bg-red-500/10 text-red-500 text-[12px] font-semibold text-center py-2.5 border-b border-red-500/20 flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>
                Overdue by {overdueDays} {overdueDays === 1 ? 'day' : 'days'}
                <span className="text-red-400 font-normal"> (due {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</span>
              </span>
            </div>
          )}
          {!overdue && !bill.archived && (
            <div className="bg-subtle text-secondary text-[12px] font-medium text-center py-2.5 border-b border-divider flex items-center justify-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted" />
              <span>Due {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          )}
          <div className="px-4 pt-6 pb-6 text-center">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-1.5">Amount</p>
            <p className="text-[36px] font-bold font-mono text-primary tracking-tighter leading-none"><CurrencyAmount value={bill.amount} /></p>
          </div>
        </div>

        {bill.notes && (
          <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-1.5">Notes</p>
            <p className="text-[13px] text-secondary whitespace-pre-wrap break-words leading-relaxed">{bill.notes}</p>
          </div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <InfoCard icon={<DollarSign className="w-3.5 h-3.5" />} label="Amount" value={<CurrencyAmount value={bill.amount} />} />
          <InfoCard icon={<Tag className="w-3.5 h-3.5" />} label="Category" value={bill.category} />
        </div>

        {/* Payment history */}
        <div className="bg-card rounded-2xl border border-themed transition-colors overflow-hidden">
          <div className="px-4 pt-4 pb-2.5">
            <h3 className="font-bold text-primary text-[15px] tracking-tight">Payment History</h3>
          </div>
          {payments.length === 0 ? (
            <p className="px-4 pb-4 text-[13px] text-muted">No payments recorded yet</p>
          ) : (
            <div>
              {payments.map((p) => (
                <div key={p.id} className="px-4 py-3.5 flex items-center gap-3 border-t border-divider">
                  <CheckCircle className="w-[18px] h-[18px] text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-bold text-primary">
                      {new Date(p.paidAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <p className="text-[11px] text-muted">
                      For cycle due {new Date(p.dueDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-[14px] font-bold text-primary"><CurrencyAmount value={p.amount} /></span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-24" />
      </div>

      {/* Sticky CTA */}
      {!bill.archived && (
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-page via-page to-transparent pt-6 pb-6 px-4">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setShowConfirm('pay')}
              className="w-full text-white font-bold py-4 rounded-2xl active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 text-[15px] tracking-tight hover:opacity-90"
              style={{ backgroundColor: color }}
            >
              Mark as Paid
            </button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEdit && (
        <BillForm
          initial={bill}
          onSubmit={(data) => {
            updateBill(bill.id, data)
            setShowEdit(false)
            showToast(`"${data.name}" updated`)
          }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-overlay z-50 flex items-center justify-center p-5 animate-fade-in">
          <div className="bg-card rounded-2xl p-6 max-w-[320px] w-full border border-themed transition-colors animate-scale-in">
            <h3 className="font-bold text-primary text-[18px] tracking-tight mb-2">
              {showConfirm === 'pay' ? 'Confirm Payment' : showConfirm === 'undo' ? 'Undo Payment' : showConfirm === 'archive' ? (bill.archived ? 'Restore Bill' : 'Archive Bill') : 'Delete Bill'}
            </h3>
            {showConfirm === 'pay' ? (
              <p className="text-[13px] text-secondary mb-6">
                Mark <CurrencyAmount value={bill.amount} /> as paid for this cycle?
              </p>
            ) : showConfirm === 'undo' ? (
              <p className="text-[13px] text-secondary mb-6">Undo the last recorded payment for this bill?</p>
            ) : showConfirm === 'archive' ? (
              <p className="text-[13px] text-secondary mb-6">
                {bill.archived
                  ? `Restore "${bill.name}"? It will appear in your active bills again.`
                  : `Archive "${bill.name}"? It will be hidden from your bills list but can be restored later.`}
              </p>
            ) : (
              <p className="text-[13px] text-secondary mb-6">Delete "{bill.name}"? This cannot be undone.</p>
            )}
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 py-3 rounded-xl bg-subtle text-secondary font-semibold text-[14px] hover:opacity-80 transition-opacity"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showConfirm === 'pay') onMarkPaid()
                  else if (showConfirm === 'undo') {
                    undoBillPayment(bill.id)
                    showToast('Payment reverted')
                  } else if (showConfirm === 'archive') {
                    if (bill.archived) unarchiveBill(bill.id)
                    else {
                      archiveBill(bill.id)
                      onBack()
                    }
                  } else onDelete()
                  setShowConfirm(null)
                }}
                className="flex-1 py-3 rounded-xl font-semibold text-[14px] text-white hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: showConfirm === 'pay' ? color : showConfirm === 'undo' ? '#F59E0B' : showConfirm === 'archive' ? '#6366F1' : '#EF4444',
                }}
              >
                {showConfirm === 'pay' ? 'Confirm' : showConfirm === 'undo' ? 'Undo' : showConfirm === 'archive' ? (bill.archived ? 'Restore' : 'Archive') : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl p-3.5 border border-themed transition-colors">
      <div className="flex items-center gap-1 text-muted mb-1.5">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">{label}</span>
      </div>
      <p className="font-bold text-[13px] tracking-tight text-primary">{value}</p>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/pages/BillDetailsPage.tsx`**

```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useBillStore } from '../features/bills/billStore'
import BillDetails from '../features/bills/BillDetails'
import EmptyState from '../components/EmptyState'

export default function BillDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { bills, markBillPaid, deleteBill } = useBillStore()
  const bill = bills.find((b) => b.id === id)

  if (!bill) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center transition-colors duration-300">
        <EmptyState icon={Search} title="Bill not found" subtitle="This bill may have been deleted, or the link is invalid">
          <button
            onClick={() => navigate('/bills')}
            className="bg-brand text-on-brand text-[13px] font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity active:scale-95"
          >
            Back to bills
          </button>
        </EmptyState>
      </div>
    )
  }

  return (
    <BillDetails
      bill={bill}
      onMarkPaid={() => markBillPaid(bill.id)}
      onDelete={() => {
        deleteBill(bill.id)
        navigate('/bills')
      }}
      onBack={() => navigate(-1)}
    />
  )
}
```

- [ ] **Step 3: Wire the route into `src/App.tsx`**

Find:

```tsx
import BillsPage from './pages/BillsPage'
```

Change to:

```tsx
import BillsPage from './pages/BillsPage'
import BillDetailsPage from './pages/BillDetailsPage'
```

Find:

```tsx
        <Route path="/bills" element={<BillsPage />} />
      </Routes>
```

Change to:

```tsx
        <Route path="/bills" element={<BillsPage />} />
        <Route path="/bills/:id" element={<BillDetailsPage />} />
      </Routes>
```

- [ ] **Step 4: Verify it compiles and lints**

Run: `npx tsc -b && npx eslint src/features/bills/BillDetails.tsx src/pages/BillDetailsPage.tsx src/App.tsx`
Expected: no errors.

- [ ] **Step 5: Manual check**

In the running app, navigate to `http://localhost:5173/#/bills`, tap **+** — it still opens the loan form (expected until Task 18) — so instead: temporarily open devtools console and run:

```js
const { useBillStore } = await import('/src/features/bills/billStore.ts')
useBillStore.getState().addBill({ name: 'Electricity', color: '#F3622D', category: 'Utilities', amount: 1500, nextDueDate: '2026-08-25' })
```

Refresh `/#/bills`, confirm the new bill card appears, tap it to open `/#/bills/<id>`, confirm the detail page shows the amount, category, "Due Aug 25" banner, and an empty "Payment History". Tap "Mark as Paid" → Confirm, and confirm the due date advances one month and a payment record appears in the history. Open the more-menu (⋮), tap "Undo last payment", confirm the due date and history revert. Edit the bill (change amount), save, confirm it updates. Archive it via the more-menu, confirm it disappears from `/#/bills`'s default list. Navigate to `/#/bills/does-not-exist` and confirm the "Bill not found" empty state appears with a working "Back to bills" button.

- [ ] **Step 6: Commit**

```bash
git add src/features/bills/BillDetails.tsx src/pages/BillDetailsPage.tsx src/App.tsx
git commit -m "Add BillDetails and /bills/:id route"
```

---

### Task 8: Savings data types

**Files:**
- Create: `src/features/savings/savingsTypes.ts`

**Interfaces:**
- Produces: `SavingsGoal`, `SavingsTransaction`, `SavingsGoalFormData` — consumed by every later Savings task.

- [ ] **Step 1: Create the file**

```ts
export type SavingsGoal = {
  id: string
  name: string
  color: string
  targetAmount: number
  currentAmount: number
  notes?: string
  createdAt: string
  archived?: boolean
}

export type SavingsTransaction = {
  id: string
  goalId: string
  type: 'deposit' | 'withdrawal'
  amount: number
  note?: string
  createdAt: string
}

export type SavingsGoalFormData = {
  name: string
  color: string
  targetAmount: number
  notes?: string
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/savings/savingsTypes.ts
git commit -m "Add savings data types"
```

---

### Task 9: Savings utils (progress calculation)

**Files:**
- Create: `src/features/savings/savingsUtils.ts`

**Interfaces:**
- Consumes: `SavingsGoal` (Task 8).
- Produces: `progress(goal)`, `progressPercent(goal)`, `isGoalReached(goal)` — consumed by `savingsStore.ts` (Task 10), `SavingsGoalCard.tsx` (Task 13), `SavingsGoalDetails.tsx` (Task 15).

- [ ] **Step 1: Create the file**

```ts
import type { SavingsGoal } from './savingsTypes'

export function progress(goal: SavingsGoal): number {
  if (goal.targetAmount <= 0) return 0
  return Math.min(1, goal.currentAmount / goal.targetAmount)
}

export function progressPercent(goal: SavingsGoal): number {
  return Math.round(progress(goal) * 100)
}

export function isGoalReached(goal: SavingsGoal): boolean {
  return goal.targetAmount > 0 && goal.currentAmount >= goal.targetAmount
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/savings/savingsUtils.ts
git commit -m "Add savings progress utilities"
```

---

### Task 10: Savings store

**Files:**
- Create: `src/features/savings/savingsStore.ts`

**Interfaces:**
- Consumes: `SavingsGoal`, `SavingsTransaction`, `SavingsGoalFormData` (Task 8); `isGoalReached` (Task 9); `showToast` (existing); `triggerConfetti` from `src/components/Confetti.tsx` (existing, signature `triggerConfetti(): void`).
- Produces: `useSavingsStore` hook exposing `goals: SavingsGoal[]`, `transactions: SavingsTransaction[]`, `addGoal(data: SavingsGoalFormData): void`, `updateGoal(id: string, data: Partial<SavingsGoalFormData>): void`, `addFunds(goalId: string, amount: number, note?: string): void`, `withdrawFunds(goalId: string, amount: number, note?: string): void`, `deleteGoal(id: string): void`, `archiveGoal(id: string): void`, `unarchiveGoal(id: string): void`, `getTransactionsForGoal(goalId: string): SavingsTransaction[]`, `importBackup(json: string): void` — consumed by every later Savings UI task and `backup.ts` (Task 19).

- [ ] **Step 1: Create the file**

```ts
import { create } from 'zustand'
import type { SavingsGoal, SavingsGoalFormData, SavingsTransaction } from './savingsTypes'
import { isGoalReached } from './savingsUtils'
import { showToast } from '../../components/Toast'
import { triggerConfetti } from '../../components/Confetti'

const GOALS_KEY = 'loan-tracker-savings-goals'
const TRANSACTIONS_KEY = 'loan-tracker-savings-transactions'

function loadGoals(): SavingsGoal[] {
  try {
    const data = localStorage.getItem(GOALS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveGoals(goals: SavingsGoal[]) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals))
}

function loadTransactions(): SavingsTransaction[] {
  try {
    const data = localStorage.getItem(TRANSACTIONS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveTransactions(transactions: SavingsTransaction[]) {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions))
}

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
  importBackup: (json: string) => void
}

export const useSavingsStore = create<SavingsStore>((set, get) => ({
  goals: loadGoals(),
  transactions: loadTransactions(),

  addGoal: (data) =>
    set((state) => {
      const newGoal: SavingsGoal = {
        ...data,
        id: crypto.randomUUID(),
        currentAmount: 0,
        createdAt: new Date().toISOString(),
      }
      const goals = [...state.goals, newGoal]
      saveGoals(goals)
      showToast(`"${data.name}" added`)
      return { goals }
    }),

  updateGoal: (id, data) =>
    set((state) => {
      const goals = state.goals.map((goal) => (goal.id === id ? { ...goal, ...data } : goal))
      saveGoals(goals)
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
      saveGoals(goals)
      saveTransactions(transactions)
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
      saveGoals(goals)
      saveTransactions(transactions)
      if (updated) showToast('Funds withdrawn')
      return { goals, transactions }
    }),

  deleteGoal: (id) =>
    set((state) => {
      const goal = state.goals.find((g) => g.id === id)
      const goals = state.goals.filter((g) => g.id !== id)
      const transactions = state.transactions.filter((t) => t.goalId !== id)
      saveGoals(goals)
      saveTransactions(transactions)
      if (goal) showToast(`"${goal.name}" deleted`)
      return { goals, transactions }
    }),

  archiveGoal: (id) =>
    set((state) => {
      const goals = state.goals.map((g) => (g.id === id ? { ...g, archived: true } : g))
      saveGoals(goals)
      const goal = goals.find((g) => g.id === id)
      if (goal) showToast(`"${goal.name}" archived`)
      return { goals }
    }),

  unarchiveGoal: (id) =>
    set((state) => {
      const goals = state.goals.map((g) => (g.id === id ? { ...g, archived: false } : g))
      saveGoals(goals)
      const goal = goals.find((g) => g.id === id)
      if (goal) showToast(`"${goal.name}" restored`)
      return { goals }
    }),

  getTransactionsForGoal: (goalId) => {
    return get().transactions
      .filter((t) => t.goalId === goalId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  importBackup: (json) => {
    try {
      const data = JSON.parse(json)
      if (!Array.isArray(data.savingsGoals)) return
      const goals: SavingsGoal[] = data.savingsGoals
      const transactions: SavingsTransaction[] = Array.isArray(data.savingsTransactions) ? data.savingsTransactions : []
      saveGoals(goals)
      saveTransactions(transactions)
      set({ goals, transactions })
    } catch {
      // Swallow — importAllData (Task 19) already validated the JSON parses.
    }
  },
}))
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/savings/savingsStore.ts
git commit -m "Add savings Zustand store"
```

---

### Task 11: Savings goal form

**Files:**
- Create: `src/features/savings/SavingsGoalForm.tsx`

**Interfaces:**
- Consumes: `SavingsGoal`, `SavingsGoalFormData` (Task 8); `DEFAULT_COLOR` (existing); `ColorPicker` (existing); `useBodyScrollLock` (existing).
- Produces: `SavingsGoalForm` component, props `{ onSubmit: (data: SavingsGoalFormData) => void; onClose: () => void; initial?: SavingsGoal }` — consumed by `SavingsGoalDetails.tsx` (Task 15, edit mode) and `App.tsx` (Task 18, create mode).

- [ ] **Step 1: Create the file**

```tsx
import { useState, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import type { SavingsGoal, SavingsGoalFormData } from './savingsTypes'
import { DEFAULT_COLOR } from '../loans/loanTypes'
import ColorPicker from '../../components/ColorPicker'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

type Props = {
  onSubmit: (data: SavingsGoalFormData) => void
  onClose: () => void
  initial?: SavingsGoal
}

export default function SavingsGoalForm({ onSubmit, onClose, initial }: Props) {
  const isEdit = !!initial
  useBodyScrollLock(true)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef<number | null>(null)

  const handleDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragStartY.current = clientY
    setIsDragging(true)
  }, [])

  const handleDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (dragStartY.current === null) return
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const delta = Math.max(0, clientY - dragStartY.current)
    setDragY(delta)
  }, [])

  const handleDragEnd = useCallback(() => {
    if (dragY > 120) {
      onClose()
    } else {
      setDragY(0)
    }
    dragStartY.current = null
    setIsDragging(false)
  }, [dragY, onClose])

  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? DEFAULT_COLOR)
  const [targetAmount, setTargetAmount] = useState(initial ? String(initial.targetAmount) : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function clearError(field: string) {
    setErrors((prev) => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Name is required'
    if (!targetAmount || Number(targetAmount) <= 0) newErrors.targetAmount = 'Enter a valid target'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      name: name.trim(),
      color,
      targetAmount: Number(targetAmount),
      notes: notes.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-overlay z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div
        className="bg-card w-full h-full sm:h-auto sm:max-w-lg sm:rounded-2xl rounded-none sm:max-h-[92vh] overflow-y-auto border-0 sm:border border-themed animate-slide-up custom-scroll"
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          className="flex justify-center pt-3 pb-1 sm:hidden cursor-grab active:cursor-grabbing"
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={() => { if (isDragging) handleDragEnd() }}
        >
          <div className="w-9 h-1 rounded-full bg-muted opacity-40" />
        </div>

        <div className="sticky top-0 z-10 bg-card flex items-center justify-between px-5 pt-3 pb-4 sm:static sm:pt-5 sm:border-b-0 border-b border-divider">
          <h2 className="text-[20px] font-bold text-primary tracking-tight">{isEdit ? 'Edit Goal' : 'New Goal'}</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center hover:opacity-60 transition-opacity">
            <X className="w-[18px] h-[18px] text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4">
          <Field label="Goal Name" id="goal-name" error={errors.name}>
            <input
              id="goal-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); clearError('name') }}
              placeholder="e.g. Emergency Fund"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'goal-name-error' : undefined}
              className="input-field"
            />
          </Field>

          <Field label="Color">
            <ColorPicker value={color} onChange={setColor} />
          </Field>

          <Field label="Target Amount (₱)" id="goal-target" error={errors.targetAmount}>
            <input
              id="goal-target"
              type="number"
              step="0.01"
              value={targetAmount}
              onChange={(e) => { setTargetAmount(e.target.value); clearError('targetAmount') }}
              inputMode="decimal" placeholder="50,000"
              aria-invalid={!!errors.targetAmount}
              aria-describedby={errors.targetAmount ? 'goal-target-error' : undefined}
              className="input-field"
            />
          </Field>

          <Field label="Notes" id="goal-notes">
            <textarea
              id="goal-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What's this goal for? (optional)"
              maxLength={300}
              rows={3}
              className="input-field resize-none"
            />
          </Field>

          <button
            type="submit"
            className="w-full text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all duration-200 text-[15px] tracking-tight hover:opacity-90"
            style={{ backgroundColor: color }}
          >
            {isEdit ? 'Save Changes' : 'Add Goal'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string
  id?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">{label}</label>
      <div className={error ? 'rounded-[14px] ring-2 ring-red-500/50' : undefined}>{children}</div>
      {error && <p id={id ? `${id}-error` : undefined} className="text-[11px] text-red-500 dark:text-red-400 mt-1 font-medium">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `npx tsc -b && npx eslint src/features/savings/SavingsGoalForm.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/savings/SavingsGoalForm.tsx
git commit -m "Add SavingsGoalForm component"
```

---

### Task 12: Savings transaction form (Add Funds / Withdraw)

**Files:**
- Create: `src/features/savings/SavingsTransactionForm.tsx`

**Interfaces:**
- Consumes: `SavingsGoal` (Task 8); `useBodyScrollLock` (existing); `CurrencyAmount` (existing).
- Produces: `SavingsTransactionForm` component, props `{ goal: SavingsGoal; mode: 'deposit' | 'withdrawal'; onSubmit: (amount: number, note?: string) => void; onClose: () => void }` — consumed by `SavingsGoalDetails.tsx` (Task 15).

- [ ] **Step 1: Create the file**

```tsx
import { useState } from 'react'
import { X } from 'lucide-react'
import type { SavingsGoal } from './savingsTypes'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import CurrencyAmount from '../../components/CurrencyAmount'

type Props = {
  goal: SavingsGoal
  mode: 'deposit' | 'withdrawal'
  onSubmit: (amount: number, note?: string) => void
  onClose: () => void
}

export default function SavingsTransactionForm({ goal, mode, onSubmit, onClose }: Props) {
  useBodyScrollLock(true)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const isDeposit = mode === 'deposit'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (!amount || value <= 0) {
      setError('Enter a valid amount')
      return
    }
    if (!isDeposit && value > goal.currentAmount) {
      setError('Cannot withdraw more than the current balance')
      return
    }
    onSubmit(value, note.trim() || undefined)
  }

  return (
    <div className="fixed inset-0 bg-overlay z-50 flex items-center justify-center p-5 animate-fade-in">
      <div className="bg-card rounded-2xl p-6 max-w-[360px] w-full border border-themed transition-colors animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-primary text-[18px] tracking-tight">
            {isDeposit ? 'Add Funds' : 'Withdraw'}
          </h3>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center hover:opacity-60 transition-opacity">
            <X className="w-[18px] h-[18px] text-secondary" />
          </button>
        </div>

        <p className="text-[12px] text-muted mb-4">
          Current balance: <CurrencyAmount value={goal.currentAmount} />
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="txn-amount" className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Amount (₱)
            </label>
            <div className={error ? 'rounded-[14px] ring-2 ring-red-500/50' : undefined}>
              <input
                id="txn-amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError('') }}
                inputMode="decimal" placeholder="1,000"
                aria-invalid={!!error}
                className="input-field"
              />
            </div>
            {error && <p className="text-[11px] text-red-500 dark:text-red-400 mt-1 font-medium">{error}</p>}
          </div>

          <div>
            <label htmlFor="txn-note" className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Note
            </label>
            <input
              id="txn-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
              maxLength={100}
              className="input-field"
            />
          </div>

          <button
            type="submit"
            className="w-full text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all duration-200 text-[15px] tracking-tight hover:opacity-90"
            style={{ backgroundColor: isDeposit ? goal.color : '#EF4444' }}
          >
            {isDeposit ? 'Add Funds' : 'Withdraw'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `npx tsc -b && npx eslint src/features/savings/SavingsTransactionForm.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/savings/SavingsTransactionForm.tsx
git commit -m "Add SavingsTransactionForm component"
```

---

### Task 13: Savings goal card

**Files:**
- Create: `src/features/savings/SavingsGoalCard.tsx`

**Interfaces:**
- Consumes: `SavingsGoal` (Task 8); `progressPercent` (Task 9); `DEFAULT_COLOR` (existing); `CurrencyAmount` (existing).
- Produces: `SavingsGoalCard` component, props `{ goal: SavingsGoal }` — consumed by `SavingsPage.tsx` (Task 14).

- [ ] **Step 1: Create the file**

```tsx
import { useNavigate } from 'react-router-dom'
import type { SavingsGoal } from './savingsTypes'
import { DEFAULT_COLOR } from '../loans/loanTypes'
import { progressPercent } from './savingsUtils'
import CurrencyAmount from '../../components/CurrencyAmount'

type Props = { goal: SavingsGoal }

export default function SavingsGoalCard({ goal }: Props) {
  const navigate = useNavigate()
  const color = goal.color || DEFAULT_COLOR
  const pct = progressPercent(goal)

  return (
    <button
      onClick={() => navigate(`/savings/${goal.id}`)}
      className="w-full bg-card rounded-2xl p-4 border border-themed text-left transition-all duration-200 active:scale-[0.97] hover:bg-card-hover group"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-10 h-10 rounded-[13px] flex items-center justify-center text-[14px] font-bold text-white shrink-0"
          style={{ backgroundColor: color }}
        >
          {goal.name.charAt(0).toUpperCase()}
        </div>
        <h3 className="font-semibold text-primary text-[15px] leading-tight tracking-tight flex-1 min-w-0 truncate">{goal.name}</h3>
      </div>

      <div className="flex justify-between items-end mb-3">
        <p className="text-[20px] font-bold font-mono tracking-tight leading-none" style={{ color }}>
          <CurrencyAmount value={goal.currentAmount} />
        </p>
        <p className="text-[12px] text-muted">
          of <CurrencyAmount value={goal.targetAmount} />
        </p>
      </div>

      <div className="w-full h-[6px] rounded-full overflow-hidden mb-2" style={{ backgroundColor: `${color}15` }}>
        <div
          className="h-[6px] rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.max(pct, 2)}%`, background: `linear-gradient(90deg, ${color}, ${color}dd)` }}
        />
      </div>
      <span className="text-[11px] font-semibold" style={{ color }}>{pct}% saved</span>
    </button>
  )
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `npx tsc -b && npx eslint src/features/savings/SavingsGoalCard.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/savings/SavingsGoalCard.tsx
git commit -m "Add SavingsGoalCard component"
```

---

### Task 14: Savings list page + `/savings` route

**Files:**
- Create: `src/pages/SavingsPage.tsx`
- Modify: `src/App.tsx` (import + route, same pattern as Task 6 Step 2)

**Interfaces:**
- Consumes: `useSavingsStore` (Task 10); `SavingsGoalCard` (Task 13); `EmptyState` (existing); `CurrencyAmount` (existing); `BRAND_GRADIENT` (existing).
- Produces: `SavingsPage` default export, mounted at `/savings` — consumed by `App.tsx`'s router, `BottomNav`'s "More" active-state check (Task 17), `App.tsx`'s add-button routing (Task 18).

- [ ] **Step 1: Create `src/pages/SavingsPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { PiggyBank, Archive } from 'lucide-react'
import { useSavingsStore } from '../features/savings/savingsStore'
import SavingsGoalCard from '../features/savings/SavingsGoalCard'
import EmptyState from '../components/EmptyState'
import CurrencyAmount from '../components/CurrencyAmount'
import { BRAND_GRADIENT } from '../constants/styles'

export default function SavingsPage() {
  const { goals } = useSavingsStore()
  const [showArchived, setShowArchived] = useState(false)

  const { activeGoals, archivedGoals } = useMemo(() => ({
    activeGoals: goals.filter((g) => !g.archived),
    archivedGoals: goals.filter((g) => g.archived),
  }), [goals])

  const totalSaved = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0)
  const visible = showArchived ? archivedGoals : activeGoals

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <div style={{ background: BRAND_GRADIENT }}>
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-5">
          <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight">Savings</h1>
          <p className="text-[12px] text-white/55 font-medium mb-4">
            {activeGoals.length} active {activeGoals.length === 1 ? 'goal' : 'goals'}
          </p>

          <div className="rounded-2xl p-4 bg-white/[0.13] backdrop-blur-sm border border-white/[0.12]">
            <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Total Saved</span>
            <p className="text-[28px] font-bold font-mono text-white tracking-tight mt-1">
              <CurrencyAmount value={totalSaved} />
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 pt-3 pb-28">
        {archivedGoals.length > 0 && (
          <div className="flex mb-3">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${
                showArchived ? 'bg-brand text-on-brand' : 'bg-subtle text-secondary hover:opacity-80'
              }`}
            >
              <Archive className="w-3 h-3" />
              Archived ({archivedGoals.length})
            </button>
          </div>
        )}

        <div className={visible.length === 0 ? '' : 'space-y-3'}>
          {visible.length === 0 ? (
            <EmptyState
              icon={PiggyBank}
              title={showArchived ? 'No archived goals' : 'No savings goals yet'}
              subtitle={showArchived ? undefined : 'Add a goal to start setting money aside'}
            >
              {!showArchived && (
                <p className="text-[13px] text-muted">Tap <span className="text-brand font-semibold">+</span> below to get started</p>
              )}
            </EmptyState>
          ) : (
            visible.map((goal) => <SavingsGoalCard key={goal.id} goal={goal} />)
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the route into `src/App.tsx`**

Find:

```tsx
import BillDetailsPage from './pages/BillDetailsPage'
```

Change to:

```tsx
import BillDetailsPage from './pages/BillDetailsPage'
import SavingsPage from './pages/SavingsPage'
```

Find:

```tsx
        <Route path="/bills/:id" element={<BillDetailsPage />} />
      </Routes>
```

Change to:

```tsx
        <Route path="/bills/:id" element={<BillDetailsPage />} />
        <Route path="/savings" element={<SavingsPage />} />
      </Routes>
```

- [ ] **Step 3: Verify it compiles and lints**

Run: `npx tsc -b && npx eslint src/pages/SavingsPage.tsx src/App.tsx`
Expected: no errors.

- [ ] **Step 4: Manual check**

Navigate to `http://localhost:5173/#/savings`. Confirm an empty state ("No savings goals yet") renders with a gradient header showing "Savings" / "0 active goals" and a "Total Saved ₱0.00" card.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SavingsPage.tsx src/App.tsx
git commit -m "Add SavingsPage and /savings route"
```

---

### Task 15: Savings goal details page + `/savings/:id` route

**Files:**
- Create: `src/features/savings/SavingsGoalDetails.tsx`, `src/pages/SavingsGoalDetailsPage.tsx`
- Modify: `src/App.tsx` (import + route, same pattern as Task 6 Step 2)

**Interfaces:**
- Consumes: `SavingsGoal` (Task 8); `progressPercent` (Task 9); `useSavingsStore` (Task 10, specifically `updateGoal`, `addFunds`, `withdrawFunds`, `archiveGoal`, `unarchiveGoal`, `transactions`); `SavingsGoalForm` (Task 11); `SavingsTransactionForm` (Task 12); `DEFAULT_COLOR` (existing); `showToast` (existing); `useBodyScrollLock` (existing); `CurrencyAmount` (existing).
- Produces: `SavingsGoalDetails` component, props `{ goal: SavingsGoal; onDelete: () => void; onBack: () => void }`; `SavingsGoalDetailsPage` default export mounted at `/savings/:id`.

- [ ] **Step 1: Create `src/features/savings/SavingsGoalDetails.tsx`**

```tsx
import { useState, useMemo } from 'react'
import {
  ArrowLeft, Trash2, Pencil, Archive, ArchiveRestore, MoreVertical,
  ArrowDownCircle, ArrowUpCircle, Target,
} from 'lucide-react'
import { DEFAULT_COLOR } from '../loans/loanTypes'
import type { SavingsGoal } from './savingsTypes'
import { progressPercent } from './savingsUtils'
import { useSavingsStore } from './savingsStore'
import SavingsGoalForm from './SavingsGoalForm'
import SavingsTransactionForm from './SavingsTransactionForm'
import { showToast } from '../../components/Toast'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import CurrencyAmount from '../../components/CurrencyAmount'

type Props = {
  goal: SavingsGoal
  onDelete: () => void
  onBack: () => void
}

export default function SavingsGoalDetails({ goal, onDelete, onBack }: Props) {
  const [showConfirm, setShowConfirm] = useState<'archive' | 'delete' | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [txnMode, setTxnMode] = useState<'deposit' | 'withdrawal' | null>(null)
  useBodyScrollLock(showConfirm !== null || showEdit || txnMode !== null)
  const updateGoal = useSavingsStore((s) => s.updateGoal)
  const addFunds = useSavingsStore((s) => s.addFunds)
  const withdrawFunds = useSavingsStore((s) => s.withdrawFunds)
  const archiveGoal = useSavingsStore((s) => s.archiveGoal)
  const unarchiveGoal = useSavingsStore((s) => s.unarchiveGoal)
  const transactions = useSavingsStore((s) => s.transactions)
  const goalTransactions = useMemo(
    () => transactions.filter((t) => t.goalId === goal.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [transactions, goal.id],
  )
  const color = goal.color || DEFAULT_COLOR
  const pct = progressPercent(goal)

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      {/* Header */}
      <div className="bg-header backdrop-blur-header border-b border-themed sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2 px-4 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button onClick={onBack} className="w-9 h-9 flex-shrink-0 flex items-center justify-center hover:opacity-60 transition-opacity">
              <ArrowLeft className="w-[18px] h-[18px] text-secondary" />
            </button>
            <div
              className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-[12px] font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {goal.name.charAt(0).toUpperCase()}
            </div>
            <h1 className="font-semibold text-primary text-[16px] tracking-tight truncate min-w-0">{goal.name}</h1>
          </div>
          <div className="flex items-center flex-shrink-0 relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="w-9 h-9 flex items-center justify-center hover:opacity-60 transition-opacity"
              title="More actions"
              aria-haspopup="menu"
              aria-expanded={showMenu}
            >
              <MoreVertical className="w-[18px] h-[18px] text-secondary" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <div role="menu" className="absolute right-0 top-11 bg-card border border-themed rounded-xl z-40 py-1 min-w-[180px] shadow-lg animate-scale-in">
                  <button
                    role="menuitem"
                    onClick={() => { setShowMenu(false); setShowEdit(true) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-secondary hover:bg-subtle transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setShowMenu(false); setShowConfirm('archive') }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-secondary hover:bg-subtle transition-colors"
                  >
                    {goal.archived ? (
                      <>
                        <ArchiveRestore className="w-4 h-4 text-amber-500" />
                        Restore goal
                      </>
                    ) : (
                      <>
                        <Archive className="w-4 h-4" />
                        Archive goal
                      </>
                    )}
                  </button>
                  <div className="my-1 border-t border-themed" />
                  <button
                    role="menuitem"
                    onClick={() => { setShowMenu(false); setShowConfirm('delete') }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-red-500 dark:text-red-400 hover:bg-subtle transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete goal
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-8 space-y-4">
        {/* Hero */}
        <div className="bg-card rounded-2xl border border-themed transition-colors overflow-hidden">
          {goal.archived && (
            <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold uppercase tracking-wider text-center py-2 border-b border-amber-500/20">
              Archived
            </div>
          )}
          <div className="px-4 pt-6 pb-4 text-center">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-1.5">Current Balance</p>
            <p className="text-[36px] font-bold font-mono text-primary tracking-tighter leading-none"><CurrencyAmount value={goal.currentAmount} /></p>
            <p className="text-[12px] text-muted mt-2">
              of <CurrencyAmount value={goal.targetAmount} /> target
            </p>
          </div>
          <div className="px-4 pb-5">
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: `${color}15` }}>
              <div
                className="h-2.5 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.max(pct, 2)}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
              />
            </div>
            <div className="flex justify-between items-center mt-2.5">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${color}10`, color }}>
                {pct}% complete
              </span>
              {pct >= 100 && (
                <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" />
                  Goal reached
                </span>
              )}
            </div>
          </div>
        </div>

        {goal.notes && (
          <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-1.5">Notes</p>
            <p className="text-[13px] text-secondary whitespace-pre-wrap break-words leading-relaxed">{goal.notes}</p>
          </div>
        )}

        {/* Add/Withdraw actions */}
        {!goal.archived && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setTxnMode('deposit')}
              className="flex items-center justify-center gap-1.5 py-3 rounded-2xl text-white font-bold text-[14px] tracking-tight active:scale-[0.98] transition-all hover:opacity-90"
              style={{ backgroundColor: color }}
            >
              <ArrowDownCircle className="w-4 h-4" />
              Add Funds
            </button>
            <button
              onClick={() => setTxnMode('withdrawal')}
              disabled={goal.currentAmount <= 0}
              className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-subtle text-secondary font-bold text-[14px] tracking-tight active:scale-[0.98] transition-all hover:opacity-80 disabled:opacity-40 disabled:pointer-events-none"
            >
              <ArrowUpCircle className="w-4 h-4" />
              Withdraw
            </button>
          </div>
        )}

        {/* Transaction history */}
        <div className="bg-card rounded-2xl border border-themed transition-colors overflow-hidden">
          <div className="px-4 pt-4 pb-2.5">
            <h3 className="font-bold text-primary text-[15px] tracking-tight">Transaction History</h3>
          </div>
          {goalTransactions.length === 0 ? (
            <p className="px-4 pb-4 text-[13px] text-muted">No transactions recorded yet</p>
          ) : (
            <div>
              {goalTransactions.map((t) => (
                <div key={t.id} className="px-4 py-3.5 flex items-center gap-3 border-t border-divider">
                  {t.type === 'deposit' ? (
                    <ArrowDownCircle className="w-[18px] h-[18px] text-emerald-500 shrink-0" />
                  ) : (
                    <ArrowUpCircle className="w-[18px] h-[18px] text-red-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-bold text-primary">
                      {new Date(t.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {t.note && <p className="text-[11px] text-muted truncate">{t.note}</p>}
                  </div>
                  <span className={`text-[14px] font-bold ${t.type === 'deposit' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {t.type === 'deposit' ? '+' : '-'}<CurrencyAmount value={t.amount} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <SavingsGoalForm
          initial={goal}
          onSubmit={(data) => {
            updateGoal(goal.id, data)
            setShowEdit(false)
            showToast(`"${data.name}" updated`)
          }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Add/withdraw modal */}
      {txnMode && (
        <SavingsTransactionForm
          goal={goal}
          mode={txnMode}
          onSubmit={(amount, note) => {
            if (txnMode === 'deposit') addFunds(goal.id, amount, note)
            else withdrawFunds(goal.id, amount, note)
            setTxnMode(null)
          }}
          onClose={() => setTxnMode(null)}
        />
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-overlay z-50 flex items-center justify-center p-5 animate-fade-in">
          <div className="bg-card rounded-2xl p-6 max-w-[320px] w-full border border-themed transition-colors animate-scale-in">
            <h3 className="font-bold text-primary text-[18px] tracking-tight mb-2">
              {showConfirm === 'archive' ? (goal.archived ? 'Restore Goal' : 'Archive Goal') : 'Delete Goal'}
            </h3>
            {showConfirm === 'archive' ? (
              <p className="text-[13px] text-secondary mb-6">
                {goal.archived
                  ? `Restore "${goal.name}"? It will appear in your active goals again.`
                  : `Archive "${goal.name}"? It will be hidden from your goals list but can be restored later.`}
              </p>
            ) : (
              <p className="text-[13px] text-secondary mb-6">Delete "{goal.name}"? This cannot be undone.</p>
            )}
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 py-3 rounded-xl bg-subtle text-secondary font-semibold text-[14px] hover:opacity-80 transition-opacity"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showConfirm === 'archive') {
                    if (goal.archived) unarchiveGoal(goal.id)
                    else {
                      archiveGoal(goal.id)
                      onBack()
                    }
                  } else onDelete()
                  setShowConfirm(null)
                }}
                className="flex-1 py-3 rounded-xl font-semibold text-[14px] text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: showConfirm === 'archive' ? '#6366F1' : '#EF4444' }}
              >
                {showConfirm === 'archive' ? (goal.archived ? 'Restore' : 'Archive') : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/pages/SavingsGoalDetailsPage.tsx`**

```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useSavingsStore } from '../features/savings/savingsStore'
import SavingsGoalDetails from '../features/savings/SavingsGoalDetails'
import EmptyState from '../components/EmptyState'

export default function SavingsGoalDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { goals, deleteGoal } = useSavingsStore()
  const goal = goals.find((g) => g.id === id)

  if (!goal) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center transition-colors duration-300">
        <EmptyState icon={Search} title="Goal not found" subtitle="This goal may have been deleted, or the link is invalid">
          <button
            onClick={() => navigate('/savings')}
            className="bg-brand text-on-brand text-[13px] font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity active:scale-95"
          >
            Back to savings
          </button>
        </EmptyState>
      </div>
    )
  }

  return (
    <SavingsGoalDetails
      goal={goal}
      onDelete={() => {
        deleteGoal(goal.id)
        navigate('/savings')
      }}
      onBack={() => navigate(-1)}
    />
  )
}
```

- [ ] **Step 3: Wire the route into `src/App.tsx`**

Find:

```tsx
import SavingsPage from './pages/SavingsPage'
```

Change to:

```tsx
import SavingsPage from './pages/SavingsPage'
import SavingsGoalDetailsPage from './pages/SavingsGoalDetailsPage'
```

Find:

```tsx
        <Route path="/savings" element={<SavingsPage />} />
      </Routes>
```

Change to:

```tsx
        <Route path="/savings" element={<SavingsPage />} />
        <Route path="/savings/:id" element={<SavingsGoalDetailsPage />} />
      </Routes>
```

- [ ] **Step 4: Verify it compiles and lints**

Run: `npx tsc -b && npx eslint src/features/savings/SavingsGoalDetails.tsx src/pages/SavingsGoalDetailsPage.tsx src/App.tsx`
Expected: no errors.

- [ ] **Step 5: Manual check**

In the running app, open devtools console and run:

```js
const { useSavingsStore } = await import('/src/features/savings/savingsStore.ts')
useSavingsStore.getState().addGoal({ name: 'Emergency Fund', color: '#3ECF8E', targetAmount: 10000 })
```

Refresh `/#/savings`, confirm the goal card appears at 0%. Tap it, confirm the detail page shows ₱0.00 of ₱10,000.00 target, 0% complete, and disabled-looking "Withdraw" button (balance is 0). Tap "Add Funds", enter 4000, submit — confirm balance/progress bar update to 40% and a deposit row appears in Transaction History. Tap "Withdraw", enter 5000 (more than balance) — confirm it's rejected with "Cannot withdraw more than the current balance". Withdraw 1000 instead — confirm balance drops to ₱3,000.00 and a withdrawal row (red, "-₱1,000.00") appears. Add funds again with an amount that pushes the balance to/above ₱10,000 — confirm confetti fires and a "reached its goal!" toast appears, and the hero card shows "Goal reached". Edit the goal (rename it), confirm it updates. Archive it, confirm it's gone from the default `/#/savings` list.

- [ ] **Step 6: Commit**

```bash
git add src/features/savings/SavingsGoalDetails.tsx src/pages/SavingsGoalDetailsPage.tsx src/App.tsx
git commit -m "Add SavingsGoalDetails and /savings/:id route"
```

---

### Task 16: More menu page + `/more` route

**Files:**
- Create: `src/pages/MorePage.tsx`
- Modify: `src/App.tsx` (import + route, same pattern as Task 6 Step 2)

**Interfaces:**
- Consumes: `BRAND_GRADIENT` (existing).
- Produces: `MorePage` default export, mounted at `/more` — consumed by `App.tsx`'s router and `BottomNav`'s "More" tab (Task 17).

- [ ] **Step 1: Create `src/pages/MorePage.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'
import { BarChart3, Receipt, PiggyBank, ChevronRight } from 'lucide-react'
import { BRAND_GRADIENT } from '../constants/styles'

const MORE_ITEMS = [
  { path: '/analytics', icon: BarChart3, label: 'Analytics', description: 'Insights on your loans' },
  { path: '/bills', icon: Receipt, label: 'Bills', description: 'Track your monthly bills' },
  { path: '/savings', icon: PiggyBank, label: 'Savings', description: 'Track your savings goals' },
] as const

export default function MorePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <div style={{ background: BRAND_GRADIENT }}>
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-5">
          <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight">More</h1>
          <p className="text-[12px] text-white/55 font-medium">Explore your finances</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-2.5">
        {MORE_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 bg-card rounded-2xl border border-themed p-4 text-left transition-all duration-200 active:scale-[0.98] hover:bg-card-hover"
            >
              <div className="w-9 h-9 rounded-[11px] bg-brand/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-primary text-[14px] tracking-tight">{item.label}</p>
                <p className="text-[12px] text-muted">{item.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire the route into `src/App.tsx`**

Find:

```tsx
import SavingsGoalDetailsPage from './pages/SavingsGoalDetailsPage'
```

Change to:

```tsx
import SavingsGoalDetailsPage from './pages/SavingsGoalDetailsPage'
import MorePage from './pages/MorePage'
```

Find:

```tsx
        <Route path="/savings/:id" element={<SavingsGoalDetailsPage />} />
      </Routes>
```

Change to:

```tsx
        <Route path="/savings/:id" element={<SavingsGoalDetailsPage />} />
        <Route path="/more" element={<MorePage />} />
      </Routes>
```

- [ ] **Step 3: Verify it compiles and lints**

Run: `npx tsc -b && npx eslint src/pages/MorePage.tsx src/App.tsx`
Expected: no errors.

- [ ] **Step 4: Manual check**

Navigate to `http://localhost:5173/#/more`. Confirm three rows appear (Analytics, Bills, Savings), each with an icon, label, description, and chevron. Tap each and confirm it navigates to the corresponding page, then use the browser back button to return to `/more` each time.

- [ ] **Step 5: Commit**

```bash
git add src/pages/MorePage.tsx src/App.tsx
git commit -m "Add MorePage and /more route"
```

---

### Task 17: Update bottom nav (More tab, active state, hidden paths)

**Files:**
- Modify: `src/components/BottomNav.tsx` (entire file — small enough to replace wholesale)

**Interfaces:**
- Consumes: `MorePage`'s route `/more` (Task 16), `BillsPage`'s route `/bills` (Task 6), `SavingsPage`'s route `/savings` (Task 14), `AnalyticsPage`'s existing route `/analytics`.
- Produces: no new exports — `BottomNav`'s prop signature `{ onAdd: () => void }` is unchanged, so `App.tsx` doesn't need to change because of this task.

- [ ] **Step 1: Replace the file contents**

Find (the whole current file):

```tsx
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, CalendarDays, BarChart3, Settings, Plus } from 'lucide-react'

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { path: '__add__', icon: Plus, label: 'Add' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/settings', icon: Settings, label: 'Settings' },
] as const

export default function BottomNav({ onAdd }: { onAdd: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()

  // Hide on detail pages
  const hiddenPaths = ['/loan/']
  if (hiddenPaths.some((p) => location.pathname.startsWith(p))) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
      <div className="bg-header backdrop-blur-header border-t border-themed transition-colors pointer-events-auto">
      <div className="max-w-2xl mx-auto grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map((item) => {
          if (item.path === '__add__') {
            return (
              <div key="add" className="flex justify-center -mt-4 pointer-events-auto">
                <button
                  onClick={onAdd}
                  aria-label="Add loan"
                  className="w-14 h-14 rounded-full bg-brand flex items-center justify-center hover:bg-brand-light active:scale-90 transition-all duration-200 border-4"
                  style={{ borderColor: 'var(--color-card)' }}
                >
                  <Plus className="w-7 h-7 text-on-brand" strokeWidth={2.5} />
                </button>
              </div>
            )
          }

          const isActive = location.pathname === item.path
          const Icon = item.icon

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                isActive ? 'text-brand' : 'text-muted hover:text-secondary'
              }`}
            >
              <Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.2 : 1.5} />
              <span className={`text-[10px] tracking-wide ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
      </div>
    </div>
  )
}
```

Replace with:

```tsx
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, CalendarDays, MoreHorizontal, Settings, Plus } from 'lucide-react'

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { path: '__add__', icon: Plus, label: 'Add' },
  { path: '/more', icon: MoreHorizontal, label: 'More' },
  { path: '/settings', icon: Settings, label: 'Settings' },
] as const

// Paths that fall under the "More" tab even though they're not /more itself
const MORE_PREFIXES = ['/more', '/analytics', '/bills', '/savings']

export default function BottomNav({ onAdd }: { onAdd: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()

  // Hide on detail pages
  const hiddenPaths = ['/loan/', '/bills/', '/savings/']
  if (hiddenPaths.some((p) => location.pathname.startsWith(p))) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
      <div className="bg-header backdrop-blur-header border-t border-themed transition-colors pointer-events-auto">
      <div className="max-w-2xl mx-auto grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map((item) => {
          if (item.path === '__add__') {
            return (
              <div key="add" className="flex justify-center -mt-4 pointer-events-auto">
                <button
                  onClick={onAdd}
                  aria-label="Add"
                  className="w-14 h-14 rounded-full bg-brand flex items-center justify-center hover:bg-brand-light active:scale-90 transition-all duration-200 border-4"
                  style={{ borderColor: 'var(--color-card)' }}
                >
                  <Plus className="w-7 h-7 text-on-brand" strokeWidth={2.5} />
                </button>
              </div>
            )
          }

          const isActive = item.path === '/more'
            ? MORE_PREFIXES.some((p) => location.pathname.startsWith(p))
            : location.pathname === item.path
          const Icon = item.icon

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                isActive ? 'text-brand' : 'text-muted hover:text-secondary'
              }`}
            >
              <Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.2 : 1.5} />
              <span className={`text-[10px] tracking-wide ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `npx tsc -b && npx eslint src/components/BottomNav.tsx`
Expected: no errors.

- [ ] **Step 3: Manual check**

In the running app: confirm the bottom nav now shows Home, Calendar, **+**, More, Settings. Tap "More" — nav highlights "More" and shows the menu from Task 16. From there tap into Analytics — confirm the nav's "More" tab is *still* highlighted (not blank) even though the URL is `/analytics`. Do the same for Bills and Savings. Open a bill or savings goal detail page and confirm the entire bottom nav disappears, same as it already does for `/loan/:id`. Go back and confirm the nav reappears.

- [ ] **Step 4: Commit**

```bash
git add src/components/BottomNav.tsx
git commit -m "Replace Analytics nav tab with More, covering Bills/Savings"
```

---

### Task 18: Context-aware add button

**Files:**
- Modify: `src/App.tsx` (imports + `AppContent`)

**Interfaces:**
- Consumes: `useLoanStore().addLoan` (existing, unchanged); `useBillStore().addBill` (Task 3); `useSavingsStore().addGoal` (Task 10); `LoanForm` (existing, unchanged); `BillForm` (Task 4); `SavingsGoalForm` (Task 11).

- [ ] **Step 1: Update imports**

Find:

```tsx
import PinScreen from './features/lock/PinScreen'
import LoanForm from './features/loans/LoanForm'
import { useLoanStore } from './features/loans/loanStore'
import { useNotificationCheck } from './features/notifications/useNotificationCheck'
```

Change to:

```tsx
import PinScreen from './features/lock/PinScreen'
import LoanForm from './features/loans/LoanForm'
import BillForm from './features/bills/BillForm'
import SavingsGoalForm from './features/savings/SavingsGoalForm'
import { useLoanStore } from './features/loans/loanStore'
import { useBillStore } from './features/bills/billStore'
import { useSavingsStore } from './features/savings/savingsStore'
import { useNotificationCheck } from './features/notifications/useNotificationCheck'
```

- [ ] **Step 2: Make `AppContent` context-aware**

Find:

```tsx
function AppContent() {
  const [showForm, setShowForm] = useState(false)
  const addLoan = useLoanStore((s) => s.addLoan)

  const handleAdd = () => {
    setShowForm(true)
  }

  return (
    <>
      <ScrollToTop />
      <ConfettiContainer />
      <ToastContainer />
      <InstallPrompt />
      <Routes>
```

Change to:

```tsx
function AppContent() {
  const [showForm, setShowForm] = useState(false)
  const location = useLocation()
  const addLoan = useLoanStore((s) => s.addLoan)
  const addBill = useBillStore((s) => s.addBill)
  const addGoal = useSavingsStore((s) => s.addGoal)

  const handleAdd = () => {
    setShowForm(true)
  }

  const addTarget: 'loan' | 'bill' | 'goal' =
    location.pathname === '/bills' ? 'bill' : location.pathname === '/savings' ? 'goal' : 'loan'

  return (
    <>
      <ScrollToTop />
      <ConfettiContainer />
      <ToastContainer />
      <InstallPrompt />
      <Routes>
```

- [ ] **Step 3: Swap the single form render for three conditional ones**

Find:

```tsx
      <BottomNav onAdd={handleAdd} />
      {showForm && (
        <LoanForm
          onSubmit={(data) => {
            addLoan(data)
            setShowForm(false)
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  )
}
```

Change to:

```tsx
      <BottomNav onAdd={handleAdd} />
      {showForm && addTarget === 'loan' && (
        <LoanForm
          onSubmit={(data) => {
            addLoan(data)
            setShowForm(false)
          }}
          onClose={() => setShowForm(false)}
        />
      )}
      {showForm && addTarget === 'bill' && (
        <BillForm
          onSubmit={(data) => {
            addBill(data)
            setShowForm(false)
          }}
          onClose={() => setShowForm(false)}
        />
      )}
      {showForm && addTarget === 'goal' && (
        <SavingsGoalForm
          onSubmit={(data) => {
            addGoal(data)
            setShowForm(false)
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  )
}
```

(`useLocation` is already imported at the top of the file for `ScrollToTop` — `AppContent` just needs its own call to the same hook, which is safe since both live under `HashRouter`.)

- [ ] **Step 4: Verify it compiles and lints**

Run: `npx tsc -b && npx eslint src/App.tsx`
Expected: no errors.

- [ ] **Step 5: Manual check**

In the running app: on Home, tap **+**, confirm "New Loan" opens (as before). Navigate to `/#/bills`, tap **+**, confirm "New Bill" opens instead; fill it in and submit, confirm the bill appears in the list. Navigate to `/#/savings`, tap **+**, confirm "New Goal" opens; submit one, confirm it appears. Navigate to `/#/more`, `/#/calendar`, `/#/settings` and confirm **+** opens "New Loan" in all of them (only `/bills` and `/savings` are special-cased).

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "Make the add button context-aware for Bills and Savings"
```

---

### Task 19: Combined backup export/import utility

**Files:**
- Create: `src/utils/backup.ts`

**Interfaces:**
- Consumes: `useLoanStore` (existing, specifically `getState()` returning `{ loans, payments, monthlyIncome, importBackup }`, unchanged by this plan); `useBillStore` (Task 3, `getState()` returning `{ bills, billPayments, importBackup }`); `useSavingsStore` (Task 10, `getState()` returning `{ goals, transactions, importBackup }`).
- Produces: `exportAllData(): string`, `importAllData(json: string): boolean`, `parseBackupCounts(json: string): BackupCounts | null`, and the `BackupCounts` type — consumed by `SettingsPage.tsx` (Task 20).

- [ ] **Step 1: Create the file**

```ts
import { useLoanStore } from '../features/loans/loanStore'
import { useBillStore } from '../features/bills/billStore'
import { useSavingsStore } from '../features/savings/savingsStore'

export function exportAllData(): string {
  const { loans, payments, monthlyIncome } = useLoanStore.getState()
  const { bills, billPayments } = useBillStore.getState()
  const { goals, transactions } = useSavingsStore.getState()
  return JSON.stringify({
    loans,
    payments,
    monthlyIncome,
    bills,
    billPayments,
    savingsGoals: goals,
    savingsTransactions: transactions,
    exportedAt: new Date().toISOString(),
  }, null, 2)
}

export type BackupCounts = { loans: number; bills: number; savingsGoals: number }

export function parseBackupCounts(json: string): BackupCounts | null {
  try {
    const data = JSON.parse(json)
    if (!Array.isArray(data.loans)) return null
    return {
      loans: data.loans.length,
      bills: Array.isArray(data.bills) ? data.bills.length : 0,
      savingsGoals: Array.isArray(data.savingsGoals) ? data.savingsGoals.length : 0,
    }
  } catch {
    return null
  }
}

export function importAllData(json: string): boolean {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return false
  }
  if (!data || typeof data !== 'object' || !Array.isArray((data as { loans?: unknown }).loans)) return false

  const loanOk = useLoanStore.getState().importBackup(json)
  useBillStore.getState().importBackup(json)
  useSavingsStore.getState().importBackup(json)
  return loanOk
}
```

(`loans` is treated as the required baseline — it's the one category that has existed since before this feature, so every valid backup, old or new, has it. `bills`/`savingsGoals` are optional: an older loans-only backup simply leaves the bill/savings stores untouched, per the spec's backward-compatibility requirement.)

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/backup.ts
git commit -m "Add combined backup export/import covering loans, bills, and savings"
```

---

### Task 20: Wire Settings page to the combined backup

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

**Interfaces:**
- Consumes: `exportAllData`, `importAllData`, `parseBackupCounts`, `BackupCounts` (Task 19); `useBillStore().bills` (Task 3); `useSavingsStore().goals` (Task 10).

- [ ] **Step 1: Update imports and store destructuring**

Find:

```tsx
import { useLoanStore } from '../features/loans/loanStore'
import { debtToIncomeRatio } from '../features/loans/loanUtils'
import { BRAND_GRADIENT } from '../constants/styles'
import PinSetup from '../features/lock/PinSetup'
import NotificationSettings from '../features/notifications/NotificationSettings'
import { showToast } from '../components/Toast'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import CurrencyAmount from '../components/CurrencyAmount'

type PendingImport = { json: string; incomingCount: number }

export default function SettingsPage() {
  const {
    loans, monthlyIncome, setMonthlyIncome,
    exportCSV, exportBackup, importBackup,
  } = useLoanStore()
```

Change to:

```tsx
import { useLoanStore } from '../features/loans/loanStore'
import { useBillStore } from '../features/bills/billStore'
import { useSavingsStore } from '../features/savings/savingsStore'
import { debtToIncomeRatio } from '../features/loans/loanUtils'
import { BRAND_GRADIENT } from '../constants/styles'
import PinSetup from '../features/lock/PinSetup'
import NotificationSettings from '../features/notifications/NotificationSettings'
import { showToast } from '../components/Toast'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import CurrencyAmount from '../components/CurrencyAmount'
import { exportAllData, importAllData, parseBackupCounts } from '../utils/backup'
import type { BackupCounts } from '../utils/backup'

type PendingImport = { json: string; counts: BackupCounts }

export default function SettingsPage() {
  const { loans, monthlyIncome, setMonthlyIncome, exportCSV } = useLoanStore()
  const { bills } = useBillStore()
  const { goals } = useSavingsStore()
```

- [ ] **Step 2: Update the export/import handlers**

Find:

```tsx
  async function handleExportBackup() {
    const json = exportBackup()
    const filename = `lendy-backup-${dateSuffix()}.json`
```

Change to:

```tsx
  async function handleExportBackup() {
    const json = exportAllData()
    const filename = `lendy-backup-${dateSuffix()}.json`
```

Find:

```tsx
  function handleImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const json = reader.result as string
      try {
        const data = JSON.parse(json)
        if (!Array.isArray(data.loans)) {
          showToast('Invalid backup file')
          return
        }
        setPendingImport({ json, incomingCount: data.loans.length })
      } catch {
        showToast('Invalid backup file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function confirmImport() {
    if (!pendingImport) return
    const ok = importBackup(pendingImport.json)
    if (!ok) showToast('Failed to restore backup')
    setPendingImport(null)
  }
```

Change to:

```tsx
  function handleImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const json = reader.result as string
      const counts = parseBackupCounts(json)
      if (!counts) {
        showToast('Invalid backup file')
        return
      }
      setPendingImport({ json, counts })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function confirmImport() {
    if (!pendingImport) return
    const ok = importAllData(pendingImport.json)
    if (!ok) showToast('Failed to restore backup')
    setPendingImport(null)
  }
```

- [ ] **Step 3: Generalize the confirmation dialog copy**

Find:

```tsx
            <p className="text-[13px] text-secondary mb-6">
              {loans.length > 0
                ? `This will replace your ${loans.length} existing ${loans.length === 1 ? 'loan' : 'loans'} with ${pendingImport.incomingCount} from the backup. This cannot be undone.`
                : `Import ${pendingImport.incomingCount} ${pendingImport.incomingCount === 1 ? 'loan' : 'loans'} from the backup?`}
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setPendingImport(null)}
                className="flex-1 py-3 rounded-xl bg-subtle text-secondary font-semibold text-[14px] hover:opacity-80 transition-opacity"
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                className="flex-1 py-3 rounded-xl font-semibold text-[14px] text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: loans.length > 0 ? '#EF4444' : '#6366F1' }}
              >
                {loans.length > 0 ? 'Replace' : 'Restore'}
              </button>
            </div>
```

Change to:

```tsx
            <p className="text-[13px] text-secondary mb-6">
              {describeBackupImport(pendingImport.counts, { loans: loans.length, bills: bills.length, goals: goals.length })}
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setPendingImport(null)}
                className="flex-1 py-3 rounded-xl bg-subtle text-secondary font-semibold text-[14px] hover:opacity-80 transition-opacity"
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                className="flex-1 py-3 rounded-xl font-semibold text-[14px] text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: hasExistingData(loans.length, bills.length, goals.length) ? '#EF4444' : '#6366F1' }}
              >
                {hasExistingData(loans.length, bills.length, goals.length) ? 'Replace' : 'Restore'}
              </button>
            </div>
```

- [ ] **Step 4: Add the copy-building helpers**

Find the bottom-of-file helpers:

```ts
function downloadFile(content: string, filename: string, type: string) {
```

Insert two new functions immediately above it:

```ts
function hasExistingData(loanCount: number, billCount: number, goalCount: number): boolean {
  return loanCount > 0 || billCount > 0 || goalCount > 0
}

function describeCount(n: number, singular: string): string {
  return `${n} ${n === 1 ? singular : `${singular}s`}`
}

function describeBackupImport(
  incoming: BackupCounts,
  existing: { loans: number; bills: number; goals: number },
): string {
  const parts: string[] = []
  if (incoming.loans > 0) parts.push(describeCount(incoming.loans, 'loan'))
  if (incoming.bills > 0) parts.push(describeCount(incoming.bills, 'bill'))
  if (incoming.savingsGoals > 0) parts.push(describeCount(incoming.savingsGoals, 'savings goal'))
  const incomingText = parts.length > 0 ? parts.join(', ') : 'no data'

  return hasExistingData(existing.loans, existing.bills, existing.goals)
    ? `This will replace your existing data with ${incomingText} from the backup. This cannot be undone.`
    : `Import ${incomingText} from the backup?`
}

function downloadFile(content: string, filename: string, type: string) {
```

- [ ] **Step 5: Verify it compiles and lints**

Run: `npx tsc -b && npx eslint src/pages/SettingsPage.tsx`
Expected: no errors.

- [ ] **Step 6: Manual check**

In the running app with at least one loan, one bill, and one savings goal present: go to Settings → Data → tap "Backup". Confirm a `lendy-backup-<date>.json` file downloads (or the native share sheet appears) and, when opened, contains top-level `loans`, `payments`, `monthlyIncome`, `bills`, `billPayments`, `savingsGoals`, `savingsTransactions`, and `exportedAt` keys with your data in them. Tap "Restore", pick that same file, confirm the dialog now reads something like "This will replace your existing data with N loans, N bills, N savings goals from the backup." — confirm, and confirm all three categories are still present afterward (nothing got wiped). Then take an *old* backup file that only has a `loans` array (or hand-edit one to drop `bills`/`savingsGoals`) and restore it — confirm it still imports successfully without touching current bills/goals state incorrectly (bills/goals stores are simply left as whatever they were before the restore, since the old file has nothing to restore them from).

- [ ] **Step 7: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "Wire Settings backup to combined loans+bills+savings export/import"
```

---

### Task 21: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck and lint pass**

Run: `npx tsc -b && npx eslint .`
Expected: no errors across the whole project.

- [ ] **Step 2: Full manual walkthrough**

In the running app (`npm run dev`), starting from a clean/representative data set:

1. **Bills:** From Home, tap **+** (confirm it's "New Loan"). Navigate via bottom nav: Home → More → Bills. Tap **+** on the Bills page, confirm "New Bill" opens; add a bill due in a few days. Confirm it appears sorted by soonest due date, with the correct category tag and color. Open it, mark it paid, confirm the due date advances exactly one month and the payment appears in history. Edit its due day; confirm the next due date recomputes. Archive it, confirm it disappears from the default list and reappears under "Archived". Delete it (unarchive first if needed, delete works either way) and confirm it's gone.
2. **Savings:** More → Savings. Add a goal with a target. Add funds twice, confirm the balance and progress bar update correctly and additively. Withdraw an amount larger than the balance and confirm it's rejected. Withdraw a valid amount and confirm the balance drops and a withdrawal row appears. Add enough funds to cross the target and confirm the confetti/toast celebration fires exactly once (adding more funds afterward should not re-trigger it). Edit the goal's name, confirm it updates everywhere (card, header, page title).
3. **Navigation:** Confirm the bottom nav shows Home, Calendar, +, More, Settings (no separate Analytics tab). Confirm "More" stays highlighted while browsing Analytics, Bills, or Savings, and un-highlights when you're on Home/Calendar/Settings. Confirm the nav hides entirely on `/loan/:id`, `/bills/:id`, and `/savings/:id`, and reappears when you navigate back.
4. **Backup:** With loans, bills, and savings goals all present, export a backup from Settings and restore it — confirm nothing is lost. If you have (or can construct) an old loans-only backup from before this feature, restore that too and confirm it doesn't error and doesn't wipe existing bills/savings.
5. **Regression on existing features:** Confirm Home, Calendar, Analytics, and the loan add/edit/pay/archive/delete flows still work exactly as before — this feature should be purely additive.

- [ ] **Step 3: Final commit (only if any fixes were needed during this walkthrough)**

```bash
git add -A
git commit -m "Fix issues found in bills/savings end-to-end verification"
```
