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
    version: '1.14.0',
    date: '2026-11-26',
    title: 'A new home for everything',
    highlights: [
      'New navigation: Home, Planner, Ollie and More, with the + button in the middle. On a computer, a sidebar takes over.',
      'The + button opens a menu to add a loan, bill or savings goal (on the Bills and Savings pages it goes straight to that form).',
      'Planner shows everything that’s due across your loans and bills, from overdue to later this month, with the calendar one tap away.',
      'Ollie has its own page for chatting, and now reminds you about bills too, not just loans.',
      'Customize Home lets you reorder and hide sections. A new Due soon section and a bell show what needs paying.',
      'The loan planner is now called What-if, under More.',
    ],
  },
  {
    version: '1.13.1',
    date: '2026-11-26',
    title: 'Safer restores, steadier dates',
    highlights: [
      'Restoring a backup can now be undone: Ollie keeps a copy of what was there first, and Settings has "Undo last restore".',
      'Ollie checks a backup before restoring and tells you if anything in it couldn’t be read, instead of saving it half-broken.',
      'Loans that start on the 29th, 30th or 31st are now due on the last day of shorter months (Feb 28, not Mar 3).',
      'Your monthly loan total is now the same everywhere, including the financial health score.',
    ],
  },
  {
    version: '1.13.0',
    date: '2026-11-25',
    title: 'Planner',
    highlights: [
      'Try a loan before you take it: Planner (under More) works out the monthly payment and interest, and Ollie tells you whether it fits your comfortable limit, or from when it would.',
      'See when your monthly loan payments go down as each loan finishes.',
      'Ask Ollie "when can I borrow again?" and get the date your payments drop back under the limit.',
      'Loans that are behind now show a realistic finish date, assuming you catch up, instead of a date that has already passed.',
    ],
  },
  {
    version: '1.12.0',
    date: '2026-11-25',
    title: 'Your data, kept safe',
    highlights: [
      'Settings shows when you last made a backup, and Ollie reminds you about once a month if it’s been a while.',
      'Ollie asks your browser to keep your data even when your phone runs low on space.',
      'Backups now note which version of Ollie made them, so future updates can still restore older ones.',
    ],
  },
  {
    version: '1.11.0',
    date: '2026-11-25',
    title: 'A simpler app',
    highlights: [
      'The Money page is gone, so Ollie can stay focused on your loans, bills and savings.',
      'Ollie still uses the monthly income you set in Settings to tell you how much room your loans leave.',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-11-25',
    title: 'Ollie talks like a friend',
    highlights: [
      'Ask Ollie "should I take another loan?" and get an honest read, like "I’d hold off for now", with the reasons behind it.',
      'Ollie now spots what the numbers mean together, like how much room is left before loans get too heavy, which loan finishes next and frees up money, and when the income you recorded is lower than your income setting.',
      'Answers sound warmer and often end with a helpful follow-up question.',
    ],
  },
  {
    version: '1.9.2',
    date: '2026-11-24',
    title: 'Ollie helps you weigh a decision',
    highlights: [
      'Ask Ollie "should I take another loan?" and get the numbers that matter, like your loan payments against your income and what’s overdue.',
      'Fixed odd gaps between words in some of Ollie’s answers.',
    ],
  },
  {
    version: '1.9.1',
    date: '2026-11-24',
    title: 'Bring Ollie back',
    highlights: [
      'Closing one of Ollie’s messages now leaves a small Show Ollie bar, so you can open it again.',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-11-24',
    title: 'Ask Ollie',
    highlights: [
      'Ask Ollie about your loans, bills, savings and spending in your own words.',
      'Ready to use — nothing to set up.',
      'Ollie only answers — it never changes your data.',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-11-24',
    title: 'A private folder',
    highlights: [
      'Move loans into a folder only you can open, with its own PIN.',
      'Name the folder whatever you like, and turn its PIN on or off in Settings.',
      'Loans in it stay out of your totals, reminders and Ollie.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-11-24',
    title: 'Meet Ollie',
    highlights: [
      'Lendy is now Ollie. Your loans, payments and settings carry over unchanged.',
      "A whole new look: clean and flat, with Ollie's teal scarf as the accent colour.",
      'Ollie the owl now greets you on the dashboard with reminders for overdue, due-today and upcoming payments.',
      'Tap a reminder to jump straight to the loan, or view every payment that needs attention.',
      'Ollie celebrates when you record a payment and shares progress milestones along the way.',
      'Choose Light, Dark or System appearance in Settings.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-10-02',
    title: 'Money Tracker',
    highlights: [
      'A new Money page under More lets you log income and expenses so you can see where your money goes.',
      'Each month shows your net, what you earned and spent, and a breakdown of spending by category.',
      'Add your own categories on top of the built-in ones. Deleting one moves its entries to Other.',
      'Money entries are included in backups. They are separate from your loans, bills and health score.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-08-25',
    title: 'Bill Insights',
    highlights: [
      'Bills open with a chart of what you actually paid each month, so you can see which months ran expensive and which were light.',
      'The month you are in is still adding up, so it is shown separately and left out of the highest and lowest figures until it is finished.',
      'Bill cards show an icon for their category instead of the first letter of the name.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-08-24',
    title: 'Analytics & Archiving',
    highlights: [
      'Analytics has its own tab in the bottom bar, so your insights are one tap away.',
      'Settings moved into the More tab, alongside Bills and Savings.',
      'Archiving a loan or bill now takes it out of your health score and every analytics figure, lifetime totals and payment history included.',
    ],
  },
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
