import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import Sheet from './Sheet'
import { useMoneyStore } from './moneyStore'
import { ICON_KEYS, getCategoryIcon } from './moneyIcons'
import { allCategories, localISODate, otherCategoryId, validateCategoryName } from './moneyUtils'
import type { MoneyEntry, MoneyEntryFormData, MoneyEntryType } from './moneyTypes'

type Props = {
  onSubmit: (data: MoneyEntryFormData) => void
  onClose: () => void
  onDelete?: () => void
  initial?: MoneyEntry
}

export default function MoneyEntryForm({ onSubmit, onClose, onDelete, initial }: Props) {
  const isEdit = !!initial
  const { customCategories, addCategory } = useMoneyStore()
  const categories = useMemo(() => allCategories(customCategories), [customCategories])

  const [type, setType] = useState<MoneyEntryType>(initial?.type ?? 'expense')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? otherCategoryId('expense'))
  const [date, setDate] = useState(initial?.date ?? localISODate())
  const [note, setNote] = useState(initial?.note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState(ICON_KEYS[0])

  const typeCategories = categories.filter((c) => c.type === type)

  function switchType(next: MoneyEntryType) {
    if (next === type) return
    setType(next)
    // A category belongs to one type, so the old pick is meaningless now.
    setCategoryId(otherCategoryId(next))
    setCreating(false)
  }

  function clearError(field: string) {
    setErrors((prev) => {
      if (!(field in prev)) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function handleCreateCategory() {
    const problem = validateCategoryName(newName, type, categories)
    if (problem) {
      setErrors((prev) => ({ ...prev, newCategory: problem }))
      return
    }
    const id = addCategory(type, newName, newIcon)
    if (id) {
      setCategoryId(id)
      setCreating(false)
      setNewName('')
      clearError('newCategory')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!amount || !(Number(amount) > 0)) next.amount = 'Enter a valid amount'
    if (!date) next.date = 'Pick a date'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit({
      type,
      amount: Math.round(Number(amount) * 100) / 100,
      categoryId,
      date,
      note: note.trim() || undefined,
    })
  }

  const accent = type === 'income' ? '#3ECF8E' : '#EF4444'

  return (
    <Sheet
      title={isEdit ? 'Edit Entry' : 'New Entry'}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <button
            type="submit"
            form="money-entry-form"
            className="w-full text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all duration-200 text-[15px] tracking-tight hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            {isEdit ? 'Save Changes' : type === 'income' ? 'Add Income' : 'Add Expense'}
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="w-full py-3 rounded-2xl bg-subtle text-red-500 font-semibold text-[14px] hover:opacity-80 transition-opacity"
            >
              Delete Entry
            </button>
          )}
        </div>
      }
    >
      <form id="money-entry-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-1.5 bg-subtle rounded-full p-1" role="group" aria-label="Entry type">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchType(t)}
              aria-pressed={type === t}
              className={`text-[13px] font-semibold py-2 rounded-full transition-all ${
                type === t ? 'bg-card text-primary shadow-sm' : 'text-secondary hover:opacity-80'
              }`}
            >
              {t === 'expense' ? 'Expense' : 'Income'}
            </button>
          ))}
        </div>

        <Field label="Amount (₱)" id="money-amount" error={errors.amount}>
          <input
            id="money-amount"
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); clearError('amount') }}
            aria-invalid={!!errors.amount}
            className="input-field"
          />
        </Field>

        <Field label="Category">
          <div className="flex flex-wrap gap-1.5">
            {typeCategories.map((c) => {
              const Icon = getCategoryIcon(c.icon)
              const active = categoryId === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  aria-pressed={active}
                  className={`text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all inline-flex items-center gap-1.5 ${
                    active ? 'text-white' : 'bg-subtle text-secondary hover:opacity-80'
                  }`}
                  style={active ? { backgroundColor: accent } : undefined}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {c.name}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              aria-expanded={creating}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-subtle text-secondary hover:opacity-80 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          </div>

          {creating && (
            <div className="mt-3 rounded-2xl border border-themed p-3 space-y-3">
              <div className={errors.newCategory ? 'rounded-[14px] ring-2 ring-red-500/50' : undefined}>
                <input
                  type="text"
                  value={newName}
                  maxLength={24}
                  onChange={(e) => { setNewName(e.target.value); clearError('newCategory') }}
                  placeholder="Category name"
                  aria-label="New category name"
                  className="input-field"
                />
              </div>
              {errors.newCategory && <p className="text-[11px] text-red-500 dark:text-red-400 font-medium">{errors.newCategory}</p>}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category icon">
                {ICON_KEYS.map((key) => {
                  const Icon = getCategoryIcon(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewIcon(key)}
                      aria-pressed={newIcon === key}
                      aria-label={key}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                        newIcon === key ? 'bg-brand text-on-brand' : 'bg-subtle text-secondary hover:opacity-80'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={handleCreateCategory}
                className="w-full py-2.5 rounded-xl bg-brand text-on-brand font-semibold text-[13px] hover:opacity-90"
              >
                Add category
              </button>
            </div>
          )}
        </Field>

        <Field label="Date" id="money-date" error={errors.date}>
          <input
            id="money-date"
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value); clearError('date') }}
            className="input-field"
          />
        </Field>

        <Field label="Note" id="money-note">
          <input
            id="money-note"
            type="text"
            value={note}
            maxLength={120}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
            className="input-field"
          />
        </Field>
      </form>
    </Sheet>
  )
}

function Field({ label, id, error, children }: { label: string; id?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1.5">{label}</label>
      <div className={error ? 'rounded-[14px] ring-2 ring-red-500/50' : undefined}>{children}</div>
      {error && <p className="text-[11px] text-red-500 dark:text-red-400 mt-1 font-medium">{error}</p>}
    </div>
  )
}
