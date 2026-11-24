import { formatCurrency } from '../loans/loanUtils'
import { formatDate, formatDateShort } from '../../utils/dateUtils'
import type { DuePayment, OllieInsight, OllieSituation } from './ollieTypes'

export type OllieMessageContent = {
  /** Short chip label, e.g. "Due today". */
  label: string
  /** The sentence Ollie says. Built only from real loan data. */
  text: string
}

type Template<C> = (ctx: C) => string

/**
 * Pick a variation. `rotation` advances once per dashboard visit, so the
 * wording changes on refresh while staying stable within a single visit.
 */
function pick<C>(variants: Template<C>[], rotation: number, ctx: C): string {
  const index = ((rotation % variants.length) + variants.length) % variants.length
  return variants[index](ctx)
}

// --- Formatting helpers (reuse the app's existing currency/date formatters) ---

const money = (amount: number) => formatCurrency(amount)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** "today" / "tomorrow" / "in 3 days" */
export function relativeDue(daysUntil: number): string {
  if (daysUntil === 0) return 'today'
  if (daysUntil === 1) return 'tomorrow'
  return `in ${daysUntil} days`
}

/** "Nov 26" this year, "Jan 3, 2027" otherwise. */
export function friendlyDate(date: Date, now: Date): string {
  return date.getFullYear() === now.getFullYear() ? formatDateShort(date) : formatDate(date)
}

function timeOfDayGreeting(now: Date): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// --- Variations per situation ---

type DueCtx = { p: DuePayment; date: string; amount: string; name: string }
type GroupCtx = { count: number; total: string; first: DueCtx }

const OVERDUE_ONE: Template<DueCtx & { days: number }>[] = [
  (c) => `Your ${c.name} payment of ${c.amount} was due ${c.date}. Let's get it sorted today.`,
  (c) => `${c.name} is ${plural(c.days, 'day')} overdue — ${c.amount}. A quick payment gets you back on track.`,
]

const OVERDUE_BEHIND: Template<DueCtx & { installments: number }>[] = [
  (c) => `${c.name} is ${c.installments} payments behind — ${c.amount} overdue since ${c.date}.`,
  (c) => `Let's catch up on ${c.name}: ${c.installments} missed payments, ${c.amount} in total since ${c.date}.`,
]

const OVERDUE_MANY: Template<GroupCtx>[] = [
  (c) => `${c.count} of your loans have overdue payments, ${c.total} in total. The oldest, ${c.first.name}, was due ${c.first.date}.`,
  (c) => `${c.count} loans slipped past their due dates — ${c.total} overdue in all. Let's catch up one at a time.`,
]

const TODAY_ONE: Template<DueCtx>[] = [
  (c) => `Today's the day! Your ${c.name} payment of ${c.amount} is due.`,
  (c) => `Don't forget your ${c.name} payment of ${c.amount} today.`,
]

const TODAY_MANY: Template<GroupCtx>[] = [
  (c) => `Today's the day! You have ${c.count} payments due, ${c.total} in total.`,
  (c) => `Don't forget — ${c.count} payments are due today, totaling ${c.total}.`,
]

const SOON_ONE: Template<DueCtx & { when: string }>[] = [
  (c) => `Heads up! Your ${c.name} payment of ${c.amount} is due ${c.when}.`,
  (c) => `Your next payment is scheduled for ${c.date}: ${c.name}, ${c.amount}.`,
  (c) => `Heads up! You have a payment due ${c.when} — ${c.name}, ${c.amount}.`,
]

const SOON_MANY: Template<GroupCtx & { when: string }>[] = [
  (c) => `You have ${c.count} upcoming payments. Let's prepare ahead! The first is due ${c.when}.`,
  (c) => `Heads up! ${c.count} payments totaling ${c.total} are coming up, starting ${c.first.date}.`,
]

const WEEK_ONE: Template<DueCtx & { when: string }>[] = [
  (c) => `Your next payment is scheduled for ${c.date} — ${c.name}, ${c.amount}.`,
  (c) => `A little heads-up: ${c.name} (${c.amount}) is due ${c.when}. Let's prepare ahead!`,
]

const WEEK_MANY: Template<GroupCtx & { windowDays: number }>[] = [
  (c) => `You have ${c.count} upcoming payments in the next ${c.windowDays} days, totaling ${c.total}. Let's prepare ahead!`,
  (c) => `${c.count} payments are coming up, starting with ${c.first.name} on ${c.first.date}.`,
]

type CelebrateCtx = { name: string; amount: string; remaining: string; left: number }

const CELEBRATE_PAID_OFF: Template<CelebrateCtx>[] = [
  (c) => `${c.name} is fully paid off! You're one step closer to being debt-free!`,
  (c) => `You did it — ${c.name} is paid in full! Look at you making progress!`,
]

const CELEBRATE_PAYMENT: Template<CelebrateCtx>[] = [
  (c) => `Another payment down! Great job! ${c.name} has ${c.remaining} left to go.`,
  (c) => `Look at you making progress! Only ${plural(c.left, 'payment')} left on ${c.name}.`,
  (c) => `You're one step closer to being debt-free! ${c.amount} paid toward ${c.name}.`,
]

function insightText(insight: OllieInsight, rotation: number): string {
  switch (insight.type) {
    case 'finish-line':
      return insight.paymentsLeft === 1
        ? `Just one payment left on ${insight.loan.name}! ${money(insight.remaining)} and it's done.`
        : `Only ${insight.paymentsLeft} payments left on ${insight.loan.name} — ${money(insight.remaining)} to go. Keep it up!`
    case 'debt-free-soon': {
      const when = insight.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      return pick([
        () => `At this pace, you could be debt-free by ${when}. A little planning today can make a big difference.`,
        () => `Debt-free by ${when} is within reach. You're making progress — keep it up!`,
      ], rotation, null)
    }
    case 'milestone':
      return pick([
        () => `You've paid off ${insight.percent}% of your loans. You're making progress — keep it up!`,
        () => `${insight.percent}% of your total loan cost is already paid. One step at a time!`,
      ], rotation, null)
    case 'high-dti':
      return `Loan payments take up about ${insight.percent}% of your monthly income. Let's review your remaining balances before taking on more.`
  }
}

const GREETING_NEW: Template<{ hello: string }>[] = [
  (c) => `${c.hello}! I'm Ollie. Add your first loan and I'll keep an eye on your due dates.`,
  () => `Hi, I'm Ollie! Let's get your finances organized — start by adding a loan.`,
]

const GREETING: Template<{ hello: string }>[] = [
  (c) => `${c.hello}! Ready to manage your finances today?`,
  () => `Welcome back! Let's keep your finances organized.`,
  (c) => `${c.hello}! One step at a time. You've got this!`,
]

const RELAXED_NEXT: Template<DueCtx>[] = [
  (c) => `No payments due today. Take a breath! Your next one is ${c.name} on ${c.date}.`,
  (c) => `Everything looks good. Next up: ${c.name}, ${c.amount} on ${c.date}.`,
  (c) => `Enjoy a little peace of mind — nothing's due until ${c.date}.`,
]

const RELAXED_DONE: Template<null>[] = [
  () => `All your loans are paid off. Enjoy a little peace of mind!`,
  () => `Everything's paid off. Keep up the great work!`,
]

const RELAXED_GENERIC: Template<null>[] = [
  () => `No payments due today. Take a breath!`,
  () => `Everything looks good. Keep up the great work!`,
]

function dueCtx(p: DuePayment, now: Date): DueCtx {
  return { p, name: p.loan.name, amount: money(p.amount), date: friendlyDate(p.dueDate, now) }
}

function groupCtx(payments: DuePayment[], total: number, now: Date): GroupCtx {
  return { count: payments.length, total: money(total), first: dueCtx(payments[0], now) }
}

/**
 * Build what Ollie says for a situation. Every figure comes from the
 * situation itself (derived from the stores), never from sample data.
 */
export function buildOllieMessage(situation: OllieSituation, rotation: number, now: Date): OllieMessageContent {
  switch (situation.kind) {
    case 'overdue': {
      const { payments, total } = situation
      const label = payments.length === 1 ? 'Overdue' : `${payments.length} overdue`
      if (payments.length > 1) return { label, text: pick(OVERDUE_MANY, rotation, groupCtx(payments, total, now)) }
      const p = payments[0]
      const text = p.installments > 1
        ? pick(OVERDUE_BEHIND, rotation, { ...dueCtx(p, now), installments: p.installments })
        : pick(OVERDUE_ONE, rotation, { ...dueCtx(p, now), days: -p.daysUntil })
      return { label, text }
    }

    case 'due-today': {
      const { payments, total } = situation
      return {
        label: 'Due today',
        text: payments.length === 1
          ? pick(TODAY_ONE, rotation, dueCtx(payments[0], now))
          : pick(TODAY_MANY, rotation, groupCtx(payments, total, now)),
      }
    }

    case 'upcoming': {
      const { payments, total, tier, windowDays } = situation
      const when = relativeDue(payments[0].daysUntil)
      const label = tier === 'soon' ? `Due ${when}` : 'Coming up'
      if (payments.length === 1) {
        const ctx = { ...dueCtx(payments[0], now), when }
        return { label, text: pick(tier === 'soon' ? SOON_ONE : WEEK_ONE, rotation, ctx) }
      }
      const group = groupCtx(payments, total, now)
      return {
        label,
        text: tier === 'soon'
          ? pick(SOON_MANY, rotation, { ...group, when })
          : pick(WEEK_MANY, rotation, { ...group, windowDays }),
      }
    }

    case 'celebrating': {
      const ctx: CelebrateCtx = {
        name: situation.loan.name,
        amount: money(situation.payment.amount),
        remaining: money(situation.remaining),
        left: situation.paymentsLeft,
      }
      return situation.fullyPaid
        ? { label: 'Paid off!', text: pick(CELEBRATE_PAID_OFF, rotation, ctx) }
        : { label: 'Payment recorded', text: pick(CELEBRATE_PAYMENT, rotation, ctx) }
    }

    case 'insight':
      return { label: 'Insight', text: insightText(situation.insight, rotation) }

    case 'greeting': {
      const hello = timeOfDayGreeting(now)
      return {
        label: 'Hello',
        text: pick(situation.hasLoans ? GREETING : GREETING_NEW, rotation, { hello }),
      }
    }

    case 'relaxed': {
      if (situation.allPaidOff) return { label: 'All clear', text: pick(RELAXED_DONE, rotation, null) }
      if (situation.next) return { label: 'All clear', text: pick(RELAXED_NEXT, rotation, dueCtx(situation.next, now)) }
      return { label: 'All clear', text: pick(RELAXED_GENERIC, rotation, null) }
    }
  }
}

/** One-line description of a due payment for the details list. */
export function describeDue(p: DuePayment, now: Date): string {
  if (p.daysUntil < 0) {
    const days = plural(-p.daysUntil, 'day')
    return p.installments > 1 ? `${p.installments} payments · ${days} overdue` : `${days} overdue`
  }
  if (p.daysUntil === 0) return 'Due today'
  return `Due ${relativeDue(p.daysUntil)} · ${friendlyDate(p.dueDate, now)}`
}
