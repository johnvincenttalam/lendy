import { describe, it, expect } from 'vitest'
import { Receipt } from 'lucide-react'
import { resolveHomeWidgets, moveWidget, toggleWidget, quickAddTarget, quickAddActions, navEntries, allWidgets } from './registry'
import type { ModuleDef, QuickAddAction, WidgetDef } from './types'

const Stub = () => null
const w = (id: string, defaultPosition: number): WidgetDef => ({ id, title: id.toUpperCase(), defaultPosition, Component: Stub })
const action = (id: string, label: string): QuickAddAction => ({ id, label, icon: Receipt, Form: Stub })

const defs: ModuleDef[] = [
  { id: 'loans', widgets: [w('c', 3), w('a', 1)], quickAdd: [action('loan', 'Loan')], contextAdd: [{ path: '/private', actionId: 'loan', privateLoan: true }] },
  {
    id: 'bills', widgets: [w('b', 2)], quickAdd: [action('bill', 'Bill')], contextAdd: [{ path: '/bills', actionId: 'bill' }],
    nav: [{ path: '/bills', label: 'Bills', description: '', icon: Receipt, group: 'money' }],
  },
]
const ids = (layout: { order: string[]; hidden: string[] }) => resolveHomeWidgets(defs, layout).map((r) => r.widget.id)
const none = { order: [], hidden: [] }

describe('resolveHomeWidgets', () => {
  it('uses the default order when nothing is saved', () => {
    expect(ids(none)).toEqual(['a', 'b', 'c'])
    expect(resolveHomeWidgets(defs, none).every((r) => !r.hidden)).toBe(true)
  })

  it('places a widget missing from the saved order after the last one that comes before it by default', () => {
    expect(ids({ order: ['c', 'a'], hidden: [] })).toEqual(['c', 'a', 'b'])
    expect(ids({ order: ['b'], hidden: [] })).toEqual(['a', 'b', 'c'])
  })

  it('drops ids that no longer exist and marks hidden ones', () => {
    const rows = resolveHomeWidgets(defs, { order: ['zzz', 'b'], hidden: ['zzz', 'c'] })
    expect(rows.map((r) => [r.widget.id, r.hidden])).toEqual([['a', false], ['b', false], ['c', true]])
  })
})

describe('moveWidget and toggleWidget', () => {
  const all = allWidgets(defs)
  it('moves a widget up', () => {
    expect(moveWidget(none, all, 'b', -1).order).toEqual(['b', 'a', 'c'])
  })
  it('does nothing when the first widget moves up', () => {
    expect(moveWidget(none, all, 'a', -1).order).toEqual(['a', 'b', 'c'])
  })
  it('hides and shows a widget', () => {
    const hidden = toggleWidget(none, 'b')
    expect(hidden.hidden).toEqual(['b'])
    expect(toggleWidget(hidden, 'b').hidden).toEqual([])
  })
})

describe('quick add', () => {
  it('opens the page’s own form on its page', () => {
    expect(quickAddTarget('/bills', defs)).toEqual({ action: defs[1].quickAdd![0], privateLoan: false })
  })
  it('saves loans added in the private folder as private', () => {
    expect(quickAddTarget('/private', defs)).toEqual({ action: defs[0].quickAdd![0], privateLoan: true })
  })
  it('saves loans added from a private loan’s page as private too', () => {
    expect(quickAddTarget('/loan/secret', defs, { privateContext: true })).toEqual({ action: defs[0].quickAdd![0], privateLoan: true })
  })
  it('shows the menu everywhere else', () => {
    for (const path of ['/', '/planner', '/loan/x', '/bills/x']) expect(quickAddTarget(path, defs)).toBe('menu')
  })
  it('lists actions in module order', () => {
    expect(quickAddActions(defs).map((a) => a.label)).toEqual(['Loan', 'Bill'])
  })
})

describe('navEntries', () => {
  it('lists a group’s entries in module order', () => {
    expect(navEntries(defs, 'money').map((n) => n.label)).toEqual(['Bills'])
    expect(navEntries(defs, 'main')).toEqual([])
  })
})
