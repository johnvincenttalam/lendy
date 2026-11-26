import type { HomeLayout } from '../settings/settings'
import type { DeadlineCollector } from '../deadlines/deadlines'
import type { ModuleDef, NavEntry, QuickAddAction, WidgetDef } from './types'

export function allWidgets(defs: ModuleDef[]): WidgetDef[] {
  return defs.flatMap((d) => d.widgets ?? []).sort((a, b) => a.defaultPosition - b.defaultPosition)
}

/**
 * Home's widgets in the owner's saved order. Saved ids that no longer exist
 * are dropped; a widget the saved order doesn't mention (say, one added in an
 * update) goes right after the last widget that comes before it by default.
 */
export function resolveHomeWidgets(defs: ModuleDef[], layout: HomeLayout): { widget: WidgetDef; hidden: boolean }[] {
  const all = allWidgets(defs)
  const byId = new Map(all.map((w) => [w.id, w]))
  const list: WidgetDef[] = []
  for (const id of layout.order) {
    const w = byId.get(id)
    if (w && !list.includes(w)) list.push(w)
  }
  for (const w of all) {
    if (list.includes(w)) continue
    let at = 0
    list.forEach((other, i) => { if (other.defaultPosition < w.defaultPosition) at = i + 1 })
    list.splice(at, 0, w)
  }
  const hidden = new Set(layout.hidden)
  return list.map((widget) => ({ widget, hidden: hidden.has(widget.id) }))
}

/** Moves one widget up (-1) or down (+1), saving the full order. */
export function moveWidget(layout: HomeLayout, all: WidgetDef[], id: string, dir: -1 | 1): HomeLayout {
  const order = resolveHomeWidgets([{ id: '_', widgets: all }], layout).map((r) => r.widget.id)
  const i = order.indexOf(id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= order.length) return { ...layout, order }
  ;[order[i], order[j]] = [order[j], order[i]]
  return { ...layout, order }
}

export function toggleWidget(layout: HomeLayout, id: string): HomeLayout {
  const hidden = layout.hidden.includes(id) ? layout.hidden.filter((h) => h !== id) : [...layout.hidden, id]
  return { ...layout, hidden }
}

export function quickAddActions(defs: ModuleDef[]): QuickAddAction[] {
  return defs.flatMap((d) => d.quickAdd ?? [])
}

/** On a module's own page [+] opens its form directly; everywhere else, the menu. */
export function quickAddTarget(pathname: string, defs: ModuleDef[]): { action: QuickAddAction; privateLoan: boolean } | 'menu' {
  for (const d of defs) {
    const ctx = d.contextAdd?.find((c) => c.path === pathname)
    if (!ctx) continue
    const action = quickAddActions(defs).find((a) => a.id === ctx.actionId)
    if (action) return { action, privateLoan: ctx.privateLoan === true }
  }
  return 'menu'
}

export function navEntries(defs: ModuleDef[], group: NavEntry['group']): NavEntry[] {
  return defs.flatMap((d) => d.nav ?? []).filter((n) => n.group === group)
}

export function deadlineCollectors(defs: ModuleDef[]): DeadlineCollector[] {
  return defs.flatMap((d) => (d.deadlines ? [d.deadlines] : []))
}
