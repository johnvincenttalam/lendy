import { useLocation, useNavigate } from 'react-router-dom'
import { Home, CalendarDays, MoreHorizontal, BarChart3, Plus } from 'lucide-react'

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { path: '__add__', icon: Plus, label: 'Add' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/more', icon: MoreHorizontal, label: 'More' },
] as const

// Sub-pages that should keep their parent tab lit even though the path
// isn't the tab's own. Home is absent on purpose: '/' prefixes everything.
// Analytics has its own tab now, so it is no longer one of More's children.
const TAB_PREFIXES: Record<string, string[]> = {
  '/more': ['/more', '/planner', '/bills', '/savings', '/settings', '/whats-new'],
}

export default function BottomNav({ onAdd }: { onAdd: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()

  // Hide on detail pages
  const hiddenPaths = ['/loan/', '/bills/', '/savings/']
  if (hiddenPaths.some((p) => location.pathname.startsWith(p))) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
      <div className="bg-header backdrop-blur-header transition-colors pointer-events-auto">
      <div className="max-w-2xl mx-auto grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map((item) => {
          if (item.path === '__add__') {
            return (
              <div key="add" className="flex justify-center -mt-4 pointer-events-auto">
                <button
                  onClick={onAdd}
                  aria-label="Add"
                  className="w-14 h-14 rounded-full bg-brand flex items-center justify-center hover:bg-brand-light"
                >
                  <Plus className="w-7 h-7 text-on-brand" strokeWidth={3} />
                </button>
              </div>
            )
          }

          const prefixes = TAB_PREFIXES[item.path]
          const isActive = prefixes
            ? prefixes.some((p) => location.pathname.startsWith(p))
            : location.pathname === item.path
          const Icon = item.icon

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 pt-2 pb-2 transition-colors ${
                isActive ? 'text-primary' : 'text-muted hover:text-secondary'
              }`}
            >
              {/* Active tab sits on a small teal "scarf" pill */}
              <span className={`px-3.5 py-1 rounded-full transition-colors ${isActive ? 'bg-[var(--tint-teal)]' : ''}`}>
                <Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.5 : 1.8} />
              </span>
              <span className={`text-[11px] ${isActive ? 'font-extrabold' : 'font-semibold'}`}>
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
