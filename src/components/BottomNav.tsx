import { useLocation, useNavigate } from 'react-router-dom'
import { Home, CalendarDays, BarChart3, Settings, Plus } from 'lucide-react'

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { path: '__add__', icon: Plus, label: 'Add' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/settings', icon: Settings, label: 'Settings' },
] as const

export default function BottomNav({ onAdd }: { onAdd: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()

  // Hide on detail pages
  const hiddenPaths = ['/loan/']
  if (hiddenPaths.some((p) => location.pathname.startsWith(p))) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
      <div className="bg-header backdrop-blur-header border-t border-themed transition-colors pointer-events-auto">
      <div className="max-w-2xl mx-auto grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map((item) => {
          if (item.path === '__add__') {
            return (
              <div key="add" className="flex justify-center -mt-4 pointer-events-auto">
                <button
                  onClick={onAdd}
                  aria-label="Add loan"
                  className="w-14 h-14 rounded-full bg-brand flex items-center justify-center hover:bg-brand-light active:scale-90 transition-all duration-200 border-4"
                  style={{ borderColor: 'var(--color-card)' }}
                >
                  <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
                </button>
              </div>
            )
          }

          const isActive = location.pathname === item.path
          const Icon = item.icon

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                isActive ? 'text-brand' : 'text-muted hover:text-secondary'
              }`}
            >
              <Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.2 : 1.5} />
              <span className={`text-[10px] tracking-wide ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
      </div>
    </div>
  )
}
