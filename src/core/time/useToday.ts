import { useEffect, useState } from 'react'
import { localISODate } from './localDate'

/** `now` if the local date has changed since `prev`, else `prev` itself (so React skips the re-render). */
export function nextToday(prev: Date, now: Date): Date {
  return localISODate(now) === localISODate(prev) ? prev : now
}

/**
 * The current time, refreshed when the local date changes, so screens left
 * open past midnight move on to the new day without re-rendering every minute.
 * Also checks the moment the app comes back to the foreground, so reopening it
 * the next morning shows today straight away.
 */
export function useToday(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const check = () => setNow((prev) => nextToday(prev, new Date()))
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    const id = window.setInterval(check, 60_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return now
}
