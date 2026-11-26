import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { DeadlineCollector } from '../deadlines/deadlines'

/** A page listed in More and the desktop sidebar. */
export type NavEntry = { path: string; label: string; description: string; icon: LucideIcon; group: 'main' | 'money' }

/** Something the [+] button can add. `Form` saves and then calls onClose. */
export type QuickAddAction = {
  id: string
  label: string
  icon: LucideIcon
  Form: ComponentType<{ onClose: () => void; privateLoan?: boolean }>
}

/** A section of Home. Returns null when it has nothing to show. */
export type WidgetDef = { id: string; title: string; defaultPosition: number; Component: ComponentType }

/** Everything a feature contributes to the app's frame, declared once. */
export type ModuleDef = {
  id: string
  nav?: NavEntry[]
  quickAdd?: QuickAddAction[]
  /** On this page, [+] opens this action directly instead of the menu. */
  contextAdd?: { path: string; actionId: string; privateLoan?: boolean }[]
  widgets?: WidgetDef[]
  deadlines?: DeadlineCollector
}
