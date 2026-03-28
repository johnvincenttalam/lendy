import { Check } from 'lucide-react'
import { LOAN_COLORS } from '../features/loans/loanTypes'

type Props = {
  value: string
  onChange: (color: string) => void
}

export default function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {LOAN_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-90"
          style={{
            backgroundColor: color,
            outline: value === color ? `2px solid ${color}` : 'none',
            outlineOffset: '2px',
          }}
        >
          {value === color && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
        </button>
      ))}
    </div>
  )
}
