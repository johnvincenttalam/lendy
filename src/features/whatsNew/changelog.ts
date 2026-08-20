export type Release = {
  version: string
  /** ISO date the release shipped. Displayed as e.g. "August 2026". */
  date: string
  title: string
  highlights: string[]
}

/**
 * Newest first. This array *is* the app's version — CURRENT_VERSION is its top
 * entry — so shipping a release means adding one object here and nothing else.
 * package.json's version is left alone; a second source of truth would only
 * drift from this one.
 */
export const CHANGELOG: Release[] = [
  {
    version: '1.3.0',
    date: '2026-08-20',
    title: 'Financial Health',
    highlights: [
      'A 0-100 health score on your home screen. Tap it to see the four things it scores.',
      'Loans and bills now add up to one commitment total, so you can see what is actually left over.',
      'Monthly payment is worked out from the amount, rate and tenure instead of being typed in.',
      'Bills accept partial payments and track what is still owed this cycle.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-08-17',
    title: 'Bills & Savings',
    highlights: [
      'Track recurring bills with due dates, rollover and overdue warnings.',
      'Set savings goals and log deposits toward them.',
      'A More tab gathers Analytics, Bills and Savings in one place.',
      'Backup and restore now covers loans, bills and savings together.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08-10',
    title: 'Notes & Hints',
    highlights: [
      'Add notes to a loan. They are searchable from the dashboard and included in CSV export.',
      'The home screen hints at your next upcoming payment.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-06-15',
    title: 'Lendy',
    highlights: [
      'Track loans with full payment schedules and progress.',
      'See every due date on a calendar.',
      'Analytics on interest, balances and payoff.',
      'PIN lock and due-date reminders.',
    ],
  },
]

export const CURRENT_VERSION = CHANGELOG[0].version
