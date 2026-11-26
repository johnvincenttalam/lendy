# Ollie — Architecture

Status: **Phase 0 audit, 2026-11-26.** Describes the app as it is today, the
problems found, and the target design for the Personal Life OS. Nothing here
has been implemented yet; see `ROADMAP.md` for the order of work.

---

## 1. What exists today

### Stack (verified from `package.json`)

| Concern | Today | Notes |
|---|---|---|
| UI | React 19, React Router 7 (`HashRouter`) | 13 routes, no code splitting |
| Language | TypeScript 5.9, `strict` | Already TS throughout; no JS to convert |
| State | Zustand 5, one store per feature | Stores read `localStorage` synchronously at import |
| Styling | Tailwind 4 + CSS variables in `src/index.css` | Light/dark/system theme already works |
| Icons | lucide-react | |
| Tests | Vitest 4: 18 files, 190 tests, all passing | Plus `evals/` that run real Groq calls (opt-in) |
| AI | `api/ask.ts` Vercel function → Groq `openai/gpt-oss-120b` | Key is server-side only |
| PWA | Hand-written `public/sw.js` (network-first, cache-on-fetch) | Manifest + install prompt |
| Deploy | **Two targets**: Vercel (with AI) and GitHub Pages `/lendy/` (no AI) | Both deploy on every push to `main` |
| CI gate | `npm run verify` (eslint + vitest) before build, on both targets | |

Baseline on 2026-11-26: lint clean, 190/190 tests pass, production build OK
(one JS chunk, 493 kB / 138 kB gzip).

### Folder layout

```
api/ask.ts                 Groq proxy: validation, origin check, rate limit (Upstash or memory)
src/main.tsx               Runs storage migrations first, then renders
src/App.tsx                Routes, global add-sheet, private-folder auto-lock
src/pages/                 One file per route (Dashboard, Calendar, Analytics, Planner, …)
src/components/            Shared UI (Sheet, Toast, BottomNav, EmptyState, …)
src/features/<feature>/    types + store + utils (+ tests) + feature components
  loans bills savings finance planner askOllie ollie backup
  notifications lock privateFolder theme whatsNew
src/utils/                 backup.ts (export/import all), dateUtils.ts
evals/                     Ask Ollie quality evals against the real model
art/ollie/                 1254px source artwork (not shipped)
public/assets/ollie/       384px WebP expressions (shipped)
```

The app is already feature-organised, which is most of what the spec's
"modular architecture" asks for. What's missing is a shared `core` layer:
storage access, money/date primitives, a module registry and events all live
inside individual features today.

### Functionality inventory

| Area | What works |
|---|---|
| Loans | Add/edit/delete/archive; flat ("add-on") interest PH model and installment mode; mark paid with undo; schedule with principal/interest split; off-schedule monthly detection + recalc; notes, tags, colours; CSV export; sort + list/grid |
| Bills | Recurring monthly bills; partial payments per cycle; undo; categories; monthly chart; archive |
| Savings | Goals with deposits/withdrawals log; confetti on reaching target; archive |
| Finance | Single monthly income figure; health score (debt load, cash flow, savings buffer, payment reliability) |
| Planner (loan what-if) | Try a new loan; see monthly payments step down as loans finish; fit against income |
| Calendar | Month view + half-month schedule of loan/bill due dates |
| Analytics | Debt payoff timeline, interest totals, breakdowns (hand-rolled CSS charts) |
| Ollie companion | 6 expressions (happy, thinking, upcoming, alert, celebrating, relaxed); deterministic situation picker (overdue → due today → upcoming → celebration → insight → greeting → relaxed); per-message dismissals; idle animations honour reduced motion |
| Ask Ollie | Chat over a deterministic text summary built in the browser; model only phrases it; history capped at 10 turns; read-only by design |
| Privacy | App PIN lock; private folder with its own PIN, hidden from totals/Ollie/CSV, auto-locks on leave/background |
| Backup | Versioned JSON export of everything (schema v1); restore with confirmation; migrations framework shared by storage and backup files; 30-day backup reminder; `navigator.storage.persist()` |
| Notifications | Opt-in browser notifications, loans only, on app open (known broken on Android; deferred by the owner) |
| Other | What's New changelog, install prompt, light/dark theme |

### Storage keys (all `localStorage`, all JSON or strings)

Data (versioned, in backups): `loan-tracker-loans`, `-payments`, `-income`,
`-bills`, `-bill-payments`, `-savings-goals`, `-savings-transactions`.

Settings/state (not in backups): `-schema-version`, `-last-backup`, `-sort`,
`-view`, `-pin-hash`, `-pin-enabled`, `-notif-*` (6 keys), `-ollie`,
`-theme`, `-seen-version`, `pwa-install-dismissed`.

Private folder (in backups as `privateFolder`): `-private-name`,
`-private-pin-hash`, `-private-recovery`.

### Current data model

```
Loan { id, name, color, tag?, notes?, totalAmount, monthlyPayment,
       interestRate (%/month, flat), durationMonths, startDate (YYYY-MM-DD),
       monthsPaid, totalPaid, totalInterestPaid,      ← denormalised counters
       createdAt, archived?, private? }
PaymentRecord { id, loanId, amount, principal, interest, paidAt, dueDate, month }
Bill { id, name, color, category, amount, nextDueDate, notes?, createdAt, archived? }
BillPaymentRecord { id, billId, amount, paidAt, dueDate }
SavingsGoal { id, name, color, targetAmount, currentAmount, notes?, createdAt, archived? }
SavingsTransaction { id, goalId, type: deposit|withdrawal, amount, note?, createdAt }
monthlyIncome: number
```

Money is stored as JS floats rounded to 2 dp. IDs are `crypto.randomUUID()`.

### Loan formulas (current behaviour, to be preserved)

Flat interest, Philippine lending model (`src/features/loans/loanUtils.ts`):

- total interest = principal × (rate/100) × months
- total cost = principal + total interest
- interest per month = total interest / months; principal per month = principal / months
- every scheduled payment = `monthlyPayment` (as entered), except the last,
  which absorbs the rounding: total cost − monthlyPayment × (months − 1)
- remaining balance = total cost − totalPaid (0 once monthsPaid ≥ months)
- due date of payment *i* = startDate + *i* months (see defect D1)

---

## 2. Findings

Severity: **High** = can lose or corrupt data, or costs money; **Medium** =
wrong numbers or a misleading promise; **Low** = cleanup.

### Data integrity

| # | Sev | Finding | Evidence |
|---|---|---|---|
| D1 | Medium | **Loan due dates skip months for start days 29–31.** `setMonth` overflows: a loan starting Jan 31 shows payment 2 due **Mar 3**, payment 4 due **May 1**. Bills already clamp correctly; loans don't. Affects schedule, overdue, calendar, reminders and Ollie. | Reproduced in Node: `2026-01-31 → 01-31, 03-03, 03-31, 05-01` (`loanUtils.paymentSchedule`, `loanStore.markAsPaid`, `dateUtils.addMonths`) |
| D2 | High | **Restore is not atomic and only partly "replace".** Loans/payments are always replaced, but bills and savings are kept if the file has no `bills`/`savingsGoals` field (old loan-only backups). The dialog says "This will replace your existing data". Each store writes its own keys one after another; a failure mid-way leaves a mix. | `utils/backup.ts importAllData`, `billStore.importBackup` early return |
| D3 | High | **No safety copy before restore.** A wrong file replaces everything with no way back. | `importAllData` |
| D4 | Medium | **Loan records in a backup are barely validated.** Bills/savings check `id`+`name`; loans only check that `loans` is an array. A malformed loan (missing `startDate`, string amounts) is saved as-is. | `loanStore.importBackup` |
| D5 | Medium | **Two sources of truth for loan progress.** `monthsPaid/totalPaid/totalInterestPaid` are counters updated alongside `PaymentRecord`s. Undo trusts the last record; edits recompute counters from the schedule. They can drift (e.g. after editing a loan with history). | `loanStore.updateLoan`, `undoMarkAsPaid` |
| D6 | Medium | **"Monthly loan payments" has two definitions.** Health score uses the scheduled figure (`scheduledMonthlyPayment`); Ask Ollie's summary, DTI and overdue totals use the hand-entered `monthlyPayment`. They disagree for off-schedule loans. | `financeUtils.buildOverview` vs `loanUtils.debtToIncomeRatio`, `askOllie/summary.ts` |
| D7 | Low | Writes to two keys (e.g. loans then payments) aren't transactional; a quota error between them leaves them inconsistent. | `saveLoans` + `savePayments` |
| D8 | Low | Local-date strings are sometimes made with `toISOString()` (UTC). Correct for start dates parsed as UTC, wrong for "today" between 00:00 and 07:59 Manila time (e.g. notification `lastChecked`). | `dateUtils.toISODate`, `useNotificationCheck` |
| D9 | Low | `debtPayoffTimeline` doesn't filter archived/private loans itself (callers must). | `loanUtils.ts` |

### Security and privacy

| # | Sev | Finding |
|---|---|---|
| S1 | High | **`/api/ask` is open to anyone who can script an `Origin` header.** The only cost control is 30 questions / 10 min per IP, and if Upstash isn't configured that counter lives in one function instance's memory. Rotating IPs means unbounded Groq spend. The spec explicitly says not to rely on CORS. |
| S2 | Medium | **PIN hashes are unsalted SHA-256 of a short numeric PIN.** Anyone with the device (or a backup file) can recover the PIN in milliseconds. All data is plaintext in `localStorage`. The lock is a privacy screen, not protection, and that should be documented, not oversold. It also rules out reusing the PIN for a future encrypted Vault. |
| S3 | Medium | **Each question sends the whole non-private summary to Groq** (every loan name, amount, bill and goal, up to 30 kB). Private-folder loans are excluded unless asked from inside the folder. No user-facing control or privacy notice. |
| S4 | Low | Backups contain private loans in plaintext plus the folder PIN hash. Fine for a personal file, but worth saying in the export UI. |
| S5 | OK | Groq key never reaches the browser (no `VITE_` secrets); Groq error text isn't forwarded; request bodies are shape- and size-checked; AI output is rendered as React text with no `innerHTML`; no secrets in git history (only test placeholders). |

### Architecture

| # | Finding |
|---|---|
| A1 | UI and stores call `localStorage` directly in 12 files. There is no repository layer, so moving to IndexedDB means touching every store. |
| A2 | Stores load synchronously at import time (`main.tsx` relies on import order). IndexedDB is async, so a move needs an explicit "hydrating" boot step. This is the biggest single structural change in the roadmap. |
| A3 | Cross-feature reads go store → store (`readSummaryInput`, `useFinancialOverview`, `exportAllData`). That's fine at this size, but each new module adds edges. A module registry with `exportData/importData/collectDeadlines/collectInsights` hooks keeps the edges in one place. |
| A4 | Ollie already has a deterministic insight + situation engine (`ollieUtils.collectInsights`, `selectOllieSituation`) and a mood map. These are the seeds of the spec's Insight Engine and Expression Engine. Extend them; don't replace them. |
| A5 | **Naming collision:** the existing "Planner" is a *loan what-if calculator*. The spec's "Life Planner" is tasks/calendar. One of them needs a different name. |
| A6 | Single 493 kB bundle with no route-level splitting. That's fine today; it will matter once 6+ modules land. |
| A7 | The service worker caches only what was fetched while online, so a first offline launch after a deploy can miss chunks. A precache (vite-plugin-pwa/workbox) fixes this properly. |
| A8 | Two deployments (Vercel + public GitHub Pages) both auto-deploy from `main`. The spec says production deploys need approval. |

---

## 3. Target architecture

Keep `src/features/` as the module folder (renaming 80 files to
`src/modules/` gains nothing and breaks every import). Add a thin `core`
layer under it and grow new modules beside the existing ones.

```
src/
  app/                    Shell: routes, layout (bottom nav / sidebar), providers, boot/hydration
  core/
    db/                   Dexie database, table defs, versioned migrations, legacy-localStorage importer
    repo/                 Repository<T> interface + Dexie and in-memory implementations
    money/                Money = integer centavos; parse/format (PHP default, configurable)
    time/                 Local-date helpers on date-fns (Asia/Manila default), month-end-safe addMonths
    modules/              Module registry: id, routes, nav entry, widgets, backup hooks,
                          deadline & insight collectors, AI tools
    events/               Typed domain events (in-memory bus) + durable `reminders`/`pendingActions` tables
    reminders/            Unified reminder engine (evaluate on start/resume/data change)
    backup/               Envelope v2: schemaVersion, appVersion, exportedAt, per-module data, checksum;
                          preview, merge/replace, pre-import safety copy, v0/v1 upgraders
    settings/             Typed settings (currency, timezone, AI permissions, enabled modules)
    activity/             Activity log
  features/               ← modules (existing + new), each: types, schema (zod), repo, store, utils, components, tests
    loans bills savings finance planner(→ "What-if") …existing
    accounts transactions budgets           Phase 3 (Finance Hub)
    household projects                      Phase 5
    tasks goals habits utilities vault      Phase 6
  intelligence/           Intent → context selection → tool registry (zod-validated, allow-listed)
                          → provider (Groq) → response validation → approval queue → executor
  companion/              Ollie expression state machine (wraps today's ollieStates/ollieUtils)
  components/             Shared UI (unchanged location)
api/ask.ts                Stays self-contained (Vercel loads it unbundled); gains tool-calling mode + access check
```

### Key design rules

1. **The browser owns the data.** The API function never sees storage. It
   gets only a minimal context or tool results and returns text or
   *proposed* tool calls.
2. **The model never does arithmetic.** Every figure comes from a tested
   deterministic function (today's rule, kept).
3. **Write tools only propose.** The client validates (zod), shows a
   preview, waits for a tap, re-reads the target records, applies the change
   in one Dexie transaction with an idempotency key, logs it to activity, and
   only then reports success.
4. **Money is integer centavos in all new tables.** Existing loan, bill and
   savings fields convert during the IndexedDB migration, with totals
   compared before and after (see §4).
5. **One definition per figure.** Shared calculators in `core`/`finance` are
   used by the UI, Ollie's summary, insights and AI tools alike (fixes D6).
6. **Modules plug in; they don't reach in.** Dashboard widgets, calendar
   deadlines, reminders, backup sections, insights and AI tools come from the
   registry, so disabling a module removes it everywhere.

### Domain events vs durable records

The in-memory event bus is for UI reactions only (Ollie celebrates, a toast,
insights recompute). Anything that must survive a reload, such as a reminder,
a pending AI action or a snoozed insight, is a row in a table with a status.

---

## 4. Storage migration plan (localStorage → IndexedDB)

**Why move at all:** localStorage is ~5 MB, synchronous, rewrites whole arrays
on every change, and can't hold attachments. Transactions, inventory logs,
meter readings and vault files will outgrow it. Loans, bills and savings alone
would be fine where they are.

**Approach: copy, verify, switch, never delete.**

1. **Repository layer first (no behaviour change).** Each store talks to a
   `Repository<T>`; the first implementation is the existing localStorage
   code. Ship and verify that before any new storage.
2. **Fixtures.** Synthetic localStorage snapshots for: empty, v0
   (pre-versioning), v1, loan-only legacy backup, malformed records,
   private folder, month-end start dates, about 5 MB of data.
3. **Safety copy.** Before the first migration, trigger a full backup file
   download (and keep a copy of the raw keys in an IndexedDB `legacySnapshot`
   table).
4. **Validate the source** with zod. Invalid records go to a
   `quarantine` table with the reason; they are not dropped and not imported
   half-parsed.
5. **Import in one Dexie transaction**, keeping existing IDs and converting
   money to centavos. Idempotent: keyed on record IDs plus a
   `migrations` row, so a rerun is a no-op.
6. **Verify:** record counts per entity; sums of loan principal, total paid,
   bill amounts, savings balances (to the centavo); every payment's
   `loanId` resolves. Any mismatch → stay on localStorage and show a support
   message with the diff.
7. **Switch** the repository adapter to Dexie and set
   `storageBackend = 'indexeddb'` in IndexedDB (not localStorage).
8. **Never delete** the old keys. Settings gets a "Storage" panel showing
   both backends and a **Roll back to device storage** button (re-points the
   adapter; data added since the switch is exported first).

Backups keep working throughout: the v2 envelope reader accepts v0/v1 files
and upgrades them through the existing `MIGRATIONS` chain.

### 4a. As built (Phase 2, piece 1, 2026-11-26)

Design: `docs/superpowers/specs/2026-11-26-storage-move-design.md`. Code:
`src/features/storage/` (a feature folder, not `core/`, because the move uses
the feature zod schemas).

- **Backends.** `DataBackend` (`readAll`, `write(change)`, `replaceAll`) with
  two implementations: `localStorageBackend` (today's JSON-per-key format) and
  `dexieBackend` (database `ollie` v1: one table per record type, `kv`,
  `quarantine`). Stores hold the data in memory, are filled once at start-up
  (`hydrate`), and save every change through `persist(change)`, an ordered
  queue. A failed save shows a lasting banner and keeps what's on screen.
- **Centavos at the edge.** The Dexie backend stores money as integers
  (`centavos.ts`); app code still sees pesos. Rows carry a hidden `_seq` so
  list order (and undo's "last payment") is exactly as before.
- **Choosing storage.** The flag `loan-tracker-storage` lives in simple
  storage (not in IndexedDB as §4 suggested), so it can be read without
  waiting on the database: `'indexeddb'`, `'localstorage'` (moved back) or
  missing (not moved yet). `bootstrap.ts` decides, moves, loads, and returns
  ready data, an error screen (database won't open in 5 s; never falls back to
  the old copy), or a recovery screen (database emptied by the browser).
- **The move** (`move.ts`): validate with zod → set aside what fails (the
  automatic move waits instead, and Settings lists the records with Move
  anyway / Copy them as text) → clear and fill the tables in one transaction
  → read back and compare counts, every amount to the centavo, totals and
  parent links → only then set the flag. No automatic backup download (§4
  step 3): the old keys are never written, so they are the safety copy. A
  failed move retries at most once a day. A fingerprint of the old keys shows
  when an older window wrote to them after the move.
- **Going back.** Settings → Storage → Move back copies the *current* data into
  simple storage (all or nothing) and switches; Move to the database runs the
  move again. Restore and undo work on either backend; the safety copy sits
  next to the data and moves with it.
- **Data versions.** Database data is upgraded through the same `MIGRATIONS`
  chain at start-up (`upgradeDexieData`); `migrateStorage` no longer touches
  the old keys once moved.
