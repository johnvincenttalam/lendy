import { createContext, useContext, useMemo } from 'react'
import type { Deadline } from './deadlines'

/** How far ahead the app collects: enough for Ollie's "next payment" note. */
export const DEADLINE_HORIZON_DAYS = 366

export type DeadlinesValue = { deadlines: Deadline[]; now: Date }

/**
 * Provided by the app shell (which knows every module); read by widgets,
 * the Planner, the bell and Ollie. A context rather than an import keeps
 * features from depending on the app's module list.
 */
export const DeadlinesContext = createContext<DeadlinesValue>({ deadlines: [], now: new Date() })

/** Everything overdue plus what's due within `horizonDays`, most pressing first. */
export function useDeadlines(horizonDays: number): Deadline[] {
  const { deadlines } = useContext(DeadlinesContext)
  return useMemo(() => deadlines.filter((d) => d.daysUntil <= horizonDays), [deadlines, horizonDays])
}

/** The "now" the deadlines were worked out against. */
export function useDeadlinesNow(): Date {
  return useContext(DeadlinesContext).now
}
