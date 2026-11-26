import { describe, it, expect } from 'vitest'
import { collectDeadlines, statusFor } from './deadlines'
import type { Deadline, DeadlineCollector } from './deadlines'

const NOW = new Date(2026, 10, 26, 9, 0)
const d = (id: string, daysUntil: number, amount = 100): Deadline => ({
  id, module: 'bills', recordId: id, title: id, color: '#000', amount, installments: 1,
  daysUntil, dueDate: '2026-11-26', status: statusFor(daysUntil), href: `/bills/${id}`,
})
const input = { loans: [], bills: [], billPayments: [] }

describe('statusFor', () => {
  it('names overdue, today and upcoming', () => {
    expect([statusFor(-1), statusFor(0), statusFor(3)]).toEqual(['overdue', 'today', 'upcoming'])
  })
})

describe('collectDeadlines', () => {
  it('keeps everything overdue but only upcoming items inside the horizon', () => {
    const c: DeadlineCollector = () => [d('far', 10), d('late', -40), d('soon', 7)]
    expect(collectDeadlines([c], input, NOW, 7).map((x) => x.id)).toEqual(['late', 'soon'])
  })

  it('puts the oldest overdue first, then today, then upcoming; ties by larger amount', () => {
    const loansC: DeadlineCollector = () => [d('today-small', 0, 50), d('up', 2)]
    const billsC: DeadlineCollector = () => [d('today-big', 0, 900), d('late', -3), d('later', -1)]
    expect(collectDeadlines([loansC, billsC], input, NOW, 30).map((x) => x.id))
      .toEqual(['late', 'later', 'today-big', 'today-small', 'up'])
  })
})
