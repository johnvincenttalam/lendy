import { describe, it, expect } from 'vitest'
import { groupAgenda } from './agenda'
import type { Deadline } from '../../core/deadlines/deadlines'
import { statusFor } from '../../core/deadlines/deadlines'

const d = (id: string, daysUntil: number): Deadline => ({
  id, module: 'bills', recordId: id, title: id, color: '#000', amount: 100, installments: 1,
  daysUntil, dueDate: '2026-11-26', status: statusFor(daysUntil), href: `/bills/${id}`,
})
const shape = (groups: ReturnType<typeof groupAgenda>) => groups.map((g) => [g.key, g.label, g.items.map((i) => i.id)])

describe('groupAgenda', () => {
  it('groups into overdue, today, this week and later, keeping order', () => {
    expect(shape(groupAgenda([d('late', -3), d('now', 0), d('soon', 2), d('wk', 7), d('far', 8), d('farther', 20)]))).toEqual([
      ['overdue', 'Overdue', ['late']],
      ['today', 'Today', ['now']],
      ['week', 'This week', ['soon', 'wk']],
      ['later', 'Later', ['far', 'farther']],
    ])
  })

  it('leaves out empty groups', () => {
    expect(shape(groupAgenda([d('soon', 1)]))).toEqual([['week', 'This week', ['soon']]])
  })

  it('gives nothing for nothing', () => {
    expect(groupAgenda([])).toEqual([])
  })
})
