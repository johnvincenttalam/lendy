import { create } from 'zustand'
import { useLoanStore } from '../loans/loanStore'

const STORAGE_KEY = 'loan-tracker-ollie'
/** Keep the celebrated-payment list from growing forever. */
const MAX_CELEBRATED = 200
/** Forget dismissals and seen-insight dates after this long. */
const RETENTION_DAYS = 60

type Persisted = {
  /** Payments that have already had their celebration. */
  celebratedIds: string[]
  /** Situation key -> local date (YYYY-MM-DD) it was dismissed. */
  dismissed: Record<string, string>
  /** Insight key -> local date it was first shown. */
  seenInsights: Record<string, string>
  /** Local date of the last day-opening greeting. */
  lastGreetingDate: string | null
  /** Dashboard visit counter — drives message rotation. */
  visit: number
}

function pruneByDate(record: Record<string, string>): Record<string, string> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)
  const cutoffISO = cutoff.toISOString().split('T')[0]
  return Object.fromEntries(Object.entries(record).filter(([, date]) => date >= cutoffISO))
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw) as Partial<Persisted>
      return {
        celebratedIds: Array.isArray(data.celebratedIds) ? data.celebratedIds : [],
        dismissed: pruneByDate(data.dismissed ?? {}),
        seenInsights: pruneByDate(data.seenInsights ?? {}),
        lastGreetingDate: data.lastGreetingDate ?? null,
        visit: Number.isFinite(data.visit) ? Number(data.visit) : 0,
      }
    }
  } catch {
    // fall through to a fresh state
  }
  // First run: treat every payment that already exists as celebrated, so
  // turning Ollie on doesn't throw a party for yesterday's payment.
  return {
    celebratedIds: useLoanStore.getState().payments.map((p) => p.id).slice(-MAX_CELEBRATED),
    dismissed: {},
    seenInsights: {},
    lastGreetingDate: null,
    visit: 0,
  }
}

function save(state: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable — Ollie just forgets; nothing else breaks.
  }
}

type OllieStore = Persisted & {
  markCelebrated: (paymentId: string) => void
  dismiss: (key: string, today: string) => void
  restore: (key: string) => void
  markInsightSeen: (key: string, today: string) => void
  markGreeted: (today: string) => void
  setVisit: (visit: number) => void
}

const persisted = (s: OllieStore): Persisted => ({
  celebratedIds: s.celebratedIds,
  dismissed: s.dismissed,
  seenInsights: s.seenInsights,
  lastGreetingDate: s.lastGreetingDate,
  visit: s.visit,
})

export const useOllieStore = create<OllieStore>((set, get) => {
  const update = (patch: Partial<Persisted>) => {
    set(patch)
    save(persisted(get()))
  }

  return {
    ...load(),

    markCelebrated: (paymentId) => {
      const { celebratedIds } = get()
      if (celebratedIds.includes(paymentId)) return
      update({ celebratedIds: [...celebratedIds, paymentId].slice(-MAX_CELEBRATED) })
    },

    dismiss: (key, today) => update({ dismissed: { ...get().dismissed, [key]: today } }),

    restore: (key) => {
      const rest = { ...get().dismissed }
      delete rest[key]
      update({ dismissed: rest })
    },

    markInsightSeen: (key, today) => {
      if (get().seenInsights[key]) return
      update({ seenInsights: { ...get().seenInsights, [key]: today } })
    },

    markGreeted: (today) => {
      if (get().lastGreetingDate === today) return
      update({ lastGreetingDate: today })
    },

    setVisit: (visit) => {
      if (get().visit === visit) return
      update({ visit })
    },
  }
})
