import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/** Flat colour-block stat: a soft tint carries the category, no outline. */
export default function StatTile({ icon: Icon, label, children, tint, wide = false }: { icon: LucideIcon; label: string; children: ReactNode; tint: string; wide?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${wide ? 'col-span-2' : ''}`} style={{ backgroundColor: tint }}>
      <div className="flex items-center gap-1.5 mb-2.5">
        <Icon className="w-4 h-4 text-secondary" strokeWidth={2.25} />
        <span className="text-[13px] font-bold text-secondary">{label}</span>
      </div>
      <p className="text-[20px] font-extrabold font-display tabular-nums text-primary tracking-tight leading-tight">{children}</p>
    </div>
  )
}
