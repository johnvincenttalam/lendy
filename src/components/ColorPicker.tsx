import { Check } from 'lucide-react'
import { LOAN_COLORS } from '../features/loans/loanTypes'

type Props = {
  value: string
  onChange: (color: string) => void
}

export default function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {LOAN_COLORS.map((color) => {
        const selected = value === color
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={`Select color ${color}`}
            aria-pressed={selected}
            className="relative aspect-square rounded-2xl flex items-center justify-center transition-transform duration-150 active:scale-90"
            style={{
              backgroundColor: color,
              boxShadow: selected
                ? `0 0 0 2px var(--color-card), 0 0 0 4px ${color}`
                : 'none',
            }}
          >
            {selected && <Check className="w-5 h-5 text-white" strokeWidth={3} />}
          </button>
        )
      })}
    </div>
  )
}
