import { Sun, Moon, MonitorSmartphone } from 'lucide-react'
import { useThemeStore, type ThemePreference } from './themeStore'

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: MonitorSmartphone },
]

export default function ThemeSettings() {
  const preference = useThemeStore((s) => s.preference)
  const resolved = useThemeStore((s) => s.resolved)
  const setPreference = useThemeStore((s) => s.setPreference)

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[14px] font-semibold text-primary tracking-tight" id="theme-label">Appearance</p>
        {preference === 'system' && (
          <p className="text-[11px] text-muted">Following your device ({resolved === 'dark' ? 'dark' : 'light'})</p>
        )}
      </div>
      <div role="radiogroup" aria-labelledby="theme-label" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-subtle">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = preference === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPreference(value)}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                active ? 'bg-card text-primary shadow-sm' : 'text-muted hover:text-secondary'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-brand' : ''}`} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
