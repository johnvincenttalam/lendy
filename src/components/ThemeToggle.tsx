import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

export default function ThemeToggle() {
  const { dark, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      className="relative w-[52px] h-[30px] rounded-full transition-colors duration-300 active:scale-95 bg-white/[0.15] border border-white/[0.1]"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div
        className="absolute top-[3px] w-[24px] h-[24px] rounded-full bg-white flex items-center justify-center transition-all duration-300"
        style={{ left: dark ? '25px' : '3px' }}
      >
        {dark ? (
          <Sun className="w-3.5 h-3.5 text-brand" />
        ) : (
          <Moon className="w-3.5 h-3.5 text-brand" />
        )}
      </div>
    </button>
  )
}
