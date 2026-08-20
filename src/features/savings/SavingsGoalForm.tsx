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
        className="bg-card w-full h-full sm:h-auto sm:max-w-lg sm:rounded-2xl rounded-none sm:max-h-[92vh] flex flex-col overflow-hidden border-0 sm:border border-themed animate-slide-up"
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          className="shrink-0 flex justify-center pt-3 pb-1 sm:hidden cursor-grab active:cursor-grabbing"
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

        <div className="shrink-0 flex items-center justify-between px-5 pt-3 pb-4 sm:pt-5 border-b border-divider sm:border-b-0">
          <h2 className="text-[20px] font-bold text-primary tracking-tight">{isEdit ? 'Edit Goal' : 'New Goal'}</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center hover:opacity-60 transition-opacity">
            <X className="w-[18px] h-[18px] text-secondary" />
          </button>
        </div>

        {/* min-h-0 at both nesting levels: without it a flex child refuses to
            shrink below its content and the body pushes the footer off-screen
            instead of scrolling. */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto custom-scroll px-5 pt-1 pb-5 space-y-4">
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

          </div>

          <div className="shrink-0 border-t border-divider px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button
              type="submit"
              className="w-full text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all duration-200 text-[15px] tracking-tight hover:opacity-90"
              style={{ backgroundColor: color }}
            >
              {isEdit ? 'Save Changes' : 'Add Goal'}
            </button>
          </div>
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
