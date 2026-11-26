# Progress

Newest first. Each entry says what was done, how it was verified, and what's
known to be left. Branch: `feature/phase-1-foundation` (not merged or pushed).

## 2026-11-26 — Final review of the branch (done)

A fresh reviewer read the whole branch (Phase 1a + 1b–1e): "ready with fixes".
Fixed, each with a test that failed first:
- **Offline / blank screen:** pages load on demand, but the service worker
  only cached what had been fetched, and there was no error boundary. Now the
  build pre-caches every file (`build/precache.ts`), the worker's cache
  fallback ignores `Vary` (module scripts never matched before), a page error
  boundary offers Reload, and an old tab after an update reloads once by itself.
  New Playwright `offline` project opens every page offline against the build.
- **Restore safety copy:** kept unless the old data is fully back (storage
  full mid-undo used to delete it); versioned; offered for 7 days, then deleted.

Then the minor findings, each with a test first:
- Restore drops payments/transactions whose loan, bill or goal was left out.
- Undo also puts back the last-backup date, so the 30-day reminder returns.
- Settings' "Undo last restore" updates when undo happens from the toast.
- Add from a private loan's page saves the new loan in the folder.
- Old `#/calendar?y=&m=` links keep their month; Customize Home reorder has an e2e test.
- "Today" refreshes when the app comes back to the foreground; Ollie shares the due list's clock.
- Dead `upcomingPayments` removed; the chat no longer suggests a spending question.

Checks: 279 unit tests, 19 Playwright runs (phone, desktop, offline), lint,
typecheck, build.

## 2026-11-26 — Phase 1b–1e: Life OS shell (done)

Spec `docs/superpowers/specs/2026-11-26-life-os-shell-design.md`, plan
`docs/superpowers/plans/2026-11-26-life-os-shell.md`. Owner decisions: loan
list stays on Home (option A); Ollie reminds about bills too.

- **Core:** `core/time` (local dates, `useToday`), `core/money` + `core/locale`
  (fixed PHP / en-PH), `core/settings` (Home layout, sidebar), `core/deadlines`
  (loans + bills in one list, via a React context), `core/modules` (ModuleDef + registry).
- **Shell:** `AppShell` layout route; phones get Home / Planner / [+] / Ollie /
  More, desktop (lg) a collapsible sidebar; [+] opens an Add menu or the page's
  own form on Bills, Savings and the private folder; reminders bell (overdue +
  today); Sheets close on Escape and manage focus; pages load on demand.
- **Home:** widgets (Due soon, Money summary, Financial health, Savings, Your
  loans) in the owner's order; Customize Home; empty widgets hide themselves.
- **Planner:** agenda (Overdue / Today / This week / Later, 30 days) + Calendar
  tab; old `#/calendar` redirects. **What-if** replaces the old loan Planner at `/what-if`.
- **Ollie:** own page with the chat; due reminders now include bills; prompt
  names the new screens and points to What-if.
- **Tests (before review fixes):** 264 unit tests; 12 Playwright smoke tests (phone 390px and desktop
  1280px); new `e2e.yml` workflow (no deploy). Main bundle 304 kB (was 497 kB).

Verified manually on desktop with synthetic data on a fresh port: Home
widgets, Customize persistence, Add menu + Escape + focus return, Bills
context add, sidebar collapse, Planner agenda/calendar, Ollie page offline
message. Phone layout verified by Playwright only (no real-phone pass yet).

**Known, not done**
- A real-phone pass (safe areas, thumb reach, airplane mode) before merging.

## 2026-11-26 — Phase 1a: data-safety fixes (done)

Decisions applied (owner said "go with your recommendations"): safety fixes
first; nav = Home / Planner / [+] / Ollie / More; the loan calculator becomes
"What-if"; AI endpoint gets a passphrase + required Upstash (Phase 4);
centavos conversion in Phase 2; zod/date-fns/Playwright/dexie approved.

| Finding | Change | Verified |
|---|---|---|
| D1 month-end dates | `core/time/addMonthsClamped`, used by the schedule, end date, debt-free date, mark-as-paid, notifications, planner, loan form | Unit tests (Jan 31 → Feb 28 → Mar 31, leap year, year rollover); real app shows Feb 28 / Mar 31 |
| D2 partial replace, non-atomic | `writeRestore`: safety copy first, writes every section, puts everything back on any failure; missing sections become empty | Unit tests incl. simulated quota failure; real app: loan-only file replaced loans, bills, goals and income |
| D3 no way back | `undoRestore` + Settings "Undo last restore" (with confirmation) + UNDO on the toast | Unit tests; real app: undo restored all sections and removed the copy |
| D4 weak validation | zod schemas per feature (`loanSchema`, `billSchema`, `savingsSchema`); bad and duplicate records skipped and counted in the confirmation | Unit tests; real app showed "1 record … will be left out" |
| D6 two monthly figures | `monthlyLoanPayments()` everywhere; the health score now uses the billed amount, as the app already told users | Unit tests incl. off-schedule loan |
| Dependency advisory | react-router 7.18.7; prod `npm audit` clean | Full suite + build |
| Bundle | Restore validation lazy-loaded (`prepareRestore.ts`, 25 kB gzip chunk) | Main bundle 497 kB (baseline 493 kB) |

Checks at the end: `tsc -b` clean, eslint clean, 222/222 tests, build OK, no
console errors.

**Behaviour changes the owner will notice**
- Loans starting on the 29th–31st show different (correct) due dates; past
  payment records keep their stored dates.
- The financial health score changes for any loan whose billed monthly
  differs from its amount/rate/tenure (it now uses the billed figure).
- Restoring an old loan-only backup now clears bills and savings goals (it's a
  full replace), but can be undone.

**Known, not done**
- Dev-only tooling advisories remain in `npm audit` (not shipped to users).
- date-fns not added yet: one clamped month helper covered every need so far.
- Remaining Phase 1: 1b core layer (money, settings, module registry),
  1c app shell + nav, 1d dashboard v2, 1e unified reminders, Playwright smoke tests.

## 2026-11-26 — Phase 0: audit (done)

`docs/ARCHITECTURE.md`, `docs/ROADMAP.md`. Baseline: lint clean, 190/190
tests, build OK (493 kB).
