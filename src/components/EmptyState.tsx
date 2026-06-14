import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  icon: LucideIcon
  title: string
  subtitle?: string
  children?: ReactNode
  className?: string
}

export default function EmptyState({ icon: Icon, title, subtitle, children, className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      <div className="w-16 h-16 rounded-[20px] bg-card border border-themed flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-muted" />
      </div>
      <p className="text-[16px] font-bold text-primary mb-1 tracking-tight">{title}</p>
      {subtitle && (
        <p className="text-[13px] text-muted max-w-[240px] leading-relaxed">{subtitle}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
