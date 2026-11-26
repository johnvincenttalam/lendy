import type { Deadline } from '../../core/deadlines/deadlines'

export type AgendaGroup = { key: 'overdue' | 'today' | 'week' | 'later'; label: string; items: Deadline[] }

const GROUPS: { key: AgendaGroup['key']; label: string; test: (d: Deadline) => boolean }[] = [
  { key: 'overdue', label: 'Overdue', test: (d) => d.daysUntil < 0 },
  { key: 'today', label: 'Today', test: (d) => d.daysUntil === 0 },
  { key: 'week', label: 'This week', test: (d) => d.daysUntil >= 1 && d.daysUntil <= 7 },
  { key: 'later', label: 'Later', test: (d) => d.daysUntil > 7 },
]

/** The Planner's agenda sections, in order; empty ones are left out. */
export function groupAgenda(deadlines: Deadline[]): AgendaGroup[] {
  return GROUPS
    .map(({ key, label, test }) => ({ key, label, items: deadlines.filter(test) }))
    .filter((g) => g.items.length > 0)
}
