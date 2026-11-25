import { useEffect, useMemo, useState } from 'react'
import { ChevronUp } from 'lucide-react'
import { useLoanStore } from '../loans/loanStore'
import { useIncomeStore } from '../finance/incomeStore'
import { useNotificationStore } from '../notifications/notificationStore'
import { useLastBackupStore } from '../backup/lastBackupStore'
import CurrencyAmount from '../../components/CurrencyAmount'
import { useOllieStore } from './ollieStore'
import { findCelebratablePayment, localISODate, selectOllieSituation } from './ollieUtils'
import { buildOllieMessage } from './ollieMessages'
import { OLLIE_TONES, isCritical, moodFor, ollieView } from './ollieStates'
import OllieCharacter from './OllieCharacter'
import OllieMessage from './OllieMessage'

/**
 * Keep "today" current if the dashboard stays open past midnight, without
 * re-rendering every minute for nothing.
 */
function useToday(): Date {
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

type Props = {
  className?: string
  /** Page-header presentation: a larger Ollie standing on the page, no card. */
  hero?: boolean
  /** Tapping the owl opens the Ask Ollie chat. */
  onAsk?: () => void
}

/**
 * Ollie, the dashboard companion. Reads the existing loan, payment, income
 * and reminder settings, picks the single most important thing to say via
 * selectOllieSituation, and remembers what's been celebrated or dismissed.
 */
export default function OllieCompanion({ className = '', hero = false, onAsk }: Props) {
  const loans = useLoanStore((s) => s.loans)
  const payments = useLoanStore((s) => s.payments)
  const monthlyIncome = useIncomeStore((s) => s.monthlyIncome)
  const reminderDays = useNotificationStore((s) => s.reminderDays)
  const lastBackupAt = useLastBackupStore((s) => s.lastBackupAt)
  const {
    celebratedIds, dismissed, seenInsights, lastGreetingDate, visit,
    markCelebrated, dismiss, restore, markInsightSeen, markGreeted, setVisit,
  } = useOllieStore()

  const now = useToday()
  const today = localISODate(now)

  // Captured once per visit: which message variation to use, and whether
  // this is the day's first visit (so the greeting doesn't repeat all day).
  const [rotation] = useState(visit)
  const [greetingEligible] = useState(() => lastGreetingDate !== today)
  useEffect(() => { setVisit(rotation + 1) }, [rotation, setVisit])

  // A celebration is locked to this visit once it starts, so recording it
  // as "celebrated" doesn't make Ollie stop mid-party — but the next visit
  // won't celebrate the same payment again.
  const [celebrating, setCelebrating] = useState<string | null>(null)
  const pendingCelebration = useMemo(() => {
    const seen = new Set(celebratedIds)
    return findCelebratablePayment(payments, loans, seen, now)?.payment.id ?? null
  }, [payments, loans, celebratedIds, now])
  if (pendingCelebration && pendingCelebration !== celebrating) {
    setCelebrating(pendingCelebration)
  }

  const situation = useMemo(() => {
    const seen = new Set(celebratedIds)
    if (celebrating) seen.delete(celebrating)
    return selectOllieSituation({
      loans,
      payments,
      now,
      reminderDays,
      monthlyIncome,
      celebratedIds: seen,
      seenInsights,
      greetingEligible,
      lastBackupAt,
    })
  }, [loans, payments, now, reminderDays, monthlyIncome, celebratedIds, celebrating, seenInsights, greetingEligible, lastBackupAt])

  // Record what Ollie actually showed.
  useEffect(() => {
    if (situation.kind === 'celebrating') markCelebrated(situation.payment.id)
    if (situation.kind === 'insight') markInsightSeen(situation.insightKey, today)
    if (situation.kind === 'greeting') markGreeted(today)
  }, [situation, today, markCelebrated, markInsightSeen, markGreeted])

  const content = useMemo(() => buildOllieMessage(situation, rotation, now), [situation, rotation, now])
  const mood = moodFor(situation)
  const tone = OLLIE_TONES[situation.kind]
  const critical = isCritical(situation)
  const view = ollieView(dismissed[situation.key] !== undefined, critical)

  // Other messages leave a small bar behind, so a closed message can come back.
  if (view === 'show-bar') {
    return (
      <section aria-label="Ollie, your financial companion" className={className}>
        <button
          type="button"
          onClick={() => restore(situation.key)}
          aria-label={`${content.label} message hidden. Show Ollie`}
          className="w-full flex items-center gap-2.5 rounded-2xl border border-themed bg-card px-2.5 py-1.5 text-left transition-colors hover:bg-card-hover animate-fade-in"
        >
          <OllieCharacter mood={mood} sizeClassName="w-9" still />
          <span className="flex-1 min-w-0 text-[12.5px] text-muted truncate">
            <span className="font-extrabold text-primary">{content.label}</span> message hidden
          </span>
          <span className="flex items-center gap-0.5 text-[11.5px] font-semibold text-secondary shrink-0">
            Show Ollie <ChevronUp className="w-3.5 h-3.5" />
          </span>
        </button>
      </section>
    )
  }

  // Critical reminders collapse to a compact bar instead — they stay reachable.
  if (view === 'reminder-bar' && (situation.kind === 'overdue' || situation.kind === 'due-today')) {
    const count = situation.payments.length
    const summary = situation.kind === 'overdue'
      ? (count === 1 ? `${situation.payments[0].loan.name} is overdue` : `${count} loans overdue`)
      : `${count} ${count === 1 ? 'payment' : 'payments'} due today`
    return (
      <section aria-label="Ollie, your financial companion" className={className}>
        <button
          type="button"
          onClick={() => restore(situation.key)}
          aria-label={`${summary}. Show Ollie's reminder`}
          className="w-full flex items-center gap-2.5 rounded-2xl border border-themed bg-card px-2.5 py-1.5 text-left transition-colors hover:bg-card-hover animate-fade-in"
        >
          <OllieCharacter mood={mood} sizeClassName="w-9" still />
          <span className="flex-1 min-w-0 text-[12.5px] text-primary">
            <span className="font-extrabold">{summary}</span>{' '}
            <span className="text-muted">(<CurrencyAmount value={situation.total} />)</span>
          </span>
          <span className="flex items-center gap-0.5 text-[11.5px] font-semibold text-secondary shrink-0">
            Show <ChevronUp className="w-3.5 h-3.5" />
          </span>
        </button>
      </section>
    )
  }

  const owl = (
    <OllieCharacter
      key={situation.key}
      mood={mood}
      celebrate={situation.kind === 'celebrating'}
      sizeClassName={hero ? 'w-[92px] sm:w-[116px]' : undefined}
    />
  )

  return (
    <section
      aria-label="Ollie, your financial companion"
      className={`flex items-center animate-scale-in ${hero
        ? 'gap-4 sm:gap-5'
        : 'gap-3.5 sm:gap-4 rounded-2xl border border-themed bg-card p-3 sm:p-3.5'} ${className}`}
    >
      {onAsk ? (
        <button type="button" onClick={onAsk} aria-label="Ask Ollie" className="shrink-0 rounded-3xl active:scale-95 transition-transform">
          {owl}
        </button>
      ) : owl}
      <div className="flex-1 min-w-0" aria-live="polite" aria-atomic="true">
        <OllieMessage
          key={situation.key}
          situation={situation}
          content={content}
          tone={tone}
          now={now}
          critical={critical}
          onDismiss={() => dismiss(situation.key, today)}
        />
      </div>
    </section>
  )
}
