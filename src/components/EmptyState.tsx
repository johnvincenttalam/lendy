import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { OllieMood } from '../features/ollie/ollieTypes'
import { OLLIE_ALT, OLLIE_IMAGES } from '../features/ollie/ollieStates'

type Props = {
  icon: LucideIcon
  title: string
  subtitle?: string
  children?: ReactNode
  className?: string
  /** Show Ollie in this expression instead of the icon tile. */
  mood?: OllieMood
}

export default function EmptyState({ icon: Icon, title, subtitle, children, className = '', mood }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center py-14 px-4 text-center ${className}`}>
      {mood ? (
        <img
          src={OLLIE_IMAGES[mood]}
          alt={OLLIE_ALT[mood]}
          width={384}
          height={384}
          decoding="async"
          draggable={false}
          className="w-28 h-auto mb-3 select-none animate-fade-in"
        />
      ) : (
        <div className="w-16 h-16 rounded-[20px] bg-card border border-themed flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-muted" />
        </div>
      )}
      <h2 className="text-[17px] font-bold text-primary mb-1 tracking-tight">{title}</h2>
      {subtitle && (
        <p className="text-[13px] text-muted max-w-[260px] leading-relaxed">{subtitle}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
