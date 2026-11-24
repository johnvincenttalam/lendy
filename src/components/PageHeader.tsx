import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

type Props = {
  title: string
  subtitle?: ReactNode
  /** Show a back button that returns to the previous page. */
  back?: boolean
  /** Right-aligned control next to the title (e.g. a settings button). */
  action?: ReactNode
  /** Summary content shown under the title — stat cards, navigators. */
  children?: ReactNode
}

/**
 * Top of every main page: a big rounded title written straight on the
 * paper — no coloured band — so Ollie's teal icon and the content below
 * carry the colour.
 */
export default function PageHeader({ title, subtitle, back = false, action, children }: Props) {
  const navigate = useNavigate()

  return (
    <header className="max-w-2xl mx-auto px-4 pt-7 pb-1">
      <div className="flex items-center gap-3">
        {back && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-10 h-10 rounded-full bg-card border border-themed flex items-center justify-center shrink-0"
          >
            <ArrowLeft className="w-[18px] h-[18px] text-primary" strokeWidth={2.5} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-[30px] font-extrabold text-primary tracking-tight leading-none">{title}</h1>
          {subtitle && <p className="text-[14px] font-semibold text-muted mt-1.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children && <div className="mt-5 space-y-3">{children}</div>}
    </header>
  )
}

/** Rounded icon button for PageHeader's `action` slot. */
export function HeaderIconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-10 h-10 rounded-xl bg-card border border-themed flex items-center justify-center shrink-0"
    >
      {children}
    </button>
  )
}
