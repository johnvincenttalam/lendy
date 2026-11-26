# Storage move (Phase 2, piece 1): IndexedDB, centavos, start-up loading

Date: 2026-11-26 · Roadmap: `docs/ROADMAP.md` Phase 2 · Branch: `feature/phase-2-storage`
Pieces 2 (Backup v2) and 3 (snooze/dismiss + activity log) get their own designs after this lands.

## Intent

Phase 3 brings everyday transactions; Phases 5–6 bring inventory logs, meter
readings and attachments. The browser's simple key-value storage (about 5 MB,
rewritten whole on every change) won't hold that. The browser's own database
(IndexedDB) will, and supports transactions and indexes. Moving now, while the
data is just loans, bills and savings, is the safest moment. The owner must
never lose a record, and should barely notice the move.

## Owner's decisions

- **The move is automatic** (option A): the next time the app opens, it copies,
  checks, then switches. If the check fails it stays on the old storage and says
  so. The old data is never deleted. Settings offers a way back.
- Amounts are stored as **whole centavos** (approved in the Phase 0 roadmap).
- The database library is **Dexie** (approved in the roadmap).

## Goals

1. All money data (the seven backed-up fields in `STORAGE_FIELDS`: loans,
   payments, monthlyIncome, bills, billPayments, savingsGoals,
   savingsTransactions) lives in IndexedDB as the source of truth.
2. A one-time automatic move: copy → validate → write in one transaction →
   verify → switch. Old keys are untouched.
3. Integer centavos for every amount stored in the database. App code keeps
   working in pesos.
4. The app loads its data once at start-up before the first screen, with a
   clear screen if storage can't be opened.
5. Settings gets a **Storage** card: where data lives, since when, whether the
   browser has promised to keep it, how much space is used, a plain "this isn't
   cloud sync" note, and **Move back to simple storage** (and **Move to the
   database** if the owner went back).
6. Restore and undo-restore keep working on either storage, with the same
   safety guarantees as Phase 1a.

## Non-goals

- Integer-centavo *arithmetic* in calculations (Phase 3's finance engine).
- Backup file format v2, merge mode, duplicate detection (piece 2).
- Snooze/dismiss, activity log (piece 3).
- Moving preferences (theme, PIN, notification settings, Ollie's memory, layout
  settings, private-folder name/PIN, last-backup date). They stay in
  localStorage: they're tiny and needed before data loads.
- Live sync between two open tabs (behaviour stays as today: each tab works on
  what it loaded; the diff-based writes below make clobbering less likely, not impossible).

## Anti-goals

- Any record lost, changed by more than rounding to the centavo, or detached from its parent.
- Silently showing stale data: once on the database, the app never quietly
  falls back to the old copy.
- A noticeable start-up delay, or a different-looking app.

## Approaches considered

1. **Database as source of truth; Zustand stores as the in-memory copy, loaded
   once at start-up; every change saved right after it's made (chosen).** Screens
   and store APIs barely change.
2. **Screens read the database directly (live queries).** Every component goes
   async: a rewrite of nearly every screen for no visible gain.
3. **Leave existing data in localStorage; use IndexedDB only for new tables.**
   No move now, but two storage systems: backups, totals and Phase 3's
   loan ↔ transaction links span both.

Centavos: convert at the storage boundary (chosen) rather than rewriting the
loan maths now. The loan formulas are tested and must not change.

## Design

### Backends
```ts
type DataSnapshot = {           // pesos, exactly today's shapes
  loans: Loan[]; payments: PaymentRecord[]; monthlyIncome: number
  bills: Bill[]; billPayments: BillPaymentRecord[]
  savingsGoals: SavingsGoal[]; savingsTransactions: SavingsTransaction[]
}
type Field = keyof DataSnapshot
type Change = { [F in Field]?: { next: DataSnapshot[F]; prev: DataSnapshot[F] } }

interface DataBackend {
  kind: 'localstorage' | 'indexeddb'
  readAll(): Promise<DataSnapshot>
  /** One atomic write for several fields; arrays are diffed by id and object identity. */
  write(change: Change): Promise<void>
  /** Atomic full replace (restore, undo, rollback). */
  replaceAll(snapshot: DataSnapshot): Promise<void>
}
```
- `localStorageBackend`: today's behaviour (JSON per key), wrapped. Its
  `write` writes the changed keys; `replaceAll` keeps Phase 1a's
  write-everything-or-put-it-back logic.
- `dexieBackend`: database `ollie`, version 1, tables `loans`, `payments`
  (index `loanId`), `bills`, `billPayments` (index `billId`), `savingsGoals`,
  `savingsTransactions` (index `goalId`), every record table also indexed on
  `_seq`; `kv` (key/value: `monthlyIncome`, `migration` report, `schemaVersion`,
  `safetyCopy`), `quarantine` (records that failed
  validation, with field, reason and the raw value). Each array `write` puts the
  records whose object identity changed (stores already make new objects only
  for changed records) and deletes ids that disappeared, all in one Dexie
  transaction over the touched tables. Unknown record fields are kept
  (rows are stored as-is apart from the money conversion).

### Money conversion (dexie backend only)
`toCentavos(p) = Math.round(p * 100)`, `fromCentavos(c) = c / 100`, applied to:
Loan `totalAmount, monthlyPayment, totalPaid, totalInterestPaid`; Payment
`amount, principal, interest`; Bill `amount`; BillPayment `amount`;
SavingsGoal `targetAmount, currentAmount`; SavingsTransaction `amount`;
`monthlyIncome`. `interestRate` stays a percent. A stored value with finer than
centavo precision is rounded; the migration report counts such values.

### Which backend (start-up)
A localStorage key `loan-tracker-storage` holds `'indexeddb'`,
`'localstorage'` (the owner chose to go back) or nothing (not moved yet). It's
read synchronously, so the choice never depends on the database opening.

```
main.tsx: run localStorage schema migrations (as today)
→ flag 'indexeddb'  → open Dexie (5 s timeout) → readAll → hydrate → render
                      open fails → StorageErrorScreen (Retry; "Close other Ollie
                      tabs"; never falls back to the old copy)
→ flag missing      → IndexedDB available? → runMove() → ok: flag 'indexeddb',
                      hydrate from Dexie, one toast "Moved your data to sturdier
                      storage. Your old copy is kept."
                      → failed: stay on localStorage, save the report, show
                      a notice in Settings' Storage card; retry at most once a day
→ flag 'localstorage' or no IndexedDB → localStorage backend
```
Before hydration, `main.tsx` doesn't render the app; the page shows its
existing background (data loads in tens of milliseconds). Stores start empty
and gain `hydrate(snapshot)`. Module-load reads go away: the loan store's
payment backfill moves into the move/hydrate step, and `main.tsx`'s
`hasData` check runs after hydration.

### The move (`runMove`)
1. Read the seven localStorage keys (after the existing schema migrations).
2. Validate each record with the Phase 1a zod schemas (`loanSchema` etc.);
   backfill payments for loans without records (as the loan store does
   today). Invalid records go to `quarantine`, not into the tables. Orphans
   (a payment whose loan was quarantined) also go to `quarantine`.
3. Write everything in **one** Dexie transaction (`bulkPut`, same ids). If
   the tables already hold rows (an interrupted earlier move, or a second tab),
   `bulkPut` overwrites by id, so the move is idempotent.
4. Verify by reading back: per field, count in tables + count quarantined =
   count in source; every record's money fields equal the source rounded to the
   centavo; sums per money field equal to the centavo; every payment's
   `loanId` / billPayment's `billId` / transaction's `goalId` exists.
5. Pass → set the flag to `'indexeddb'`, save the report (counts, quarantined,
   rounded values, timestamp, a fingerprint of the old keys) in `kv`. Fail →
   leave the flag unset, save the report with the first mismatch, keep using localStorage.
Old keys are never touched.

**Nothing visible may silently disappear.** Today's stores show every record
without checking it, so a record that fails validation is one the owner can
see now. The *automatic* move therefore runs only when nothing would be
quarantined. Otherwise it stays on localStorage, and the Storage card says
"N records need a look before Ollie can move your data", lists them (name,
field, reason), and offers **Move anyway** (they're kept aside in `quarantine`
and in the untouched old copy) plus **Copy them as text**.

**Order is kept.** IndexedDB returns rows by id (random UUIDs), but the app
depends on array order (undo removes the last payment; lists show records in
the order they were added). Every row gets a hidden integer `_seq`: the move
assigns the array position; a new record gets `max + 1`; changed records keep
theirs. Each table has an index on `_seq`; `readAll` sorts by it and strips it.

**Old windows.** A window opened before the move (or still running older
code) can keep writing to the old copy. Changes made there aren't shown after the move.
At start-up, if the old keys no longer match the fingerprint saved at move time,
the Storage card says so and offers **Save the old copy as a backup file**, so
nothing is lost. (Merging it in arrives with Backup v2's merge.)

**Database emptied by the browser.** If the flag says `'indexeddb'` but the
database has no `migration` record (the browser cleared or evicted it), the app
doesn't show an empty Ollie. It shows a recovery screen: "Ollie's data in this
browser is missing. Your browser may have cleared it." with **Restore from a
backup file** and **Use the older copy from <move date>** (the untouched old
keys, run through the move again), each explained.

**Future data versions.** `kv` stores the data `schemaVersion`. At start-up, if
it's below `SCHEMA_VERSION`, the app reads the snapshot, runs the existing
`MIGRATIONS` chain on it (the snapshot uses the backup field names those steps
expect), and `replaceAll`s it in one transaction, as localStorage data is upgraded today.

### Saving changes
Store actions keep computing new arrays synchronously and setting state
(screens update instantly), then call `persist(change)` instead of
`saveLoans()` etc. `persist` queues writes so they land in order, one at a
time, each atomic across the fields it touches (e.g. mark-as-paid writes the
loan and the new payment together). A failed write shows a lasting warning:
"Couldn't save your last change. Make a backup now." The in-memory state is
kept so nothing on screen vanishes.

### Restore and undo on either backend
Phase 1a's guarantees, re-based on the backend:
- Safety copy = the current snapshot (pesos) + the private-folder keys and
  last-backup date, `savedAt`, `schemaVersion`. Stored in `kv` on the database
  (no 5 MB squeeze) or in `loan-tracker-pre-restore` on localStorage (as today).
- `replaceAll(new)` is atomic on Dexie natively. On localStorage it keeps the
  put-everything-back logic.
- Undo = `replaceAll(copy)`, then the copy is deleted; 7-day expiry and the
  version check as today.
- `prepareRestore` (validation) is unchanged.

### Going back, and forward again
Settings → Storage → **Move back to simple storage** (with a confirmation that
explains it): `readAll()` from Dexie → write into the localStorage keys using
localStorage `replaceAll` (all or nothing; too big for 5 MB → abort and stay
on the database with a message) → set the flag to `'localstorage'` → reload.
Nothing added since the move is lost. **Move to the database** runs `runMove`
on demand. Database tables are left as they are after going back (the next
move overwrites them by id).

### Storage card (Settings)
Where: "This browser's database (since Nov 27)" or "Simple browser storage".
Kept: "Your browser has promised to keep this data" or "Your browser may clear
this data if space runs low" (`navigator.storage.persisted()`), plus a
**Ask to keep it** button when not persisted. Space: "Using 120 KB"
(`navigator.storage.estimate()`). Always: "Your data lives only on this
device. It isn't synced anywhere, so keep a backup." A failed move shows its
reason and **Try again**.

## Constraints

- Dexie (`dexie@4`) is the only new runtime dependency; `fake-indexeddb` is
  dev-only for tests. Dexie loads at start-up, so it's in the main bundle (~29 kB gzip).
- `api/ask.ts` untouched. Backup file format unchanged (pesos, schema v1).
- Works offline; the service worker precache covers the new code automatically.
- Both deployments (Vercel, GitHub Pages) are separate origins and move their own data.

## Testing

- Unit with `fake-indexeddb`: money conversion round trip; dexie backend
  `write` diff (put changed, delete removed, untouched rows unchanged) and
  atomicity (a failing table write leaves all tables unchanged); `runMove` on
  fixtures (empty; typical v1; malformed records → quarantine; orphan payment;
  sub-centavo values; private loans; loans needing payment backfill; order
  kept incl. undo removing the right payment; automatic move refusing when
  anything would be quarantined; changed old keys detected; emptied database →
  recovery state; data-version upgrade); move
  run twice → same result; verification failure (injected mismatch) → flag
  unset, localStorage still used; rollback round trip (database → localStorage
  → same snapshot); restore/undo on both backends (existing tests re-run against
  an in-memory and a Dexie backend); start-up choice per flag; open timeout →
  error state.
- Playwright: a fresh visit lands on the database; seeded legacy localStorage
  data → reload → same loans visible, IndexedDB holds them, old keys still
  present; mark a payment, reload, still marked; offline test still passes.
- Existing 279 unit tests and 19 e2e runs stay green.

## Left to the builder
File layout under `src/core/storage/`; Dexie table/class style; the error
screen's look (in the app's existing style); exact queue implementation; how
the toast after a successful move is triggered.

## Calls I made (flag if wrong)
- Preferences, PIN and private-folder lock stay in localStorage.
- A failed move retries at most once a day automatically, plus a **Try again** button.
- Going back copies current data into the old storage (no data lost), rather
  than reverting to the pre-move copy.
- After the move, the old localStorage copy is left in place untouched (it goes
  stale; it's only a last-resort copy, and going back overwrites it).
- Before data loads the app shows nothing new (no splash), since it's tens of milliseconds.
- The automatic move waits if any record would be set aside; **Move anyway** is the owner's choice in the Storage card.
- Rows carry a hidden `_seq` so order (and undo's "last payment") is exactly as today.
- Changes made in an old window after the move are detected and offered as a backup file, not merged.
- A database the browser emptied gets a recovery screen (backup file, or the older copy), never an empty app.
- Database data is upgraded through the same `MIGRATIONS` chain when `SCHEMA_VERSION` rises.
