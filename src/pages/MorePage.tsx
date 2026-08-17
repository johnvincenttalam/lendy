import { useNavigate } from 'react-router-dom'
import { BarChart3, Receipt, PiggyBank, ChevronRight } from 'lucide-react'
import { BRAND_GRADIENT } from '../constants/styles'

const MORE_ITEMS = [
  { path: '/analytics', icon: BarChart3, label: 'Analytics', description: 'Insights on your loans' },
  { path: '/bills', icon: Receipt, label: 'Bills', description: 'Track your monthly bills' },
  { path: '/savings', icon: PiggyBank, label: 'Savings', description: 'Track your savings goals' },
] as const

export default function MorePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <div style={{ background: BRAND_GRADIENT }}>
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-5">
          <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight">More</h1>
          <p className="text-[12px] text-white/55 font-medium">Explore your finances</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-2.5">
        {MORE_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 bg-card rounded-2xl border border-themed p-4 text-left transition-all duration-200 active:scale-[0.98] hover:bg-card-hover"
            >
              <div className="w-9 h-9 rounded-[11px] bg-brand/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-primary text-[14px] tracking-tight">{item.label}</p>
                <p className="text-[12px] text-muted">{item.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
