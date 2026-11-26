import { useEffect, useState } from 'react'
import { localISODate } from './localDate'

/**
 * The current time, refreshed when the local date changes, so screens left
 * open past midnight move on to the new day without re-rendering every minute.
 */
export function useToday(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow((prev) => {
        const next = new Date()
        return localISODate(next) === localISODate(prev) ? prev : next
      })
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}
