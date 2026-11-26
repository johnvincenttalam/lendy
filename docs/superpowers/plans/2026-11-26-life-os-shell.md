# Life OS Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Ollie a module-driven frame: shell + nav (Home / Planner / [+] / Ollie / More, desktop sidebar), quick-add, a customizable widget Home, one derived deadlines list (loans + bills) feeding Home, Planner, the bell and Ollie's reminders, plus What-if and Ollie pages.

**Architecture:** `src/core/*` holds store-free building blocks (time, money, settings, deadlines, module types). Each feature exports a `ModuleDef` from `features/<f>/module.tsx`; `src/app/modules.ts` lists them, and the shell, More, quick-add, Home, Planner and bell all read that list. A react-router layout route (`AppShell`) wraps every page.

**Tech Stack:** React 19, react-router 7 (HashRouter), Zustand 5, zod 4, Tailwind 4, Vitest 4, Playwright (new, dev).

**Spec:** `docs/superpowers/specs/2026-11-26-life-os-shell-design.md`

## Global Constraints

- No change to stored data shapes; `SCHEMA_VERSION` stays 1. The only new storage key is `loan-tracker-settings`.
- No new runtime dependencies; dev only: `@playwright/test`.
- Reuse existing tokens/classes (`bg-card`, `border-themed`, `bg-brand`, `text-primary`, `text-muted`, `var(--tint-*)`, `bg-header backdrop-blur-header`). No visual redesign.
- Private loans (`private: true`) and archived records never appear on Home widgets, in deadlines, the bell, the agenda or Ollie's reminders (`isTracked`).
- Dates are device-local. Add months with `addMonthsClamped`; local day strings with `localISODate`.
- `api/ask.ts` stays self-contained (no imports).
- Desktop breakpoint is Tailwind `lg` (1024px).
- Copy is in the app's existing voice: plain, warm, short. `’` for apostrophes in UI strings.
- Every task ends green: `npx tsc -b && npx eslint . && npx vitest run`.

## Review Focus

1. A saved Home layout naming a widget that no longer exists, or missing a newly added widget → unknown ids dropped, new widget appears at its default position (Task 4 test).
2. `loan-tracker-settings` holding garbage or an old shape → defaults, no crash (Task 2 test).
3. A bill or loan due today, checked just after local midnight → status `today`, not `overdue`; due yesterday → `overdue` (Task 3 test, TZ pinned to Asia/Manila).
4. A private or archived loan that's overdue → absent from deadlines and therefore Ollie, Home, bell and agenda (Task 3 + Task 5 tests).
5. Old links `#/calendar` and `#/planner` → Planner calendar and Planner agenda; `#/what-if` → the calculator (Task 10 e2e).

---

### Task 1: Core time and money helpers

**Files:**
- Create: `src/core/time/localDate.ts`, `src/core/time/localDate.test.ts`, `src/core/locale.ts`, `src/core/money/format.ts`
- Modify: `src/features/ollie/ollieUtils.ts` (move `localISODate` out, re-export it), `src/features/loans/loanUtils.ts` (move `formatCurrency`, `formatCurrencyParts` out, re-export), `vite.config.ts` (add `test.env.TZ`)

**Interfaces:**
- Produces: `localISODate(date: Date): string` (YYYY-MM-DD, local fields), `parseLocalISODate(s: string): Date` (local midnight), `CURRENCY = 'PHP'`, `LOCALE = 'en-PH'`, `formatCurrency(amount: number): string`, `formatCurrencyParts(amount: number): { symbol: string; amount: string }`.

- [ ] **Step 1: Pin the test time zone.** In `vite.config.ts` add `test: { env: { TZ: 'Asia/Manila' } }` (import `defineConfig` from `vitest/config` if the type requires it). Run `npx vitest run`; expected: 222 passed.
- [ ] **Step 2: Write failing tests** in `src/core/time/localDate.test.ts`:

```ts
it('formats local calendar fields', () => expect(localISODate(new Date(2026, 1, 3, 23, 59))).toBe('2026-02-03'))
it('parses to local midnight', () => {
  const d = parseLocalISODate('2026-02-28')
  expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 1, 28, 0])
})
it('round-trips', () => expect(localISODate(parseLocalISODate('2028-02-29'))).toBe('2028-02-29'))
```

- [ ] **Step 3: Run** `npx vitest run src/core/time`; expected: FAIL (module missing).
- [ ] **Step 4: Implement** `localDate.ts` (move the body of `localISODate` from `ollieUtils.ts`; `ollieUtils` re-exports it), `locale.ts`, and `money/format.ts` (move the formatter from `loanUtils.ts`, built from `LOCALE`/`CURRENCY`; `loanUtils` re-exports both functions). No call sites change.
- [ ] **Step 5: Run** full checks; expected: all green, 225 tests.
- [ ] **Step 6: Commit** `Add core time and money helpers`.

### Task 2: Settings store

**Files:**
- Create: `src/core/settings/settings.ts`, `src/core/settings/settings.test.ts`, `src/core/settings/settingsStore.ts`

**Interfaces:**
- Produces: `type HomeLayout = { order: string[]; hidden: string[] }`, `type Settings = { home: HomeLayout; sidebarCollapsed: boolean }`, `DEFAULT_SETTINGS: Settings` (`{ home: { order: [], hidden: [] }, sidebarCollapsed: false }`), `parseSettings(raw: string | null): Settings`, `SETTINGS_KEY = 'loan-tracker-settings'`, `useSettingsStore` with state `Settings` and actions `setHomeLayout(home: HomeLayout): void`, `resetHomeLayout(): void`, `setSidebarCollapsed(v: boolean): void` (each persists the whole object; writes wrapped in try/catch).

- [ ] **Step 1: Write failing tests** for `parseSettings`: `null` → `DEFAULT_SETTINGS`; `'not json'` → defaults; `'{"home":{"order":["a"],"hidden":"x"}}'` → `home.order` kept as `['a']`, `hidden` → `[]`, `sidebarCollapsed` → `false`; unknown top-level keys ignored; a valid full object round-trips through `JSON.stringify`.
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement** with a zod schema whose fields each `.catch()` their default (so one bad field doesn't discard the rest); the store loads via `parseSettings(localStorage.getItem(SETTINGS_KEY))` inside try/catch.
- [ ] **Step 4: Run** full checks; green.
- [ ] **Step 5: Commit** `Add a settings store for layout preferences`.

### Task 3: Deadlines

**Files:**
- Create: `src/core/deadlines/deadlines.ts`, `src/core/deadlines/deadlines.test.ts`, `src/features/loans/loanDeadlines.ts`, `src/features/bills/billDeadlines.ts`, `src/features/loans/loanDeadlines.test.ts`, `src/features/bills/billDeadlines.test.ts`

**Interfaces:**
- Consumes: `localISODate`, `parseLocalISODate` (Task 1); `duePaymentFor` (`ollieUtils`); `isBillOverdue`, `remainingForCycle` (`billUtils`); `calendarDaysBetween` (`ollieUtils`).
- Produces:

```ts
// core/deadlines/deadlines.ts
export type DeadlineStatus = 'overdue' | 'today' | 'upcoming'
export type Deadline = {
  id: string; module: 'loans' | 'bills'; recordId: string; title: string; color: string
  amount: number; installments: number; daysUntil: number
  dueDate: string; status: DeadlineStatus; href: string
}
export type DeadlineInput = { loans: Loan[]; bills: Bill[]; billPayments: BillPaymentRecord[] }
export type DeadlineCollector = (input: DeadlineInput, now: Date) => Deadline[]
export function statusFor(daysUntil: number): DeadlineStatus
export function collectDeadlines(collectors: DeadlineCollector[], input: DeadlineInput, now: Date, horizonDays: number): Deadline[]
  // keeps overdue + daysUntil <= horizonDays; sorts by daysUntil asc, then amount desc, then title
// features/loans/loanDeadlines.ts
export const loanDeadlines: DeadlineCollector   // id `loans:${loan.id}:${dueDate}`, href `/loan/${id}`
// features/bills/billDeadlines.ts
export const billDeadlines: DeadlineCollector   // id `bills:${bill.id}:${nextDueDate}`, href `/bills/${id}`
```

(`core` may import feature *types* only, `import type`.)

- [ ] **Step 1: Write failing tests.** Use synthetic loans/bills; `now = new Date(2026, 10, 26, 0, 30)` (00:30 local).
  - loans: an on-schedule loan with next due today → one deadline, `status: 'today'`, `daysUntil: 0`, `amount` = scheduled payment, `installments: 1`; a loan 2 instalments behind → `status: 'overdue'`, `installments: 2`, amount = both payments; private loan and archived loan → `[]`; fully paid → `[]`.
  - bills: `nextDueDate: '2026-11-26'` → `today`; `'2026-11-25'` → `overdue`, `daysUntil: -1`; partly paid (₱500 bill, ₱200 paid this cycle) → `amount: 300`; archived → `[]`.
  - `collectDeadlines`: horizon 7 drops a bill due in 10 days but keeps a loan 40 days overdue; ordering = overdue (oldest first), today, upcoming; ties broken by amount desc.
  - `statusFor(-1)`/`(0)`/`(3)` → overdue/today/upcoming.
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement.** Loans: map `duePaymentFor(loan, now)`; `dueDate = localISODate(p.dueDate)`. Bills: `daysUntil = calendarDaysBetween(startOfDay(now), parseLocalISODate(bill.nextDueDate))`, `amount = remainingForCycle(bill, billPayments)`.
- [ ] **Step 4: Run** full checks; green.
- [ ] **Step 5: Commit** `Collect loan and bill deadlines in one list`.

### Task 4: Module types and pure registry helpers

**Files:**
- Create: `src/core/modules/types.ts`, `src/core/modules/registry.ts`, `src/core/modules/registry.test.ts`

**Interfaces:**
- Consumes: `HomeLayout` (Task 2), `DeadlineCollector` (Task 3).
- Produces:

```ts
export type NavEntry = { path: string; label: string; description: string; icon: LucideIcon; group: 'main' | 'money' }
export type QuickAddAction = { id: string; label: string; icon: LucideIcon; Form: ComponentType<{ onClose: () => void; privateLoan?: boolean }> }
export type WidgetDef = { id: string; title: string; defaultPosition: number; Component: ComponentType }
export type ModuleDef = {
  id: string
  nav?: NavEntry[]
  quickAdd?: QuickAddAction[]
  contextAdd?: { path: string; actionId: string; privateLoan?: boolean }[]
  widgets?: WidgetDef[]
  deadlines?: DeadlineCollector
}
export function allWidgets(defs: ModuleDef[]): WidgetDef[]                 // sorted by defaultPosition
export function resolveHomeWidgets(defs: ModuleDef[], layout: HomeLayout): { widget: WidgetDef; hidden: boolean }[]
export function quickAddTarget(pathname: string, defs: ModuleDef[]): { action: QuickAddAction; privateLoan: boolean } | 'menu'
export function quickAddActions(defs: ModuleDef[]): QuickAddAction[]      // in module order
export function navEntries(defs: ModuleDef[], group: NavEntry['group']): NavEntry[]
export function deadlineCollectors(defs: ModuleDef[]): DeadlineCollector[]
export function moveWidget(layout: HomeLayout, all: WidgetDef[], id: string, dir: -1 | 1): HomeLayout
export function toggleWidget(layout: HomeLayout, id: string): HomeLayout
```

- [ ] **Step 1: Write failing tests** with stub widgets `a(1) b(2) c(3)`:
  - empty layout → a, b, c, none hidden;
  - `order: ['c','a']` → `['c','a','b']` (b, unlisted, goes right after the last listed widget with a smaller defaultPosition, here a);
  - `order: ['b']` → `['a','b','c']` (a has no smaller listed widget, so it goes first);
  - `order: ['zzz','b']`, `hidden: ['zzz','c']` → `zzz` dropped; c marked hidden;
  - `moveWidget(empty, all, 'b', -1)` → order `['b','a','c']`; moving the first item up is a no-op;
  - `toggleWidget` adds then removes an id from `hidden`;
  - `quickAddTarget('/bills', defs)` → bill action; `'/private'` → loan action with `privateLoan: true`; `'/'`, `'/planner'`, `'/loan/x'` → `'menu'`.
- [ ] **Step 2: Run**; FAIL.
- [ ] **Step 3: Implement.** `resolveHomeWidgets`: start from `layout.order` filtered to known ids; then, taking unlisted widgets in `defaultPosition` order, insert each right after the last widget already in the list with a smaller `defaultPosition` (at the start if there is none).
- [ ] **Step 4: Run** full checks; green.
- [ ] **Step 5: Commit** `Add module definitions and registry helpers`.

### Task 5: Ollie's reminders cover bills

**Files:**
- Modify: `src/features/ollie/ollieTypes.ts`, `ollieUtils.ts`, `ollieMessages.ts`, `OllieMessage.tsx`, `OllieCompanion.tsx`, `ollieUtils.test.ts`, `ollieStates.test.ts` (if it builds situations)

**Interfaces:**
- Consumes: `Deadline` (Task 3), `parseLocalISODate` (Task 1).
- Produces: `OllieInput` gains `deadlines: Deadline[]` (all modules, already horizon-filtered by the caller to 366 days). The `overdue`/`due-today`/`upcoming` situations' `payments` and `relaxed.next` become `Deadline[]` / `Deadline | null`. `DuePayment` stays exported from `ollieTypes` only if still used by `duePaymentFor`'s return type.

- [ ] **Step 1: Update existing tests** to pass `deadlines: [...loanDeadlines(input, now)]` alongside loans, and add failing tests: a bill due today with no loans due → `kind: 'due-today'`, `payments[0].module === 'bills'`; an overdue bill plus an overdue loan → `overdue` with both, total = sum; an overdue *private* loan (absent from deadlines) → not `overdue`; relaxed `next` can be a bill.
- [ ] **Step 2: Run**; FAIL.
- [ ] **Step 3: Implement.** `selectOllieSituation` takes due items from `input.deadlines` (same windows: overdue, `daysUntil === 0`, `0 < daysUntil <= max(7, reminderDays)`), keys from `d.id`s. In `ollieMessages`, the name comes from `title` and the date from `parseLocalISODate(dueDate)`. In `OllieMessage`, single-item links navigate to `d.href` with the label `View loan`/`View bill` by `module`; list rows use `d.id` keys and `d.href`; the calendar link goes to `/planner?view=calendar`. `OllieCompanion` gets deadlines from `useDeadlines(366)` (Task 6). Until Task 6 lands, compute them inline with `collectDeadlines([loanDeadlines, billDeadlines], …)` from the stores, then switch to the hook in Task 6.
- [ ] **Step 4: Run** full checks; green.
- [ ] **Step 5: Commit** `Let Ollie remind you about bills, not just loans`.

### Task 6: Module definitions, Home widgets, Customize Home

**Files:**
- Create: `src/app/modules.ts`, `src/app/useDeadlines.ts`, `src/features/loans/module.tsx`, `src/features/bills/module.tsx`, `src/features/savings/module.tsx`, `src/features/planner/module.tsx` (What-if), `src/features/analytics/module.tsx`, `src/features/home/` (`DueSoonWidget.tsx`, `MoneySummaryWidget.tsx`, `HealthWidget.tsx`, `SavingsWidget.tsx`, `CustomizeHomeSheet.tsx`, `module.tsx`), `src/features/loans/LoansWidget.tsx`, `src/features/loans/QuickAddLoan.tsx`, `src/features/bills/QuickAddBill.tsx`, `src/features/savings/QuickAddGoal.tsx`
- Modify: `src/pages/Dashboard.tsx` (becomes: header row, Ollie hero, resolved widgets, "Customize Home" link), `src/components/SummaryHeader.tsx` (split; delete once both widgets exist)

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces: `MODULES: ModuleDef[]` (order: home, loans, bills, savings, whatIf, analytics), `useDeadlines(horizonDays: number): Deadline[]` (reads loan/bill stores, memoized on store arrays + local day). Widget ids and default positions: `due-soon` 10, `money-summary` 20, `health` 30, `savings` 40, `loans` 50. Nav entries (group `money`): Bills `/bills`, Savings `/savings`, What-if `/what-if` ("Try a new loan and see when payments go down"), Analytics `/analytics`. Quick-add order: Loan, Bill, Savings goal. Context adds: `/bills`→bill, `/savings`→goal, `/private`→loan with `privateLoan: true`.

- [ ] **Step 1: Write failing component-free tests** in `src/app/modules.test.ts`: widget ids are unique across `MODULES`; `navEntries(MODULES,'money')` labels equal `['Bills','Savings','What-if','Analytics']`; `quickAddActions(MODULES)` labels equal `['Loan','Bill','Savings goal']`; `deadlineCollectors(MODULES).length === 2`.
- [ ] **Step 2: Run**; FAIL.
- [ ] **Step 3: Implement** the module files and widgets. `MoneySummaryWidget` = SummaryHeader's "Left to pay" block + tiles, minus the "Next due…" line. `HealthWidget` = `HealthScoreCard`. `DueSoonWidget` = `useDeadlines(7)` rows (color dot, title, relative date or "N days late", amount) linking to `href`, plus "See all in Planner"; returns `null` when empty. `SavingsWidget` = non-archived goals: total saved of total target + the goal closest to its target; `null` with no goals. `LoansWidget` = Dashboard's "Your loans" heading, filters, sort, view toggle, tag filter, list and empty states, moved verbatim. `QuickAdd*` wrap the existing forms and store `add*` calls (`QuickAddLoan` sets `private: true` when `privateLoan`). `CustomizeHomeSheet` uses `Sheet`: one row per widget (title, ↑ ↓ buttons with `aria-label`s "Move <title> up/down", a show/hide switch), and "Reset to default". Dashboard renders `resolveHomeWidgets(MODULES, home)` minus hidden ones.
- [ ] **Step 4: Run** full checks; green. Manually: `npm run dev` on a fresh random port with seeded synthetic data; Home matches the spec sketch and Customize persists across reload.
- [ ] **Step 5: Commit** `Turn Home into widgets the owner can reorder and hide`.

### Task 7: Shell, nav, quick-add, bell

**Files:**
- Create: `src/app/AppShell.tsx`, `src/app/Sidebar.tsx`, `src/app/QuickAddSheet.tsx`, `src/app/NotificationBell.tsx`, `src/app/PageFallback.tsx`
- Modify: `src/App.tsx` (routes inside a layout route; lazy pages), `src/components/BottomNav.tsx`, `src/components/Sheet.tsx`, `src/pages/MorePage.tsx`, `src/pages/Dashboard.tsx` (header gets the bell), `src/main.tsx` only if imports move
- Test: `src/components/Sheet.test.tsx` only if a DOM environment is already available; otherwise Sheet behaviour is covered by Task 10 e2e (don't add jsdom for this).

**Interfaces:**
- Consumes: `MODULES`, `quickAddTarget`, `quickAddActions`, `navEntries`, `useDeadlines`, `useSettingsStore`.
- Produces: routes `/`, `/planner`, `/ollie`, `/more`, `/what-if`, `/analytics`, `/bills`, `/bills/:id`, `/savings`, `/savings/:id`, `/loan/:id`, `/settings`, `/whats-new`, `/private`; `/calendar` → `<Navigate to="/planner?view=calendar" replace />`; `*` → `/`. `Sheet` props unchanged.

- [ ] **Step 1: Implement `Sheet` accessibility.** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → title id; Escape calls `onClose`; on mount focus the close button and on unmount restore focus to `document.activeElement` captured at mount.
- [ ] **Step 2: Implement `AppShell`.** It renders what `App.tsx`'s `AppContent` renders today (ScrollToTop, Confetti, Toast, InstallPrompt, private-folder auto-lock effects), plus `<Sidebar/>` (`hidden lg:flex`, fixed left, `w-60` or `w-[72px]` when collapsed), `<main>` with `lg:pl-60`/`lg:pl-[72px]` holding `<Suspense fallback={<PageFallback/>}><Outlet/></Suspense>`, `<BottomNav/>` (`lg:hidden`), and `QuickAddSheet`. [+] handling: `quickAddTarget(location.pathname, MODULES)`; a direct action opens its `Form`, otherwise the menu lists `quickAddActions`. Close any open sheet on route change (keep today's render-time pattern from `App.tsx`). `PinScreen` stays outside the router as today.
- [ ] **Step 3: BottomNav** items Home `/`, Planner `/planner`, [+], Ollie `/ollie`, More `/more`; More stays lit on `/more`, `/bills`, `/savings`, `/what-if`, `/analytics`, `/settings`, `/whats-new`, `/private`; still hidden on detail pages; `<nav aria-label="Main">`.
- [ ] **Step 4: Sidebar** = logo + `NotificationBell`, "+ Add" button (same handler as [+]), main group (Home, Planner, Ollie), "Money" group from `navEntries(MODULES,'money')`, a divider, private folder (label via `folderLabel`), Settings, and a collapse toggle (`setSidebarCollapsed`). Collapsed shows icons with `title` + `aria-label`. Active item `aria-current="page"`, teal pill as in BottomNav.
- [ ] **Step 5: NotificationBell** = button with badge count (`overdue + today` from `useDeadlines(7)`; no badge at 0; `aria-label` "Reminders, N due"), opening a `Sheet` titled "Reminders" that lists `useDeadlines(7)` like DueSoonWidget, with an empty state ("Nothing due this week"). Put it in Home's header row (replacing nothing; settings ⚙ stays) and in the Sidebar.
- [ ] **Step 6: MorePage** lists `navEntries(MODULES,'money')`, then the private folder row (existing copy), then Settings.
- [ ] **Step 7: Lazy routes.** Every page except Dashboard via `React.lazy`.
- [ ] **Step 8: Run** full checks + build; green. Manually check at 390px and 1280px widths on a fresh port.
- [ ] **Step 9: Commit** `Add the app shell: new nav, desktop sidebar, quick-add menu and reminders bell`.

### Task 8: Planner (agenda + calendar) and What-if rename

**Files:**
- Create: `src/features/agenda/agenda.ts`, `src/features/agenda/agenda.test.ts`, `src/pages/PlannerPage.tsx` (new), `src/features/calendar/CalendarView.tsx`
- Rename: `src/pages/PlannerPage.tsx` → `src/pages/WhatIfPage.tsx` (title "What-if"); `src/pages/CalendarPage.tsx` → its body moves into `CalendarView` (no `PageHeader`); delete `CalendarPage.tsx`

**Interfaces:**
- Consumes: `Deadline`, `useDeadlines(30)`.
- Produces: `type AgendaGroup = { key: 'overdue' | 'today' | 'week' | 'later'; label: string; items: Deadline[] }`, `groupAgenda(deadlines: Deadline[]): AgendaGroup[]` (labels "Overdue", "Today", "This week" = 1–7 days, "Later" = 8+; empty groups omitted, input order kept).

- [ ] **Step 1: Write failing tests** for `groupAgenda`: mixed input → groups in order overdue/today/week/later with the right items; a day-7 item lands in "This week", day 8 in "Later"; `[]` → `[]`.
- [ ] **Step 2: Run**; FAIL.
- [ ] **Step 3: Implement** `groupAgenda` and the page: `PageHeader title="Planner"`, a two-button segmented control (`role="tablist"`) Agenda | Calendar driven by `useSearchParams` `view` (`calendar` or default agenda); agenda renders groups with rows like DueSoonWidget; empty state uses `EmptyState` with "Nothing due in the next 30 days".
- [ ] **Step 4: Run** full checks; green.
- [ ] **Step 5: Commit** `Add the Planner agenda and rename the loan planner to What-if`.

### Task 9: Ollie page, and the rename in Ollie's instructions

**Files:**
- Create: `src/features/askOllie/AskOllieChat.tsx`, `src/pages/OlliePage.tsx`
- Modify: `src/features/askOllie/AskOllieSheet.tsx` (becomes `Sheet` + `AskOllieChat`), `src/pages/Dashboard.tsx` (chat button and hero `onAsk` → `navigate('/ollie')`), `api/ask.ts` (prompt text), `src/server/ask.test.ts` only if it asserts prompt text, `evals/ollie.eval.ts` (`has(/What-if/, 'points to What-if')`)

**Interfaces:**
- Produces: `AskOllieChat({ includePrivate }: { includePrivate: boolean })`, the chat body (messages, input, errors), keeping the existing `dashboardChat` memory when `includePrivate` is false.

- [ ] **Step 1: Extract** `AskOllieChat` from `AskOllieSheet` with no behaviour change; the private folder still opens the sheet. Run full checks; green.
- [ ] **Step 2: OlliePage** = `PageHeader title="Ollie"`, `OllieCompanion` (not hero) on top, then `AskOllieChat includePrivate={false}` filling the rest; the input sits above the bottom nav (`pb-28` like other pages; `lg:pb-6`).
- [ ] **Step 3: Update `api/ask.ts`.** The screen list becomes `(Home, Planner, Ollie, Bills, Savings, What-if, Analytics, Settings)`; the new-loan line becomes "Suggest they try it in What-if (under More), which works out the exact monthly payment and whether it fits."; the "QUICK READ"/"Planner" mention in the money-decisions bullet becomes "What-if". Update the eval check.
- [ ] **Step 4: Run** full checks; green.
- [ ] **Step 5: Commit** `Give Ollie its own page and point Ollie at What-if`.

### Task 10: Playwright smoke tests

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/shell.spec.ts`, `.github/workflows/e2e.yml`
- Modify: `package.json` (`"test:e2e": "playwright test"`, dev dep `@playwright/test`), `.gitignore` (`test-results/`, `playwright-report/`), `vite.config.ts`/vitest config so vitest ignores `tests/e2e/**`

**Interfaces:**
- Consumes: the running app via `webServer: { command: 'npx vite --port 47614 --strictPort', url: 'http://localhost:47614' }`, projects `phone` (390×844, `isMobile`, `hasTouch`) and `desktop` (1280×800), Chromium only, fresh storage per test.

- [ ] **Step 1: Write the specs:**
  - phone: bottom nav shows Home, Planner, Ollie, More and an "Add" button; sidebar hidden. desktop: sidebar visible with "Add", bottom nav hidden.
  - [+] on Home opens "Add" menu → "Loan" → fill name "Test Phone", amount 6000, months 6 → save → "Test Phone" visible on Home; Planner agenda lists "Test Phone" once its first due date is within 30 days (set start date to today).
  - on `#/bills`, [+] opens the "New Bill" form directly.
  - Customize Home: hide "Financial health", reload → hidden; reset → back.
  - `#/calendar` → URL contains `/planner?view=calendar` and the Calendar tab is selected; `#/what-if` shows the "What-if" heading.
  - Escape closes the quick-add sheet.
- [ ] **Step 2: Install and run:** `npm i -D @playwright/test`, `npx playwright install chromium`, `npm run test:e2e`; expected all pass (fix the app, not the test, on real failures).
- [ ] **Step 3: Workflow** `e2e.yml`: on `push` and `pull_request`; `actions/checkout@v4`, `actions/setup-node@v4` (node 22, npm cache), `npm ci`, `npx playwright install --with-deps chromium`, `npm run test:e2e`; upload `playwright-report` on failure. It must not deploy anything.
- [ ] **Step 4: Run** full checks + build; green.
- [ ] **Step 5: Commit** `Add Playwright smoke tests for the shell at phone and desktop sizes`.

### Task 11: Docs and release note

**Files:**
- Modify: `docs/PROGRESS.md`, `docs/ROADMAP.md` (status line), `CLAUDE.md` (layout section: `src/app`, `src/core/*`, module definitions, `npm run test:e2e`), `src/features/whatsNew/changelog.ts` (new top entry `1.14.0`, title "A new home for everything", highlights: new nav; [+] menu; Planner shows what's due across loans and bills; Ollie has its own page and now reminds you about bills; Customize Home; the loan planner is now called What-if; desktop sidebar).

- [ ] **Step 1:** Write the docs and the changelog entry.
- [ ] **Step 2: Run** `npx tsc -b && npm run verify && npm run build && npm run test:e2e`; all green.
- [ ] **Step 3: Commit** `Record Phase 1 shell progress and add the 1.14.0 release note`.
