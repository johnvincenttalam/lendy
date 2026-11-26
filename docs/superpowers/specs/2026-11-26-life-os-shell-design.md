# Life OS shell: Phase 1b–1e design

Date: 2026-11-26 · Roadmap: `docs/ROADMAP.md` Phase 1 · Branch: `feature/phase-1-foundation`

## Intent

Ollie is becoming a Personal Life OS. Before any new module (Finance Hub,
Household, Projects…) arrives, the app needs a frame those modules plug into:
navigation, an add button, a Home screen and a list of what's due, all fed by
the modules themselves rather than hand-edited per screen. It has to feel like
the same Ollie, and nothing that works today may get harder to reach. Phase 1a
(data-safety fixes) is done; this covers 1b–1e.

## Goals

1. One page frame (shell) around every route: bottom nav on phones and
   tablets, a collapsible sidebar on desktop (≥1024px).
2. Mobile nav **Home / Planner / [+] / Ollie / More** (owner's choice).
3. [+] opens a quick-add menu; on a module's own page it still opens that
   module's form directly, as today.
4. The loan what-if calculator is renamed **What-if** (route `/what-if`);
   **Planner** becomes the agenda + calendar.
5. Home is a list of widgets the owner can **reorder and hide**. The loan
   list stays on Home as one of those widgets (owner chose option A).
6. One derived list of **deadlines** (loans + bills) feeds Home's "Due soon",
   the Planner agenda, a notification-center bell **and Ollie's due reminders**
   (owner's decision: Ollie mentions bills too, so it never contradicts Due soon).
7. A **module registry**: each feature declares its nav entries, quick-add
   actions, Home widgets and deadline collector once.
8. Shared **settings** in `core` (Home layout, sidebar state); currency/locale/time zone are fixed defaults in `core` until there's a screen to change them.
9. Route-level code splitting; Playwright smoke tests at phone and desktop widths.

## Non-goals (this phase)

- Turning modules on/off (arrives in Phase 5, with the first optional new modules).
- Snooze/dismiss/complete on reminders, user-created reminders (need durable storage → Phase 2).
- Changing browser notifications (deferred by the owner).
- Ollie's expression engine, bills in Ollie's celebrations or money tips, a desktop assistant side panel, global search,
  breadcrumbs, keyboard shortcuts (later phases).
- Showing bills in the calendar month grid (stays loans-only for now).
- Integer-centavo money helpers (Phase 2, when there's data to use them).

## Anti-goals

- The loan list becoming harder to reach than today.
- A visual redesign: the shell reuses the existing tokens, cards, fonts and
  Ollie artwork. It should look like the current app with a new frame.
- Home showing invented or placeholder figures.
- Any change to stored data shapes (no `SCHEMA_VERSION` bump in this phase).

## Constraints

- HashRouter stays (GitHub Pages copy). Old links must still land somewhere sensible.
- `api/ask.ts` stays self-contained. Its prompt names screens, so it gets a
  text-only update for the rename (see "Renames").
- Private-folder rules unchanged: private loans never appear on Home, in
  deadlines, the bell or the agenda.
- Works offline as today; no new runtime dependencies except what's listed under Dependencies.

## Approaches considered

1. **Layout route + static module registry (chosen).** A parent
   `<Route element={<AppShell/>}>` renders the nav and an `<Outlet/>`. Each
   feature exports a definition from `features/<f>/module.ts(x)`, and
   `src/app/modules.ts` lists them in order. Every frame part (nav, More,
   quick-add, Home, Planner, bell) reads the list.
2. **Swap the nav components only.** Cheapest now, but each future module
   would mean hand-editing five screens, which is the cost this phase exists to remove.
3. **Runtime self-registration** (`register()` calls on import). No gain in
   a single bundle; it depends on import order, which already bit this app once (`main.tsx`).

## Layout

### Phone and tablet (<1024px)

```
┌──────────────────────────────┐   Header row on Home: Ollie logo · 🔔(2) · ⚙
│ Ollie              🔔2   ⚙   │
│ ┌──────────────────────────┐ │   1 Ollie hero (fixed first, not hideable)
│ │ 🦉 "Water bill due today" │ │
│ └──────────────────────────┘ │   2 Due soon      (deadlines, next 7 days + overdue)
│ Due soon                     │   3 Money summary (left to pay + stat tiles)
│  ● Water        today  ₱500  │   4 Financial health
│  ● Laptop       Dec 3  ₱1,000│   5 Savings       (hidden when there are no goals)
│ Left to pay ₱11,000          │   6 Your loans    (full list, filters, sort, view)
│ [Monthly][Debt-free][…]      │
│ Financial health 73          │   "Customize Home" link at the very bottom
│ Savings  ₱2,000 of ₱10,000   │
│ Your loans  [All][Active]…   │
│  ▢ Laptop …                  │
│        Customize Home        │
├──────────────────────────────┤
│ Home  Planner  (+)  Ollie  More │
└──────────────────────────────┘
```

Detail pages (`/loan/:id`, `/bills/:id`, `/savings/:id`) keep hiding the
bottom nav, as today.

### Quick-add ([+])

```
On Home, Planner, Ollie, More, Analytics…     On /bills → Bill form directly
┌──────────────────────────────┐              On /savings → Goal form directly
│ Add                        ✕ │              On /private → Loan form, saved private
│  💳  Loan                     │
│  🧾  Bill                     │              (today's behaviour, kept)
│  🐷  Savings goal             │
└──────────────────────────────┘
```

From Home, adding a loan becomes two taps ([+] → Loan) instead of one. That's
the price of a shared add button; Loan is always first in the menu.

### Planner

```
┌──────────────────────────────┐
│ Planner                      │
│ [ Agenda | Calendar ]        │   Agenda (default):
│ Overdue                      │    Overdue · Today · This week · Later (30 days)
│  ● Phone   3 days late ₱900  │    each row → the loan or bill
│ Today                        │   Calendar: today's CalendarPage content, unchanged
│  ● Water           ₱500      │
│ This week                    │   Empty: "Nothing due in the next 30 days" + Ollie relaxed
│  ● Laptop    Thu   ₱1,000    │
└──────────────────────────────┘
```

### Ollie

```
┌──────────────────────────────┐
│ Ollie                        │   Ollie's current message (same situation picker as Home)
│ 🦉 "Nothing's overdue…"       │   then the chat (today's AskOllieSheet body, as a page),
│ ─────────────────────────── │   keeping the conversation in memory as Home's chat does now.
│ You: can I afford a new loan?│   GitHub Pages copy: the chat area shows the existing
│ Ollie: I'd hold off…         │   "only works on the Vercel version" message.
│ [ Ask Ollie…           ➤ ]  │
└──────────────────────────────┘
```

Home's chat button and the "Ask" link on Ollie's hero go to `/ollie`. The
private folder keeps its own sheet (it's the only place private loans may be asked about).

### Desktop (≥1024px)

```
┌────────────┬──────────────────────────────────────┐
│ 🦉 Ollie    │                                      │
│ [+ Add]    │         page content, centred,        │
│ ⌂ Home     │         same max width as today       │
│ ▦ Planner  │                                      │
│ 💬 Ollie    │                                      │
│ MONEY      │                                      │
│ 🧾 Bills    │                                      │
│ 🐷 Savings  │                                      │
│ 🧮 What-if  │                                      │
│ 📊 Analytics│                                      │
│ ─────────  │                                      │
│ 🔒 Folder   │                                      │
│ ⚙ Settings │                                      │
│ «  collapse│                                      │
└────────────┴──────────────────────────────────────┘
```

Collapsed, the sidebar shows icons only (72px) with labels as tooltips and
`aria-label`s; the state is remembered. There's no bottom nav on desktop. The bell sits
at the top of the sidebar next to the logo.

### More (phones)

Built from the registry's nav entries plus the private folder and Settings,
in this order: Bills, Savings, What-if, Analytics, [private folder], Settings.

## The parts

### `src/core/settings`
Zustand store persisted to `localStorage` key `loan-tracker-settings` (JSON),
read through a zod schema with defaults so a damaged value falls back safely:
`{ home: { order: string[], hidden: string[] }, sidebarCollapsed: boolean }`.
Not part of backups yet (Backup v2 in Phase 2 adds settings).
`core/locale.ts` holds the fixed defaults (`CURRENCY = 'PHP'`, `LOCALE = 'en-PH'`)
and `formatCurrency` moves to `core/money/format.ts` using them; `loanUtils`
re-exports it, so no call site changes. No settings screen for these yet.

**Dates stay device-local**, exactly like every existing date function
(`duePaymentFor`, `localISODate`, `isBillOverdue`). The owner's device is in
Manila; real time-zone math arrives with recurring schedules (Phase 6). Tests
that depend on midnight pin the test time zone to `Asia/Manila`.

### `src/core/modules`
```ts
type ModuleDef = {
  id: string                       // 'loans' | 'bills' | 'savings' | 'whatIf' | 'analytics'
  nav?: NavEntry[]                 // { path, label, icon, description, group: 'main' | 'money' }
  quickAdd?: QuickAddAction[]      // { id, label, icon, Form: ComponentType<{ onClose(): void }> }
  contextAdd?: { path: string; actionId: string }[]  // [+] on this path opens this action directly
  widgets?: WidgetDef[]            // { id, title, Component, defaultPosition }
  deadlines?: (input: DeadlineInput, now: Date) => Deadline[]
}
```
Pure helpers (unit-tested): `resolveHomeWidgets(defs, settings.home)` applies
order and hidden, appends new widgets at their default position, and drops ids
that no longer exist. `quickAddTarget(pathname, defs)` returns a direct action or `'menu'`.
`navEntries(defs, group)`.

### `src/core/deadlines` (Phase 1e)
```ts
type Deadline = {
  id: string            // `${module}:${recordId}:${dueDate}`, stable for React keys and later snoozing
  module: string; recordId: string; title: string; color: string
  amount: number        // what's owed now (loans sum missed instalments; bills = remaining for the cycle)
  installments: number  // instalments `amount` covers (>1 only for a loan that's behind; bills always 1)
  daysUntil: number     // calendar days from today; negative when overdue
  dueDate: string       // local YYYY-MM-DD
  status: 'overdue' | 'today' | 'upcoming'
  href: string          // '/loan/:id' | '/bills/:id'
}
collectDeadlines(defs, input, now, horizonDays): Deadline[]  // sorted: overdue first (oldest first), then by date
```
Loans reuse `duePaymentFor` (tracked loans only, so archived and private are
excluded). Bills use `nextDueDate`, `isBillOverdue` and `remainingForCycle`,
skipping archived bills. Consumers: Due soon (7 days), Planner agenda (30
days), and the bell (badge = overdue + today; the panel lists the 7-day set).
On phones the bell sits in Home's header only; the Planner tab, reachable from
every screen, shows the same list in full. On desktop it's at the top of the sidebar.
It's derived, with no stored state, so it's always in sync with the data.

### Ollie's due reminders use deadlines
`selectOllieSituation`'s `overdue`, `due-today` and `upcoming` situations
are built from `collectDeadlines` instead of loans-only `duePaymentFor`, so
bills count. Their `payments` become `Deadline[]` (name = `title`, link =
`href`). The message templates keep their wording: they only use name,
amount, date, `installments` and `daysUntil`, and bills always have one
instalment. The message link reads "View" (or "View bill"/"View loan" by
`module`) instead of always "View loan". Dismissal keys keep their shape
(ids + dates), so a bill becoming due brings Ollie back. Celebrations,
insights, greeting and relaxed stay loans-only. `ollieUtils`/`ollieMessages`
tests are updated, and new cases cover a bill due today, an overdue bill
alongside an overdue loan, and the order (overdue before today before upcoming).

### Shell (`src/app/`)
`AppShell` (layout route) renders `Sidebar` (lg+) or `BottomNav`, the
`QuickAdd` sheet, and `<Outlet/>` inside `<main>`. The global pieces now in
`App.tsx` (toasts, confetti, install prompt, private-folder auto-lock, PIN
screen, scroll-to-top) move into the shell unchanged. Pages other than Home
load with `React.lazy`, using a light skeleton as the Suspense fallback.

### Home widgets
`SummaryHeader` splits into `MoneySummaryWidget` (left to pay + tiles) and
`HealthWidget`. Its "Next due…" line is retired in favour of Due soon. New
`DueSoonWidget` and `SavingsWidget` (total saved of total target, plus the
closest goal's progress). The loan list (filters, sort, view, tag filter,
empty states) moves into `LoansWidget` unchanged. A widget whose module has
nothing to show returns `null` (except Loans, which keeps its "add your first
loan" empty state). "Customize Home" opens a sheet listing widgets with ↑/↓
buttons and a show/hide switch, plus "Reset to default". No drag-and-drop dependency.

### Renames and old links
`/planner` → Planner (agenda). `/what-if` → today's PlannerPage. `/calendar`
→ redirect to `/planner?view=calendar`. In `api/ask.ts` the screen list
becomes "Home, Planner, Ollie, Bills, Savings, What-if, Analytics, Settings"
and the new-loan advice points to "What-if (under More)". The eval check
`/Planner/` becomes `/What-if/`. Past What's New entries stay as written.

### Accessibility
`<nav aria-label="Main">` for each nav, with `aria-current` on the active
item. `Sheet` gains Escape-to-close, moves focus into the sheet on open and
back to the trigger on close, and gets `role="dialog"` + `aria-modal`.
Focus-visible rings on nav and menu items. Reduced-motion handling as today.

## Dependencies
`@playwright/test` (dev). Nothing else new.

## Testing
- Unit: `resolveHomeWidgets` (order, hidden, new and removed ids, reset),
  `quickAddTarget`, `collectDeadlines` (loans + bills, private and archived
  excluded, overdue summing, statuses at Manila midnight, sort order,
  horizon), settings schema fallback.
- Existing 222 tests stay green. Moved code keeps its tests.
- Playwright (`tests/e2e/`), Chromium only, at 390×844 and 1280×800 on a fresh
  storage state: nav shows the right chrome per width; [+] on Home opens the
  menu and adds a loan, which then appears in the Home list and the Planner
  agenda; [+] on `/bills` opens the bill form directly; Customize Home hides
  and reorders a widget and survives a reload; `#/calendar` lands on the
  Planner calendar. Runs via `npm run test:e2e` and a new GitHub Actions
  workflow on push/PR. The Vercel build gate stays `verify && build`.
- Manual: a real phone pass (safe areas, thumb reach) before merging.

## Left to the builder
Component file names inside `src/app/`; skeleton look; exact wording of empty
states and menu descriptions (in the app's existing voice); icon choices from
lucide; how `Planner` reads `?view=`; splitting the work into commits.

## Calls made without the owner (flag if wrong)
- Loan first in the [+] menu; context shortcuts kept on /bills, /savings, /private.
- Ollie hero always first on Home and can't be hidden.
- Empty widgets hide themselves instead of showing an empty card.
- Analytics moves from a tab into More and the sidebar.
- Bell = overdue + due today; no read/unread state until Phase 2. Phones: Home header only.
- Ollie's "relaxed" message ("next payment is…") still names the next loan only; it's a calm note, not a reminder.
- Dates stay device-local; currency/locale/time zone are fixed defaults, no settings screen yet.
