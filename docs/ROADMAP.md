# Ollie — Roadmap to a Personal Life OS

Status: **Phase 1 done on branch `feature/phase-1-foundation`, 2026-11-26 (not merged).** Phase 2 next; see `PROGRESS.md`.
The owner approved every recommendation below on 2026-11-26.
Findings referenced as D#/S#/A# are in `ARCHITECTURE.md` §2.

Rules for every phase: the app stays usable after each merge; small branches;
`npm run verify` + `npm run build` green; no record is ever deleted by a
migration; nothing is deployed to production without the owner's say-so.

---

## Dependencies

| Package | Verdict | When | Why |
|---|---|---|---|
| TypeScript, Zustand, lucide-react, Vitest, React Router | **Keep** (already installed) | — | Already what the spec recommends |
| `zod` | **Add** | Phase 1 | Backup validation (D4), settings, later AI tool arguments |
| `date-fns` | **Add** | Phase 1 | Month-end-safe `addMonths` (D1), local-date helpers. Manila has no DST, so `Intl` handles the timezone; `@date-fns/tz` only if a non-Manila zone is ever needed |
| `dexie` + `fake-indexeddb` (dev) | **Add** | Phase 2 | IndexedDB with transactions, indexes, versioned schema; fake-indexeddb for Node tests |
| `vite-plugin-pwa` | **Add** | Phase 7 (or with Phase 2) | Precached, versioned service worker; replaces `public/sw.js` (A7) |
| `@playwright/test` (dev) | **Add** | Phase 1 | Responsive nav smoke tests; runs in GitHub Actions, *not* in the Vercel build |
| `recharts` | **Skip for now** | — | ~100 kB gzip; current CSS charts work. Revisit if Utilities/Analytics need real axes |

---

## Phases

Effort is in focused working sessions (about 2–4 hours each, with review).
These are rough figures; each phase gets its own spec and plan before code.

### Phase 1 — Foundation, shell, safety fixes (≈ 4–6 sessions)

*Proposed change to the spec's order:* do the high-severity data fixes here,
before the shell, because they protect the records every later phase depends on.

- **1a. Safety fixes**
  - D1: month-end-safe loan due dates. Future schedule only; stored payment
    records keep their historical `dueDate`.
  - D2/D3: restore always writes a safety backup first; "replace" really
    replaces every section; restore is all-or-nothing (stage then commit).
  - D4: zod schemas for every backed-up entity; invalid rows reported in
    the preview, not silently saved.
  - D6: one shared "monthly loan payments" calculator used everywhere.
- **1b. Core layer:** `core/money` (centavos helpers; used by new code
  only), `core/time` (local dates, Asia/Manila), `core/settings` (currency,
  timezone, enabled modules), `core/modules` registry. Existing features
  register themselves; nothing moves folders.
- **1c. App shell:** responsive layout: bottom nav on mobile, collapsible
  sidebar on desktop (≥1024px), quick-add menu (replaces the per-page
  add button), notification center stub, safe-area support, route-level
  `lazy()` splitting.
- **1d. Dashboard v2:** widgets from the registry, hide/reorder (saved in
  settings), only enabled modules, empty states, no fabricated data.
- **1e. Reminder engine (derived):** one engine collects deadlines from
  every module (loans + bills today) for the dashboard, calendar and
  notification center. User-created/snoozed reminders need durable storage →
  Phase 2.

### Phase 2 — Repositories, IndexedDB, Backup v2 (≈ 4–6 sessions)

- Repository interface; localStorage adapter first (no behaviour change, ship).
- Dexie schema + boot hydration step (A2).
- Migration exactly as in `ARCHITECTURE.md` §4: safety download →
  validate → quarantine → one transaction → verify counts and totals → switch
  → keep old keys → rollback button.
- Backup envelope v2 (`schemaVersion`, `appVersion`, `exportedAt`, per-module
  sections, SHA-256 checksum); preview; merge-or-replace; duplicate detection
  by ID + content hash; reads v0/v1 files.
- Durable `reminders` (snooze/dismiss/complete) and `activityLogs`.
- Clear "this is not cloud sync" copy; storage-persistence status in Settings.

### Phase 3 — Finance Hub (≈ 6–9 sessions)

Accounts with opening balances → transactions (income/expense/transfer,
categories, dedupe key) → loan payments linked to a cash transaction
(payment record stays the source for the loan; the transaction references it,
so nothing counts twice) → budgets → recurring bills/subscriptions folded into
the same recurring-schedule model → confirmed vs expected income → cash-flow
forecast (chronological, confirmed and expected scenarios, assumptions shown)
→ safe-to-spend and affordability → `docs/FORMULAS.md`. The existing single
"monthly income" becomes an expected-income schedule, migrated, not discarded.

### Phase 4 — Ollie Intelligence (≈ 5–8 sessions)

- Verify the configured Groq model's tool-calling support with a live
  call before designing around it (not assumed).
- Provider interface (chat, structured output, tools, errors, rate limits)
  with Groq as the only implementation; deterministic fallback when offline.
- Tool registry: zod-validated, allow-listed, max rounds, size caps.
  Read tools run within the AI data permissions; write tools return a
  proposal → preview card → confirm → revalidate → transaction → activity log.
- Context selection: send the tools' results, not the whole summary (fixes S3).
- Insight engine (extends `collectInsights`): typed, severity, related IDs,
  dedupe, auto-resolve.
- Daily briefing: deterministic first; optional AI rewrite cached until data changes.
- Memories table: proposed vs confirmed, review/edit/disable/delete UI.
- Companion state machine over the existing six expressions.
- Endpoint access control (decision 4) and AI permissions in Settings.

### Phase 5 — Household Hub + Project Hub (≈ 6–8 sessions)

Inventory, consumption logs, restock prediction (only from recorded usage,
with an "insufficient data" state), expiry, shopping lists, price history,
purchases → inventory + optional transaction. Projects with
planned/committed/actual costs, quotations and supplier comparison,
milestones, and expenses linked to transactions without double counting.

### Phase 6 — Tasks/Agenda, Goals & Habits, Utilities, Vault (≈ 8–12 sessions)

Tasks and events with recurrence (RRULE-lite, timezone-safe); goals
that reuse savings goals; habits with streaks; utility meters (resets,
gaps, irregular periods, labelled estimates); vault metadata and renewals.
Encrypted attachments only with WebCrypto AES-GCM + PBKDF2/Argon2-class key
derivation and a written recovery story, as a separate approval.

### Phase 7 — Offline, security, performance, a11y (≈ 3–5 sessions)

vite-plugin-pwa precache and update prompt; offline indicator; salted
PBKDF2 PIN hashes (upgrade on next unlock, S2); bundle budget; axe checks;
Playwright across phone/tablet/desktop; final docs (`SECURITY.md`,
`TESTING.md`, `DATA_MODEL.md`, `AI_TOOLS.md`, `MIGRATION.md`, `CHANGELOG.md`).

**Total: roughly 36–54 sessions.** Phases 1–4 (≈ 19–29) already deliver
most of the day-to-day value: safer data, the shell, real cash flow and an
assistant that can act.

---

## Files expected to change in Phase 1

New: `src/core/{money,time,settings,modules}/*`, `src/app/{AppShell,Sidebar,QuickAdd,NotificationCenter}.tsx`,
`src/features/*/module.ts` (one per existing feature), `src/features/backup/validate.ts`,
`tests/e2e/*.spec.ts`, `playwright.config.ts`, `CLAUDE.md`, `docs/PROGRESS.md`, `CHANGELOG.md`.

Changed: `src/App.tsx`, `src/main.tsx`, `src/components/BottomNav.tsx`, `src/pages/Dashboard.tsx`,
`src/pages/MorePage.tsx`, `src/features/loans/{loanUtils,loanStore}.ts`, `src/utils/{backup,dateUtils}.ts`,
`src/features/{bills,savings}/*Store.ts` (import paths only), `src/features/askOllie/summary.ts`,
`src/features/finance/financeUtils.ts`, `src/features/planner/*` (rename only, if decision 3 says so),
`src/pages/SettingsPage.tsx`, `package.json`, `.github/workflows/deploy.yml`.

Not touched in Phase 1: `api/ask.ts`, storage keys, the backup file format.

---

## Testing strategy

- **Calculators:** pure functions with an injected `now`; table-driven
  cases including month-end, leap year, Manila midnight, zero/negative inputs.
  Existing loan tests stay as the regression net for "preserve behaviour".
- **Golden fixtures:** synthetic localStorage snapshots and backup files
  (v0, v1, loan-only, malformed, private folder) under `tests/fixtures/`, used
  by migration, restore and round-trip tests. Never real records.
- **Repository contract tests:** one suite run against the localStorage,
  in-memory and Dexie (fake-indexeddb) adapters.
- **Migration verification:** counts plus centavo-exact totals, before vs
  after, with idempotent re-run and interrupted-run cases.
- **AI:** tool argument validation, allow-list rejection, prompt-injection
  fixtures (a record whose name says "ignore previous instructions"), approval
  flow, idempotency. `evals/` keeps running against the real model, opt-in.
- **E2E (Playwright):** smoke at 375 px / 768 px / 1280 px for nav, add a
  loan, mark paid, backup and restore. Runs in GitHub Actions; the Vercel
  build stays `verify && build`.
- **Gate per phase:** lint, `tsc -b`, vitest, build, e2e, a manual pass on a
  phone, and docs updated.

---

## Decisions needing the owner's approval (before Phase 1)

1. **Phase order:** do the data-safety fixes (1a) first, as proposed, or
   follow the spec's order exactly?
2. **Bottom nav:** the spec's *Home / Modules / Ollie / Planner / Settings*
   removes today's Calendar, Analytics and the centre Add button. Options:
   (a) spec as written, with Calendar inside Planner and Analytics inside
   Finance; (b) *Home / Planner / [+] / Ollie / More*, which keeps quick-add
   in the thumb zone. Recommended: (b).
3. **"Planner" name clash (A5):** rename today's loan calculator to
   **"What-if"** (and use "Planner" for tasks/agenda), or call the new
   feature "Agenda"?
4. **AI endpoint protection (S1):** (a) a passphrase you enter once per
   device, checked server-side against an env var (free, simple); (b) Vercel
   Deployment Protection (may need a paid plan, so check first); (c) keep as-is
   but require Upstash so the limiter is shared. Recommended: (a) + (c).
5. **D1 fix visibility:** loans that start on the 29th–31st will show
   corrected due dates (e.g. Feb 28 instead of Mar 3). Past payment records
   keep their stored dates. OK?
6. **Money format:** convert existing loan/bill/savings amounts to integer
   centavos during the Phase 2 migration (verified to the centavo), or leave
   legacy records as 2-dp numbers and use centavos only in new tables?
   Recommended: convert during Phase 2.
7. **GitHub Pages copy:** keep the public `/lendy/` build, freeze it, or
   retire it? Should pushes to `main` keep auto-deploying, or should
   production deploys need a manual step?
8. **Dependencies:** approve adding zod, date-fns, Playwright (Phase 1) and
   dexie (Phase 2)?
