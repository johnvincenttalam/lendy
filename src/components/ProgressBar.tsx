type Size = 'sm' | 'md'

type Props = {
  /** Percent complete, 0–100. */
  value: number
  /** Accessible name, e.g. "Paid off". */
  label: string
  /** Fill colour (any CSS colour). Defaults to brand teal. */
  color?: string
  size?: Size
  className?: string
}

const HEIGHT: Record<Size, string> = { sm: 'h-2', md: 'h-3' }

/**
 * Flat progress bar: a soft track tinted with the bar's own colour and a
 * rounded fill. One component so every bar in the app looks the same.
 */
export default function ProgressBar({ value, label, color = 'var(--color-brand)', size = 'sm', className = '' }: Props) {
  const pct = Math.round(Math.min(100, Math.max(0, value)))

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={`w-full rounded-full overflow-hidden ${HEIGHT[size]} ${className}`}
      style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)` }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}
