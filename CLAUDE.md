# Ollie

A local-first personal finance app (loans, bills, savings) with the Ollie owl
companion and an AI chat, growing into a Personal Life OS. One owner, no
accounts; all records live in the browser.

Start with `docs/ARCHITECTURE.md` (current state, findings, target design),
`docs/ROADMAP.md` (phases, decisions) and `docs/PROGRESS.md` (where work stands).

## Commands

- `npm run dev` — Vite dev server
- `npm run verify` — eslint + vitest (the deploy gate on Vercel and GitHub Pages)
- `npm run build` — `tsc -b` + production build
- `npm run test:e2e` — Playwright: smoke tests at phone and desktop sizes (dev server, port 47614) and an offline test against the production build (port 47615); fresh storage each test
- `public/sw.js` has `__BUILD__`/`__PRECACHE__` placeholders that `build/precache.ts` fills in at build time; keep them
- `npm run eval:ollie` — Ask Ollie evals against the real Groq model (needs `GROQ_API_KEY`; opt-in, costs tokens)

Before calling a change done: `npx tsc -b && npm run verify && npm run build && npm run test:e2e`.

## Layout

- `src/app/` — the shell: `AppShell` (layout route), `Sidebar`, `QuickAddSheet`, `NotificationBell`, `DeadlinesProvider`, and `modules.ts`, **the list of every module**
- `src/core/` — shared building blocks that never import feature code (types only): `time/`, `money/`, `locale.ts`, `settings/` (layout prefs, key `loan-tracker-settings`), `deadlines/` (one due list + context), `modules/` (ModuleDef types, registry helpers), `validation/`
- `src/features/<feature>/` — one folder per module: types, store (Zustand), utils, schema (zod), components, tests, and `module.ts`
- **Adding a module:** write `features/<x>/module.ts` (nav entries, quick-add actions, Home widgets, deadline collector) and add it to `src/app/modules.ts`. Nav, More, [+], Home, Planner and the bell pick it up. Module files are `.ts` and import components from their own files.
- `src/pages/` — one file per route; `src/components/` — shared UI
- `src/features/storage/` — where the money data lives: the localStorage and IndexedDB (Dexie) backends, the one-time move, start-up loading (`bootstrap.ts`), the save queue (`persist.ts`), the Storage card
- `src/utils/backup.ts` — export / restore orchestration (talks to stores)
- `src/features/backup/` — schema version + migrations; the v2 backup file (`envelope.ts`: sections + SHA-256 check value; v0/v1 files still read); restore (`prepareRestore.ts` validates, `planMerge.ts` plans merge/replace, `RestorePreview.tsx` shows it, `restore.ts` writes/undoes)
- `api/ask.ts` — the Vercel function for Ask Ollie. **Must stay self-contained** (Vercel runs it unbundled; relative imports break production).

## Rules that protect the owner's data

- Saved data shape changes → bump `SCHEMA_VERSION` and add `MIGRATIONS[n]` in `src/features/backup/schema.ts`. Device storage and backup files share one migration chain.
- Never delete or overwrite storage keys outside a migration or a confirmed user action. Restores must keep the safety copy (`loan-tracker-pre-restore` on simple storage, `kv.safetyCopy` in the database).
- Data stores save only through `persist(change)` (`features/storage/persist.ts`), never `localStorage` directly. The flag `loan-tracker-storage` picks the storage; the move never writes the old keys.
- Database data changes shape through the same `MIGRATIONS` chain (`upgradeDexieData`); the Dexie schema version (`db.ts`) changes only for new tables or indexes.
- New record types get a zod schema; unknown fields are kept (`z.looseObject`) so newer files lose nothing.
- Tests use synthetic records only. Never paste or commit real financial data.
- When checking the app in a browser, use a fresh, random dev-server port and confirm its `localStorage` and IndexedDB are empty before seeding test data — other ports on this machine hold real data.

## Money and dates

- App code works in pesos as 2-dp JS numbers; round to centavos (`Math.round(x * 100) / 100`). The database stores integer centavos, converted only in `features/storage/centavos.ts`.
- **Monthly loan payments have one definition:** `monthlyLoanPayments()` in `loanUtils.ts` (the billed `monthlyPayment` of active, regular loans). Don't sum `monthlyPayment` by hand.
- Add months with `addMonthsClamped` (`src/core/time/months.ts`), never `Date#setMonth` (Jan 31 + 1 month must be Feb 28).
- Loans are flat-interest (PH model); formulas are documented in `docs/ARCHITECTURE.md` §1. Don't change them without a verified defect.
- "Tracked" = not archived and not private (`isTracked`). Private-folder loans stay out of totals, reminders, CSV and Ollie unless asked from inside the folder.
- What's due comes from `collectDeadlines` (loans + bills). Read it with `useDeadlines(days)`; don't recompute due dates in components.

## AI

- Ollie never does arithmetic: the browser builds every figure (`askOllie/summary.ts`); the model only words it.
- The Groq key exists only server-side (`GROQ_API_KEY`); never a `VITE_` variable.
- Ask Ollie is read-only today. Write actions (Phase 4) must be proposed → previewed → confirmed → revalidated → applied → logged.

## Releases

`src/features/whatsNew/changelog.ts` is the app's version and its changelog (top entry = current version). Add an entry for user-visible changes. `package.json`'s version is intentionally unused.

## Workflow

- Feature branches (`feature/...`), small commits, merge to `main`. Pushing `main` deploys to Vercel and GitHub Pages, so never push without the owner's go-ahead.
- Write the failing test first; watch it fail; then implement.
