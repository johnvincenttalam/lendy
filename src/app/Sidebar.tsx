import { useLocation, useNavigate } from 'react-router-dom'
import { Home, CalendarDays, MessageCircle, FolderLock, Settings, Plus, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { navEntries } from '../core/modules/registry'
import { useSettingsStore } from '../core/settings/settingsStore'
import { usePrivateFolderStore } from '../features/privateFolder/privateFolderStore'
import { folderLabel } from '../features/privateFolder/privateFolderUtils'
import NotificationBell from './NotificationBell'
import { MODULES } from './modules'

type Item = { path: string; label: string; icon: LucideIcon }

const MAIN: Item[] = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/planner', label: 'Planner', icon: CalendarDays },
  { path: '/ollie', label: 'Ollie', icon: MessageCircle },
]

function isActive(path: string, pathname: string): boolean {
  if (path === '/') return pathname === '/' || pathname.startsWith('/loan/')
  return pathname === path || pathname.startsWith(`${path}/`)
}

/** Desktop navigation (lg and up): collapsible to icons, remembered on this device. */
export default function Sidebar({ onAdd }: { onAdd: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const collapsed = useSettingsStore((s) => s.sidebarCollapsed)
  const setCollapsed = useSettingsStore((s) => s.setSidebarCollapsed)
  const folderName = usePrivateFolderStore((s) => s.name)

  const money: Item[] = navEntries(MODULES, 'money')
  const footer: Item[] = [
    { path: '/private', label: folderLabel(folderName), icon: FolderLock },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]

  const link = (item: Item) => {
    const active = isActive(item.path, pathname)
    const Icon = item.icon
    return (
      <li key={item.path}>
        <button
          type="button"
          onClick={() => navigate(item.path)}
          aria-current={active ? 'page' : undefined}
          aria-label={collapsed ? item.label : undefined}
          title={collapsed ? item.label : undefined}
          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors focus-visible:ring-2 focus-visible:ring-brand ${
            active ? 'bg-[var(--tint-teal)] text-primary font-extrabold' : 'text-secondary font-semibold hover:bg-subtle hover:text-primary'
          } ${collapsed ? 'justify-center' : ''}`}
        >
          <Icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </button>
      </li>
    )
  }

  return (
    <aside
      className={`hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col bg-header backdrop-blur-header border-r border-themed transition-[width] ${collapsed ? 'w-[72px]' : 'w-60'}`}
    >
      <div className={`flex items-center gap-2.5 px-4 pt-5 pb-4 ${collapsed ? 'flex-col' : ''}`}>
        <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="w-9 h-9 rounded-xl" />
        {!collapsed && <p className="flex-1 text-[20px] font-extrabold text-primary tracking-tight">Ollie</p>}
        <NotificationBell />
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add"
          className={`w-full flex items-center justify-center gap-2 rounded-xl bg-brand text-on-brand font-bold text-[14px] py-2.5 hover:bg-brand-light focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 transition-colors`}
        >
          <Plus className="w-5 h-5" strokeWidth={3} />
          {!collapsed && 'Add'}
        </button>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pt-4 space-y-5">
        <ul className="space-y-1">{MAIN.map(link)}</ul>
        <div>
          {!collapsed && <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Money</p>}
          <ul className="space-y-1">{money.map(link)}</ul>
        </div>
        <ul className="space-y-1 border-t border-divider pt-4">{footer.map(link)}</ul>
      </nav>

      <div className="p-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold text-muted hover:text-primary hover:bg-subtle transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  )
}
