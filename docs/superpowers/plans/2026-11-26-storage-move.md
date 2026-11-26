# Storage Move Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the seven money fields from localStorage into IndexedDB (Dexie) as integer centavos, with an automatic copy → validate → write → verify → switch move, start-up loading, restore/undo on either storage, and a Settings Storage card.

**Architecture:** A `DataBackend` (localStorage or Dexie) is the source of truth; Zustand stores become the in-memory copy, filled once at start-up by `hydrate()` and saved after each change through an ordered `persist(change)` queue. `bootstrap()` picks the backend from a synchronous localStorage flag, runs the move when needed, and returns either ready data, an error screen, or a recovery screen. Pesos everywhere in app code; centavos only inside the Dexie backend.

**Tech Stack:** React 19, TypeScript strict, Zustand 5, Dexie 4, zod 4, Vitest 4 + fake-indexeddb, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-26-storage-move-design.md`

## Global Constraints

- `dexie@^4` is the only new runtime dependency; `fake-indexeddb` is dev-only.
- `api/ask.ts` untouched. Backup file format unchanged (pesos, schema v1, `exportAllData` output identical).
- Old localStorage data keys are never deleted; the move never writes them. Only "Move back to simple storage" (a confirmed action) overwrites them.
- `toCentavos(p) = Math.round(p * 100)`, `fromCentavos(c) = c / 100`. Money fields: Loan `totalAmount, monthlyPayment, totalPaid, totalInterestPaid`; Payment `amount, principal, interest`; Bill `amount`; BillPayment `amount`; SavingsGoal `targetAmount, currentAmount`; SavingsTransaction `amount`; `monthlyIncome`. `interestRate` stays a percent.
- Database `ollie`, version 1. Flag key `loan-tracker-storage` = `'indexeddb' | 'localstorage' | missing`.
- Open timeout 5 s → error screen; once on the database the app never falls back to the old copy.
- Copy (verbatim): toast "Moved your data to sturdier storage. Your old copy is kept."; save failure "Couldn't save your last change. Make a backup now."; recovery "Ollie's data in this browser is missing. Your browser may have cleared it."; not-sync note "Your data lives only on this device. It isn't synced anywhere, so keep a backup."; blocked "N records need a look before Ollie can move your data".
- Tests use synthetic records only. Each Dexie test uses its own database name (`createOllieDb(\`t-${crypto.randomUUID()}\`)`) and imports `fake-indexeddb/auto`.
- Unknown record fields are kept end to end.
- Existing 279 unit tests and 19 e2e runs stay green (tests that exercised removed APIs are rewritten, not deleted).

## Review Focus

1. **A store action that changes a record in place** (same object, new content): the identity diff would skip it, and the change would never reach the database. Every action must make a new object. Pinned by Task 6's round-trip test over every data-changing action.
2. **A browser where IndexedDB exists but won't open** (private windows, locked-down profiles) on the first visit: the owner should land on simple storage with no error screen, and the move retries at most once a day. Pinned by a Task 8 bootstrap test.
3. **Values like `0.1 + 0.2` or `1000.005`**: they're rounded and counted, never reported as a mismatch that blocks the move. Pinned by a Task 4 runMove test.
4. **A move interrupted half-way** (tab closed mid-transaction, or a second tab running it at the same time): the next start redoes it with the same result. Pinned by Task 4's "run twice" test plus the one-transaction write.
5. **Pending saves when restore, undo or Move back runs**: a queued write must land before the snapshot is read, so nothing typed a moment earlier is lost. Pinned by tests in Task 7 and Task 9 that call `persist` without awaiting it.

---

## File structure

All new storage code lives in `src/features/storage/` (not `src/core/`: the move needs the feature zod schemas and `backfillPayments`, and core may not import feature code).

| File | Responsibility |
|---|---|
| `snapshot.ts` | `DataSnapshot`, `Field`, `RecordField`, `RECORD_FIELDS`, `Change`, `emptySnapshot`, `PARENT_LINKS` |
| `centavos.ts` | `MONEY_FIELDS`, `toCentavos`, `fromCentavos`, `toRow`, `fromRow`, `hasSubCentavo` |
| `backend.ts` | `DataBackend`, `ReplaceAllError`, `KeyValueStorage` |
| `storageKeys.ts` | `STORAGE_FLAG_KEY`, `MOVED_AT_KEY`, `MOVE_STATUS_KEY` |
| `localStorageBackend.ts` | today's JSON-per-key storage behind `DataBackend` |
| `db.ts` | `OllieDb` (Dexie), `createOllieDb`, `getKv`/`setKv` |
| `dexieBackend.ts` | Dexie `DataBackend` (diff writes, `_seq`, centavos), `upgradeDexieData` |
| `fingerprint.ts` | `fingerprintLegacy` |
| `move.ts` | `planMove` (pure) and `runMove` |
| `safetyCopyStore.ts` | where the restore safety copy lives on each backend |
| `activeStorage.ts` | the backend in use (`setActiveStorage`/`getActiveStorage`) |
| `persist.ts` | the ordered save queue |
| `storageStatusStore.ts` | Zustand: what the Storage card and banners show |
| `bootstrap.ts` | start-up decision and loading |
| `storageActions.ts` | Move back, Move to the database, recovery actions, old-copy backup, quarantine text, `formatBytes` |
| `StorageErrorScreen.tsx`, `RecoveryScreen.tsx`, `StorageCard.tsx`, `SaveFailedBanner.tsx` | UI |

Also: `src/utils/storeSnapshot.ts` (`hydrateStores`, `readStoresSnapshot`), `src/utils/download.ts` (moved `downloadFile`/`dateSuffix`), changes to the four data stores, `restore.ts`, `lastRestoreStore.ts`, `utils/backup.ts`, `SettingsPage.tsx`, `AppShell.tsx`, `main.tsx`, `runMigrations.ts`.

---

### Task 1: Dependencies, snapshot types and centavo conversion

**Files:**
- Modify: `package.json` (via npm)
- Create: `src/features/storage/snapshot.ts`, `src/features/storage/centavos.ts`, `src/features/storage/backend.ts`, `src/features/storage/storageKeys.ts`
- Test: `src/features/storage/centavos.test.ts`

**Interfaces:**
- Produces:
  - `type DataSnapshot = { loans: Loan[]; payments: PaymentRecord[]; monthlyIncome: number; bills: Bill[]; billPayments: BillPaymentRecord[]; savingsGoals: SavingsGoal[]; savingsTransactions: SavingsTransaction[] }`
  - `type Field = keyof DataSnapshot`; `type RecordField = Exclude<Field, 'monthlyIncome'>`
  - `const RECORD_FIELDS: readonly RecordField[] = ['loans','payments','bills','billPayments','savingsGoals','savingsTransactions']`
  - `type Change = { [F in Field]?: { next: DataSnapshot[F]; prev: DataSnapshot[F] } }`
  - `function emptySnapshot(): DataSnapshot`
  - `const PARENT_LINKS = { payments: { key: 'loanId', parent: 'loans' }, billPayments: { key: 'billId', parent: 'bills' }, savingsTransactions: { key: 'goalId', parent: 'savingsGoals' } } as const`
  - `const MONEY_FIELDS: Record<RecordField, readonly string[]>` (values from Global Constraints)
  - `toCentavos(p: number): number`, `fromCentavos(c: number): number`, `hasSubCentavo(p: number): boolean` (true when `Math.abs(p * 100 - Math.round(p * 100)) > 1e-6`)
  - `type Row = Record<string, unknown> & { id: string; _seq: number }`
  - `toRow(field: RecordField, record: object, seq: number): Row` (copies every field, converts the money fields that are numbers, adds `_seq`)
  - `fromRow<T>(field: RecordField, row: Row): T` (strips `_seq`, converts money back, never mutates `row`)
  - `interface DataBackend { kind: 'localstorage' | 'indexeddb'; readAll(): Promise<DataSnapshot>; write(change: Change): Promise<void>; replaceAll(snapshot: DataSnapshot): Promise<void> }`
  - `class ReplaceAllError extends Error { constructor(readonly rolledBack: boolean, options?: { cause?: unknown }) }`
  - `type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>`
  - `STORAGE_FLAG_KEY = 'loan-tracker-storage'`, `MOVED_AT_KEY = 'loan-tracker-storage-moved-at'`, `MOVE_STATUS_KEY = 'loan-tracker-storage-move'`

- [ ] **Step 1: Install**

Run: `npm install dexie@^4 && npm install -D fake-indexeddb@^6`
Expected: both added to `package.json`; `npm ls dexie fake-indexeddb` shows them.

- [ ] **Step 2: Write the failing tests** in `centavos.test.ts`:
  - `toRow converts every money field of a loan to centavos and keeps other fields`: `toRow('loans', { id:'L1', name:'Phone', totalAmount: 12000.5, monthlyPayment: 1000, totalPaid: 0.1 + 0.2, totalInterestPaid: 0, interestRate: 4.95, extra: 'kept' }, 3)` equals `{ id:'L1', name:'Phone', totalAmount: 1200050, monthlyPayment: 100000, totalPaid: 30, totalInterestPaid: 0, interestRate: 4.95, extra:'kept', _seq: 3 }`.
  - `fromRow round-trips every field of every record type` (one synthetic record per `RecordField`; `fromRow(f, toRow(f, r, 0))` equals `r` for 2-dp values).
  - `fromRow does not change the stored row` (row object deep-equal before/after).
  - `hasSubCentavo`: `false` for `1000`, `0.1 + 0.2`, `12.34`; `true` for `1000.005`, `0.001`.
  - `toRow leaves a money field that is not a number untouched` (`totalAmount: undefined` stays absent/undefined).

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/features/storage/centavos.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement** `snapshot.ts`, `centavos.ts`, `backend.ts`, `storageKeys.ts` per the Interfaces block.

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run src/features/storage/centavos.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/features/storage
git commit -m "Add storage snapshot types and centavo conversion"
```

---

### Task 2: localStorage backend

**Files:**
- Create: `src/features/storage/localStorageBackend.ts`
- Test: `src/features/storage/localStorageBackend.test.ts`

**Interfaces:**
- Consumes: Task 1 types; `STORAGE_FIELDS` from `features/backup/schema.ts`; `DEFAULT_COLOR`.
- Produces:
  - `readLegacySnapshot(storage: KeyValueStorage): DataSnapshot`: today's lenient reads. Unreadable JSON or a non-array → `[]`. Loans get `color || DEFAULT_COLOR`, `interestRate ?? 0`, `totalInterestPaid ?? 0` (as `loadLoans` does today). Income = `Number(raw) || 0`.
  - `readLegacyRaw(storage: KeyValueStorage): Record<Field, string | null>`
  - `createLocalStorageBackend(storage: KeyValueStorage): DataBackend` (`kind: 'localstorage'`). `readAll` = `readLegacySnapshot`. `write` sets only the keys of the fields in the change (arrays as JSON, income as `String(n)`). `replaceAll` remembers every key's raw value, writes all seven, and on any throw puts every key back. It then throws `ReplaceAllError(true)` if the put-back worked, `ReplaceAllError(false)` if not.

- [ ] **Step 1: Write the failing tests** (an in-memory `KeyValueStorage` with an optional `failOnSet(key)`, like the one in `restore.test.ts`):
  - `reads today's keys, filling loan defaults`: a loan without `color`/`interestRate`/`totalInterestPaid` reads back with `'#F3622D'`, `0`, `0`; income `'30000'` reads as `30000`.
  - `treats unreadable or missing keys as empty` (`'{not json'` → `[]`; missing → `[]`, income `0`).
  - `write saves only the fields in the change`: write `{ bills: {next:[b], prev:[]} }`; the loans key keeps its exact previous string.
  - `write stores the income as plain text` (`'25000'`).
  - `replaceAll writes every field`.
  - `replaceAll puts everything back when one key fails, and says it rolled back`: `failOnSet = k => k === STORAGE_FIELDS.savingsGoals`; it rejects with `ReplaceAllError` where `rolledBack === true`, and all seven keys equal their earlier raw strings.
  - `replaceAll says so when it can't put everything back`: fail every set after the first failure → `rolledBack === false`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/storage/localStorageBackend.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `localStorageBackend.ts`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/storage/localStorageBackend.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/storage
git commit -m "Wrap today's localStorage data behind a storage backend"
```

---

### Task 3: Dexie database and backend

**Files:**
- Create: `src/features/storage/db.ts`, `src/features/storage/dexieBackend.ts`
- Test: `src/features/storage/dexieBackend.test.ts`

**Interfaces:**
- Consumes: Task 1 (`toRow`, `fromRow`, `Row`, `RECORD_FIELDS`, `DataBackend`, `ReplaceAllError`); `MIGRATIONS`, `SCHEMA_VERSION`, `migrateSnapshot`, `Snapshot` from `features/backup/schema.ts`.
- Produces:
  - `const DB_NAME = 'ollie'`
  - `class OllieDb extends Dexie` with `version(1).stores({ loans: 'id, _seq', payments: 'id, loanId, _seq', bills: 'id, _seq', billPayments: 'id, billId, _seq', savingsGoals: 'id, _seq', savingsTransactions: 'id, goalId, _seq', kv: 'key', quarantine: '++qid, field' })`; one typed `Table<Row, string>` per `RecordField` (same names), `kv: Table<{ key: KvKey; value: unknown }, KvKey>`, `quarantine: Table<QuarantineRow, number>`
  - `type KvKey = 'monthlyIncome' | 'migration' | 'schemaVersion' | 'safetyCopy'`
  - `type QuarantineRow = { qid?: number; field: RecordField; id: string | null; name: string | null; reason: string; raw: unknown }`
  - `createOllieDb(name: string = DB_NAME): OllieDb` (not opened)
  - `getKv<T>(db: OllieDb, key: KvKey): Promise<T | undefined>`, `setKv(db: OllieDb, key: KvKey, value: unknown): Promise<void>`
  - `createDexieBackend(db: OllieDb): DataBackend` (`kind: 'indexeddb'`)
  - `upgradeDexieData(db: OllieDb, migrations = MIGRATIONS, target = SCHEMA_VERSION): Promise<boolean>`: if `kv.schemaVersion` < target, read the snapshot, run `migrateSnapshot`, then replace all and set `schemaVersion` in **one** transaction. Returns whether it upgraded. A stored version above target is left alone.
- Behaviour:
  - `readAll` reads each table `orderBy('_seq')`, maps `fromRow`; income = `kv.monthlyIncome` in centavos → pesos, missing → 0.
  - `write(change)` runs one `db.transaction('rw', touchedTables, …)`. Per array field: delete ids in `prev` and not in `next`. Put each `next` record whose object isn't `===` the `prev` record with the same id. A changed record keeps its stored `_seq` (`bulkGet`); new records get `max(_seq) + 1, +2, …` in `next` order. Income → `kv`.
  - `replaceAll` clears and refills all six tables (`_seq` = array index) plus income in one transaction; a failure rejects with `ReplaceAllError(true)` (Dexie rolls back).

- [ ] **Step 1: Write the failing tests:**
  - `round-trips a snapshot through replaceAll and readAll` (all seven fields, unknown field `extra` kept, order kept).
  - `stores money as whole centavos` (raw `db.loans.get('L1')` has `totalAmount: 1200050` for 12000.5; `kv.monthlyIncome` raw is `3000000` for 30000).
  - `write puts changed records, deletes removed ones and leaves the rest alone`. Start from replaceAll of loans A, B, C. Write `{ loans: { prev:[A,B,C], next:[A, B2, D] } }` where B2 is `{...B, name:'x'}`. Result: readAll ids `[A,B,D]` with B renamed; C gone. A's row is unchanged: spy on `db.loans.bulkPut`, and A must not be among the rows passed to it.
  - `new records go to the end, changed records keep their place`: after the write above, order is A, B2, D, and D's `_seq` > B's.
  - `write is all or nothing across tables`: a `db.payments.hook('creating', () => { throw new Error('boom') })`; write `{ loans: {...add L2}, payments: {...add P1} }` rejects; readAll shows neither L2 nor P1.
  - `replaceAll is all or nothing`: hook on `savingsGoals` creating throws → rejects with `ReplaceAllError` (`rolledBack === true`); earlier data intact.
  - `upgradeDexieData runs the migration chain on database data`: set `schemaVersion` 1, call with `migrations = { 2: s => ({ ...s, loans: (s.loans as Loan[]).map(l => ({ ...l, tag: 'migrated' })) }) }`, target 2 → returns true; loans have `tag: 'migrated'`; `getKv(db,'schemaVersion')` is 2. Second call returns false.
  - `upgradeDexieData leaves newer data alone` (stored 3, target 2 → false, unchanged).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/storage/dexieBackend.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `db.ts` and `dexieBackend.ts`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/storage/dexieBackend.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/storage
git commit -m "Add the IndexedDB backend with centavos and kept order"
```

---

### Task 4: The move

**Files:**
- Create: `src/features/storage/fingerprint.ts`, `src/features/storage/move.ts`, `src/features/storage/safetyCopyStore.ts`
- Test: `src/features/storage/move.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3; `loanSchema`, `paymentSchema`, `billSchema`, `billPaymentSchema`, `savingsGoalSchema`, `savingsTransactionSchema`; `backfillPayments`; `SCHEMA_VERSION`; `readLegacyRaw`.
- Produces:
  - `fingerprintLegacy(storage: KeyValueStorage): string`: FNV-1a 32-bit hex over the seven raw values in `STORAGE_FIELDS` order, joined by `'\u0000'` (missing → `'\u0001'`).
  - `type QuarantineItem = { field: RecordField; id: string | null; name: string | null; reason: string; raw: unknown }`
  - `type FieldCounts = { source: number; moved: number; quarantined: number; backfilled: number }`
  - `type MoveReport = { at: string; counts: Record<RecordField, FieldCounts>; quarantined: number; rounded: number; fingerprint: string }`
  - `type MovePlan = { snapshot: DataSnapshot; quarantine: QuarantineItem[]; counts: Record<RecordField, FieldCounts>; rounded: number }`
  - `planMove(storage: KeyValueStorage): MovePlan` (pure, sync). For each field: unreadable JSON or a non-array → one item `{ id: null, name: null, reason: 'Couldn’t be read', raw: <string> }`. Each record goes through its zod schema; a failure becomes an item whose reason is the first issue, as `"<path>: <message>"`. A repeated id becomes `'Same id as another record'`. A child whose parent id isn't among the kept parents becomes `'Its loan/bill/goal is missing'`. Then `backfillPayments` runs on the kept loans and payments. `rounded` counts money values with `hasSubCentavo`.
  - `type MoveResult = { ok: true; report: MoveReport } | { ok: false; outcome: 'blocked'; items: QuarantineItem[] } | { ok: false; outcome: 'failed'; reason: string }`
  - `runMove(storage: KeyValueStorage, db: OllieDb, opts: { now: Date; allowQuarantine?: boolean }): Promise<MoveResult>`
  - `interface SafetyCopyStore { read(): Promise<unknown>; write(copy: unknown): Promise<void>; remove(): Promise<void> }`; `SAFETY_COPY_KEY = 'loan-tracker-pre-restore'` (moved here from `restore.ts`); `localSafetyStore(storage: KeyValueStorage): SafetyCopyStore` (JSON in that key); `dexieSafetyStore(db: OllieDb): SafetyCopyStore` (`kv.safetyCopy`)
- `runMove` steps:
  1. `planMove`. If anything is quarantined and `!allowQuarantine`, return `blocked` without touching the database.
  2. One transaction over all tables + `kv` + `quarantine`: clear the six record tables and `quarantine`, then `bulkPut` rows (`_seq` = position in the plan's arrays), add quarantine rows, and put `monthlyIncome` and `schemaVersion = SCHEMA_VERSION`.
  3. Verify by reading raw rows. Per field: rows + quarantined = source + backfilled. Every row's money fields equal `toCentavos(source value)` by id. Per money field, the sums are equal. Every child's parent id exists. Income is equal. The first mismatch → `{ ok:false, outcome:'failed', reason }`.
  4. Pass: if `localSafetyStore(storage).read()` gives a copy, write it to `dexieSafetyStore(db)` (the undo offer moves along). Then `setKv(db, 'migration', report)` (the database counts as ready only after this) and return ok. The flag is **not** set here (bootstrap/actions own it).
  5. Any thrown error → `failed` with its message. Never writes a localStorage data key.
- **Ruling made while planning:** the spec says the move "`bulkPut`s (overwrites by id)". This plan **clears the tables first, in the same transaction**. Otherwise a record deleted after moving back would come back on the next move. The cost if wrong: none for data. The tables are a stale copy whenever a move runs; the flag isn't `'indexeddb'` then.

- [ ] **Step 1: Write the failing tests** (fixtures built with the `loan()/bill()/goal()` helpers from `restore.test.ts`, copied in):
  - `moves an empty device` → ok, all counts 0, `kv.migration` set, `schemaVersion` 1.
  - `moves a typical device and every record matches` (2 loans, 3 payments, 1 bill, 2 bill payments, 1 goal, 2 transactions, income 30000) → `createDexieBackend(db).readAll()` deep-equals `readLegacySnapshot(storage)`.
  - `never changes the old keys` (all seven raw strings identical after; also after a blocked and a failed run).
  - `refuses the automatic move when a record would be set aside` (loan with `totalAmount: 'abc'`) → `{ ok:false, outcome:'blocked' }`, item `{ field:'loans', id:'L2', name:'Bad', reason: /totalAmount/ }`; `db.loans.count()` is 0 and `kv.migration` is unset.
  - `Move anyway keeps set-aside records apart`: same with `allowQuarantine: true` → ok; the bad loan is in `quarantine` with its raw value; its payment is quarantined as an orphan; `report.quarantined` is 2.
  - `sets aside a payment whose loan never existed` → blocked item reason `'Its loan is missing'`.
  - `sets aside the second record with a repeated id`.
  - `rounds values finer than a centavo and counts them` (`totalPaid: 1000.005`, `amount: 0.1 + 0.2`) → ok, `rounded` is 1 (only 1000.005), stored `totalPaid` is `toCentavos(1000.005)`.
  - `keeps private loans private` (`private: true` survives).
  - `rebuilds payment history for loans that have none` (`monthsPaid: 2`, no payments) → 2 payments, `counts.payments.backfilled === 2`.
  - `keeps order, so undo removes the right payment`: payments P1, P2, P3 for one loan in that order. After the move, `readAll().payments.map(p => p.id)` is `['P1','P2','P3']`.
  - `running it twice gives the same result, and drops rows the old copy no longer has`: move; delete a loan from the localStorage key; move again → loan gone from the tables, every other count unchanged.
  - `fails, and says why, when the read-back doesn't match`: `db.loans.hook('reading', r => ({ ...r, totalAmount: r.totalAmount + 1 }))` → `{ ok:false, outcome:'failed', reason: /loans/ }`, `kv.migration` unset.
  - `carries the undo-restore copy across`: localStorage holds a valid safety copy → after the move, `dexieSafetyStore(db).read()` deep-equals it.
  - `fingerprintLegacy changes when any old key changes, and not otherwise`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/storage/move.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `fingerprint.ts`, `safetyCopyStore.ts`, `move.ts`. In `restore.ts`, change only its `SAFETY_COPY_KEY` to a re-export from `safetyCopyStore.ts`, so existing imports keep working.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/storage/move.test.ts src/features/backup`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/storage src/features/backup/restore.ts
git commit -m "Move localStorage data into IndexedDB with validation and read-back checks"
```

---

### Task 5: Active storage, save queue and status store

**Files:**
- Create: `src/features/storage/activeStorage.ts`, `src/features/storage/persist.ts`, `src/features/storage/storageStatusStore.ts`
- Test: `src/features/storage/persist.test.ts`

**Interfaces:**
- Consumes: `DataBackend`, `SafetyCopyStore`, `localSafetyStore`, `createLocalStorageBackend`, `OllieDb`.
- Produces:
  - `type ActiveStorage = { backend: DataBackend; safety: SafetyCopyStore; prefs: KeyValueStorage; db: OllieDb | null }`
  - `setActiveStorage(a: ActiveStorage): void`; `getActiveStorage(): ActiveStorage`. Until something is set, it lazily makes a localStorage one from `globalThis.localStorage`, so tests and the pre-bootstrap code keep working.
  - `persist(change: Change): Promise<void>`: chains onto one promise so writes run one at a time in call order. A rejection calls `useStorageStatusStore.getState().update({ saveFailed: true })` and `console.error`, and never breaks the chain.
  - `whenSaved(): Promise<void>`: resolves after every write queued so far.
  - `type StorageStatus` (exported) and `useStorageStatusStore`: `{ kind: 'indexeddb' | 'localstorage'; movedAt: string | null; justMoved: boolean; blocked: QuarantineItem[] | null; failedReason: string | null; oldCopyChanged: boolean; saveFailed: boolean; update(p: Partial<Omit<…, 'update'>>): void }`. Defaults: `'localstorage'`, nulls, falses.

- [ ] **Step 1: Write the failing tests** (a fake backend whose `write` returns promises the test resolves by hand):
  - `writes land one at a time, in order`: `persist(a)`, `persist(b)`; `b` isn't started until `a` resolves; final call order `[a, b]`.
  - `a failed write shows the warning and later writes still run`: first rejects → `saveFailed` true; second still called.
  - `whenSaved waits for everything queued so far`.
  - `getActiveStorage falls back to the device storage before start-up` (`kind === 'localstorage'`).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/storage/persist.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** the three files.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/storage/persist.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/storage
git commit -m "Add the ordered save queue and storage status"
```

---

### Task 6: Stores load once and save through the queue

**Files:**
- Modify: `src/features/loans/loanStore.ts`, `src/features/bills/billStore.ts`, `src/features/savings/savingsStore.ts`, `src/features/finance/incomeStore.ts`, `src/main.tsx`
- Create: `src/utils/storeSnapshot.ts`
- Test: `src/utils/storeSnapshot.test.ts`

**Interfaces:**
- Consumes: `persist`, `Change`, `DataSnapshot`, `getActiveStorage`.
- Produces:
  - Each data store starts empty and gains `hydrate(...)`; `reloadFromStorage` and the module-load reads/backfill are removed from these four stores. Exact signatures: `useLoanStore` `hydrate(data: { loans: Loan[]; payments: PaymentRecord[] }): void`; `useBillStore` `hydrate(data: { bills: Bill[]; billPayments: BillPaymentRecord[] }): void`; `useSavingsStore` `hydrate(data: { goals: SavingsGoal[]; transactions: SavingsTransaction[] }): void`; `useIncomeStore` `hydrate(monthlyIncome: number): void`.
  - Every former `saveX(...)` becomes one `persist({...})` per action, holding every field that action changed, each with `{ next, prev: state.<same> }`. Mark-as-paid writes `loans` and `payments` together; the savings store maps `goals` → `savingsGoals` and `transactions` → `savingsTransactions`.
  - `src/utils/storeSnapshot.ts`: `hydrateStores(s: DataSnapshot): void`, `readStoresSnapshot(): DataSnapshot`.
  - `sortBy`/`viewMode` stay read from localStorage (preferences).
  - Temporary `main.tsx` (replaced in Task 8): before `render`, `await getActiveStorage().backend.readAll()`, run `backfillPayments`, and `persist` the payments if any were added. Then `hydrateStores`, then render; the `hasData` check moves after hydration.

- [ ] **Step 1: Write the failing tests** (`vi.hoisted` in-memory `localStorage`, as in `utils/backup.test.ts`; `setActiveStorage` with a Dexie backend on a fresh db; `import 'fake-indexeddb/auto'`). Each runs actions, `await whenSaved()`, then expects `backend.readAll()` to deep-equal `readStoresSnapshot()`:
  - `loan actions reach the database`: addLoan, updateLoan (core change), markAsPaid ×2, undoMarkAsPaid, recalcMonthlyPayment, archiveLoan, unarchiveLoan, makePrivate, makePublic, deleteLoan.
  - `bill actions reach the database`: addBill, updateBill, recordBillPayment, undoBillPayment, archiveBill, unarchiveBill, deleteBill.
  - `savings actions reach the database`: addGoal, updateGoal, addFunds, withdrawFunds, archiveGoal, unarchiveGoal, deleteGoal.
  - `income reaches the database` (`setMonthlyIncome(42000)` → `readAll().monthlyIncome === 42000`).
  - `after reloading, undo removes the payment made last`: markAsPaid ×2 on one loan, then `hydrateStores(await backend.readAll())`, undoMarkAsPaid. The remaining payment is the first one (by `month === 1`), and `loans[0].monthsPaid === 1`.
  - `hydrateStores then readStoresSnapshot returns the same snapshot`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/utils/storeSnapshot.test.ts`
Expected: FAIL (`hydrate`/module missing).

- [ ] **Step 3: Implement** the store changes, `storeSnapshot.ts` and the temporary `main.tsx`. `utils/backup.ts`'s `reloadStores` hydrates from `await getActiveStorage().backend.readAll()` for these four stores. Task 7 finishes the async change; for now keep it compiling by making `reloadStores` async and fire-and-forget. `exportAllData` reads `readStoresSnapshot()`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/utils/storeSnapshot.test.ts && npx tsc -b && npm run verify`
Expected: PASS; tsc clean. `utils/backup.test.ts` may need `await` on the store refresh. Update it here if so, keeping its assertion.

- [ ] **Step 5: Commit**

```bash
git add src/features/loans/loanStore.ts src/features/bills/billStore.ts src/features/savings/savingsStore.ts src/features/finance/incomeStore.ts src/utils src/main.tsx
git commit -m "Load stores once at start-up and save each change through the queue"
```

---

### Task 7: Restore and undo on either backend

**Files:**
- Modify: `src/features/backup/restore.ts`, `src/features/backup/lastRestoreStore.ts`, `src/utils/backup.ts`, `src/pages/SettingsPage.tsx`
- Test: `src/features/backup/restore.test.ts` (rewrite the `writeRestore`/`undoRestore`/`safety copy limits`/`review follow-ups` blocks; `prepareRestore` tests unchanged), `src/utils/backup.test.ts`

**Interfaces:**
- Consumes: `ActiveStorage`, `SafetyCopyStore`, `ReplaceAllError`, `DataSnapshot`, `hydrateStores`, `whenSaved`.
- Produces (in `restore.ts`):
  - `type SafetyCopy = { savedAt: string; schemaVersion: number; snapshot: DataSnapshot; prefs: Record<string, string | null> }` (`prefs` = the three `FOLDER_KEYS` + `LAST_BACKUP_KEY`)
  - `writeRestore(active: ActiveStorage, data: RestoreData, now: Date): Promise<boolean>`. Steps: read `before` (backend snapshot + prefs) → `safety.write(copy)`; a failure returns false and changes nothing → `backend.replaceAll(next)`, where `next.monthlyIncome = data.monthlyIncome ?? before.monthlyIncome`. On `ReplaceAllError`: remove the copy only if `rolledBack`, then return false. → Write the folder prefs as `plannedValues` does today. If that throws, put the prefs back and `replaceAll(before)`; remove the copy only if both worked; return false.
  - `readSafetyCopy(safety: SafetyCopyStore, now?: Date): Promise<SafetyCopy | null>`: same 7-day and version rules. Anything without a `snapshot` object counts as unusable and is removed (this covers Phase 1a's unreleased `values` format).
  - `undoRestore(active: ActiveStorage, now?: Date): Promise<boolean>`: `replaceAll(copy.snapshot)`, then put the prefs back, then remove the copy. Any failure keeps the copy and returns false.
  - `useLastRestoreStore`: `{ restoredAt: string | null; refresh(): Promise<void> }`, reading through `getActiveStorage().safety`; it starts at `null`.
  - `utils/backup.ts`: `applyRestore(data): Promise<boolean>`, `undoLastRestore(): Promise<boolean>`. Both `await whenSaved()` first, and afterwards hydrate the stores from `backend.readAll()`, reload the folder and last-backup stores, and `await useLastRestoreStore.getState().refresh()`. Toast copy unchanged. `SettingsPage` awaits them, and the toast's UNDO calls `void undoLastRestore()`.

- [ ] **Step 1: Rewrite the failing tests** as `describe.each([['simple storage', makeLocal], ['the database', makeDexie]])`. Each harness returns `{ active, failReplaceOn(field), failSafetyCopy(), raw() }`. Local: a `failOnSet` storage. Dexie: a creating hook that throws, and a safety store whose `write` rejects. Every existing behaviour keeps its test name:
  - `replaces every section on the device`; `keeps a safety copy of what was there before`; `leaves the income as it was when the file has none`; `changes nothing if one part fails to save`; `changes nothing if the safety copy cannot be kept`; `puts back what was there before the restore`; `can only be used once`; `records the data version it was saved with`; `stops offering an undo after 7 days, and frees the space`; `won’t put back data saved by a different version of Ollie`; `puts back the last-backup date on undo, so the backup reminder comes back`.
  - Local only: `keeps the safety copy if a failed restore can’t be fully rolled back`; `keeps the safety copy and says so when putting the old data back fails`.
  - New: `a change saved just before the restore is in the safety copy`. Call `persist({ loans: … add 'NEW' })` without awaiting, then `applyRestore`. The safety copy's `snapshot.loans` includes `'NEW'`. (In `utils/backup.test.ts`.)
  - `utils/backup.test.ts`'s existing test, with `await`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/backup/restore.test.ts src/utils/backup.test.ts`
Expected: FAIL (signatures don't match).

- [ ] **Step 3: Implement** the changes above.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/backup src/utils && npx tsc -b`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/backup src/utils src/pages/SettingsPage.tsx
git commit -m "Restore and undo on either storage, keeping the safety copy"
```

---

### Task 8: Start-up: choose, move, load, or explain

**Files:**
- Create: `src/features/storage/bootstrap.ts`, `src/features/storage/StorageErrorScreen.tsx`, `src/features/storage/RecoveryScreen.tsx`
- Modify: `src/main.tsx`, `src/features/backup/runMigrations.ts`, `src/app/AppShell.tsx`
- Test: `src/features/storage/bootstrap.test.ts`

**Interfaces:**
- Consumes: everything above; `restoreIntoEmptyDatabase` and `useOlderCopy` from Task 9 are wired into `RecoveryScreen` in Task 9. This task renders the screen with both buttons calling props.
- Produces:
  - `OPEN_TIMEOUT_MS = 5000`, `MOVE_RETRY_MS = 86_400_000`
  - `type BootEnv = { storage: KeyValueStorage; hasIndexedDb: boolean; openDb: () => Promise<OllieDb>; now: Date; openTimeoutMs?: number; migrations?: Record<number, Migration>; target?: number }`
  - `type BootStatus = Pick<StorageStatus, 'kind' | 'movedAt' | 'justMoved' | 'blocked' | 'failedReason' | 'oldCopyChanged'>`
  - `type BootOutcome = { kind: 'ready'; active: ActiveStorage; snapshot: DataSnapshot; status: BootStatus } | { kind: 'error' } | { kind: 'recovery'; db: OllieDb; movedAt: string | null }`
  - `bootstrap(env: BootEnv): Promise<BootOutcome>`:
    - Flag `'indexeddb'`: open (timeout → `error`; open rejects → `error`). No `kv.migration` → `recovery` (`movedAt` from `MOVED_AT_KEY`). Otherwise `upgradeDexieData`, `readAll`, backfill, and `oldCopyChanged = fingerprintLegacy(storage) !== migration.fingerprint`. Result `ready` on Dexie.
    - Flag missing and `hasIndexedDb`: `planMove` first. If anything is quarantined → `ready` on localStorage with `blocked` (no database opened). Otherwise skip if `MOVE_STATUS_KEY` holds `{ outcome: 'failed', at }` within `MOVE_RETRY_MS`. Otherwise open + `runMove`. If ok: set the flag `'indexeddb'` and `MOVED_AT_KEY` = now ISO, remove `MOVE_STATUS_KEY`, `ready` on Dexie with `justMoved` true when any record moved. If it failed (or open failed or timed out): save `MOVE_STATUS_KEY` `{ outcome:'failed', at, reason }`, `ready` on localStorage with `failedReason`.
    - Flag `'localstorage'` or no IndexedDB → `ready` on localStorage.
    - Every `ready` snapshot has `backfillPayments` applied; added payments are written through that backend before returning.
  - `runMigrations.ts`: skip `migrateStorage` when the flag is `'indexeddb'` (the old copy stays as it was, and its fingerprint stays valid).
  - `main.tsx`: `bootstrap({ storage: localStorage, hasIndexedDb: typeof indexedDB !== 'undefined', openDb: async () => { const db = createOllieDb(); await db.open(); return db }, now: new Date() })`. Then: `ready` → `setActiveStorage`, `hydrateStores`, `useStorageStatusStore.update(status)`, `await useLastRestoreStore.getState().refresh()`, render `<App/>`, `requestPersistentStorage(hasData)`. `error` → `<StorageErrorScreen/>`. `recovery` → `<RecoveryScreen/>`.
  - `StorageErrorScreen`: Ollie's look (owl + card), title "Ollie couldn't open your data", text "Another Ollie tab may be holding it. Close other Ollie tabs, then try again.", button **Try again** (`location.reload()`).
  - `RecoveryScreen({ movedAt, onRestoreFile, onUseOlderCopy })`: the spec's copy; **Restore from a backup file** ("Pick a backup you saved. It replaces what's here.") and **Use the older copy from <date>** ("The copy Ollie kept when it moved your data. Anything added after <date> isn't in it."). The second button is hidden when `movedAt` is null.
  - `AppShell`: in an effect, if `justMoved`, call `showToast('Moved your data to sturdier storage. Your old copy is kept.')` and then `update({ justMoved: false })`.

- [ ] **Step 1: Write the failing tests:**
  - `a first visit moves to the database` (empty storage) → `ready`, `active.backend.kind === 'indexeddb'`, flag `'indexeddb'`, `justMoved` false.
  - `existing data moves, and the owner is told once` → `justMoved` true, snapshot equals `readLegacySnapshot`.
  - `a record that would be set aside keeps simple storage and lists it` → `ready` on localStorage, `blocked` has 1 item, flag unset, `openDb` not called.
  - `a database that won't open on the first visit keeps simple storage` (`openDb` rejects) → `ready` localStorage, `failedReason` set, `MOVE_STATUS_KEY` saved; a second `bootstrap` with `now` +1 h doesn't call `openDb`; with `now` +25 h it does.
  - `on the database, loads from it` (after a move, change the old keys) → `ready` dexie, data from the database, `oldCopyChanged` true; unchanged keys → false.
  - `on the database, a database that won't open shows the error` (`openDb` never resolves, `openTimeoutMs: 20`) → `{ kind: 'error' }`; the flag is still `'indexeddb'`.
  - `an emptied database shows recovery, not an empty app` (flag `'indexeddb'`, fresh empty db) → `recovery` with `movedAt` from `MOVED_AT_KEY`.
  - `database data is upgraded when the data version rises` (`migrations`/`target: 2` as in Task 3) → snapshot shows the migrated field.
  - `having gone back, stays on simple storage` (flag `'localstorage'`) → `ready` localStorage, `openDb` not called.
  - `loans saved before payment history get it rebuilt on either storage`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/storage/bootstrap.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `bootstrap.ts`, the two screens, `main.tsx`, `runMigrations.ts`, `AppShell` toast.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/storage && npx tsc -b && npm run verify`
Expected: PASS; tsc clean.

- [ ] **Step 5: Check it in a browser**

Start `npm run dev -- --port <random free port>`. Confirm that origin's `localStorage` **and** IndexedDB are empty before anything else. Seed two synthetic loans into the old keys, reload, and expect: the loans show, the toast shows once, `loan-tracker-storage` is `'indexeddb'`, the `ollie` database holds 2 loans, and the old keys are unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/features/storage src/main.tsx src/features/backup/runMigrations.ts src/app/AppShell.tsx
git commit -m "Choose storage at start-up, run the move, and explain when data can't load"
```

---

### Task 9: Storage card, going back and forth, recovery actions, save warning

**Files:**
- Create: `src/features/storage/storageActions.ts`, `src/features/storage/StorageCard.tsx`, `src/features/storage/SaveFailedBanner.tsx`, `src/utils/download.ts`
- Modify: `src/pages/SettingsPage.tsx` (add the card in the data section; use `utils/download.ts`), `src/app/AppShell.tsx` (banner), `src/main.tsx` (wire `RecoveryScreen` props)
- Test: `src/features/storage/storageActions.test.ts`

**Interfaces:**
- Consumes: Tasks 1–8; `prepareRestore`; the folder-pref writing from `restore.ts`, exported as `writeFolderPrefs(prefs: KeyValueStorage, data: RestoreData): void`.
- Produces (in `storageActions.ts`):
  - `moveBack(env: { db: OllieDb; storage: KeyValueStorage }): Promise<'ok' | 'too-big'>`: `await whenSaved()`, read the Dexie snapshot, then `createLocalStorageBackend(storage).replaceAll(...)`. A `ReplaceAllError` → `'too-big'` (the flag is unchanged). Otherwise copy `dexieSafetyStore` → `localSafetyStore` if one is there, set the flag `'localstorage'` → `'ok'`. The caller reloads.
  - `moveToDatabase(env: { storage: KeyValueStorage; openDb: () => Promise<OllieDb>; now: Date; allowQuarantine: boolean }): Promise<MoveResult>`: open, `runMove`. If ok: set the flag `'indexeddb'` and `MOVED_AT_KEY`, and remove `MOVE_STATUS_KEY`. The caller reloads.
  - `restoreIntoEmptyDatabase(db: OllieDb, storage: KeyValueStorage, json: string, now: Date): Promise<PreparedRestore>`: `prepareRestore`. If ok: `createDexieBackend(db).replaceAll({ ...data, monthlyIncome: data.monthlyIncome ?? 0 })`, `writeFolderPrefs`, then `setKv(db, 'schemaVersion', SCHEMA_VERSION)` and `setKv(db, 'migration', { at, source: 'backup', fingerprint: fingerprintLegacy(storage) })`.
  - `useOlderCopy(db: OllieDb, storage: KeyValueStorage, now: Date): Promise<MoveResult>` = `runMove(storage, db, { now, allowQuarantine: true })`.
  - `legacyBackupJson(storage: KeyValueStorage, privateFolder: FolderBackup | undefined, now: Date): string`: the same shape as `exportAllData`, built from `readLegacySnapshot` (`schemaVersion` = the stored localStorage version).
  - `quarantineText(items: QuarantineItem[]): string` = `JSON.stringify(items, null, 2)`
  - `formatBytes(n: number): string`: `< 1024` → `"N bytes"`; `< 1024²` → `"N KB"` (rounded); otherwise `"N.N MB"`.
- `StorageCard` (one card, Settings' existing card style):
  - **Where:** "This browser's database (since Nov 27)" (`movedAt`, `en-PH` short month + day) or "Simple browser storage".
  - **Kept:** `navigator.storage.persisted()` → "Your browser has promised to keep this data" / "Your browser may clear this data if space runs low" + **Ask to keep it** (`persist()`, then re-check).
  - **Space:** "Using {formatBytes(estimate.usage)}" (row hidden if unavailable).
  - The not-sync note (verbatim).
  - `blocked` → "N records need a look before Ollie can move your data", each as "name · field label · reason"; **Move anyway** (`moveToDatabase` with `allowQuarantine: true`, then reload) and **Copy them as text** (clipboard + toast "Copied").
  - `failedReason` → "Ollie couldn't move your data yet: {reason}" + **Try again**.
  - `oldCopyChanged` → "An older Ollie window changed the old copy after the move. Those changes aren't shown here." + **Save the old copy as a backup file** (`legacyBackupJson`, `ollie-old-copy-<dateSuffix>.json`).
  - On the database: **Move back to simple storage** → confirm dialog (`role="alertdialog"`), title "Move back to simple storage?", text "Ollie will copy everything you have now into the browser's simple storage and use that from now on. Nothing is deleted, and you can move to the database again later.", buttons Cancel / **Move back**. `'too-big'` → toast "Your data is too big for simple storage, so it stays in the database."
  - On simple storage with IndexedDB available and nothing blocked → **Move to the database**.
- `SaveFailedBanner`: shown while `saveFailed`; `role="alert"`, the verbatim copy, a **Back up** button that navigates to `/settings`. Rendered at the top of `AppShell`'s content.

- [ ] **Step 1: Write the failing tests:**
  - `moving back copies everything, and moving forward again gives the same data`: move, then make changes via the Dexie backend, then `moveBack` → `readLegacySnapshot` deep-equals the Dexie snapshot; flag `'localstorage'`. Then `moveToDatabase` → the Dexie snapshot is unchanged, and the flag is `'indexeddb'`.
  - `moving back waits for a change still being saved`: `persist(...)` without awaiting, then `moveBack` → the change is in localStorage.
  - `moving back that doesn't fit stays on the database`: storage whose `setItem` throws for data keys → `'too-big'`, flag still `'indexeddb'`, old keys unchanged.
  - `moving back carries the undo-restore copy`.
  - `restoring a file into an emptied database makes it usable again` → afterwards `bootstrap` returns `ready` on Dexie with the file's loans.
  - `using the older copy fills an emptied database` → `bootstrap` returns `ready` with the old keys' data.
  - `the old copy saves as a backup file that restores` → `prepareRestore(legacyBackupJson(...))` ok, with the same loan ids.
  - `formatBytes`: `512 → '512 bytes'`, `122880 → '120 KB'`, `5_400_000 → '5.1 MB'`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/storage/storageActions.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `storageActions.ts`, `download.ts` (move `downloadFile` and `dateSuffix` out of `SettingsPage.tsx` unchanged), `StorageCard`, `SaveFailedBanner`, the Settings/AppShell wiring, and the `RecoveryScreen` props in `main.tsx`. On success, both recovery actions reload. If the restore fails, the screen shows a message, and the same goes for the older copy.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/storage && npx tsc -b && npm run verify`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/storage src/utils src/pages/SettingsPage.tsx src/app/AppShell.tsx src/main.tsx src/features/backup/restore.ts
git commit -m "Add the Storage card, moving back and forth, recovery and the save warning"
```

---

### Task 10: End-to-end, docs, release note, full check

**Files:**
- Create: `tests/e2e/storage.spec.ts`
- Modify: `docs/ARCHITECTURE.md` (storage section: backends, flag, move, centavos), `docs/ROADMAP.md` (Phase 2 piece 1 done), `docs/PROGRESS.md` (entry + check counts), `CLAUDE.md`, `src/features/whatsNew/changelog.ts`

**Interfaces:**
- Consumes: the running app.
- Produces:
  - `CLAUDE.md`: in **Layout**, add `src/features/storage/` (backends, move, start-up, save queue). In **Rules**: data stores save only through `persist(change)`, never `localStorage` directly; the flag `loan-tracker-storage` picks the storage; the move never writes the old keys. In **Money**: "stored as integer centavos in the database (converted in `features/storage/centavos.ts`); app code works in pesos". Add to the browser-check rule that IndexedDB must also be empty.
  - Changelog `1.15.0`, date `2026-11-26`, title "Sturdier storage", highlights: "Ollie now keeps your loans, bills and savings in your browser's own database, which holds much more and saves each change safely." / "The move happens by itself the first time you open this version. Ollie checks every record before switching, and keeps your old copy." / "Settings has a new Storage card: where your data lives, whether your browser has promised to keep it, and how much space it uses." / "Your data still lives only on this device, so keep making backups."

- [ ] **Step 1: Write the failing e2e tests** in `storage.spec.ts`. Seed with `page.addInitScript` guarded by a `sessionStorage` marker, so a reload doesn't re-seed. Read the database with `page.evaluate` via the raw `indexedDB` API.
  - `a fresh visit lands on the database`: goto `/#/`; `localStorage['loan-tracker-storage'] === 'indexeddb'`; the `ollie` database exists.
  - `existing data moves and stays visible`: seed 2 synthetic loans + income in the old keys → goto `/#/` → both loan names visible, the move toast visible. The database `loans` count is 2, and the old keys still hold the seeded strings.
  - `a payment marked after the move survives a reload`: from the seeded state, open a loan, mark paid, reload → still shows 1 month paid.
  - `Settings shows the Storage card`: `/#/settings` shows "This browser's database" and the not-sync note.

- [ ] **Step 2: Run to verify they fail**, then pass

Run: `npx playwright test tests/e2e/storage.spec.ts`
Expected: passes if Tasks 1–9 are right. A failure here is a real defect. Debug it; don't loosen the test.

- [ ] **Step 3: Write the docs and changelog** per the Interfaces block.

- [ ] **Step 4: Full check**

Run: `npx tsc -b && npm run verify && npm run build && npm run test:e2e`
Expected: all clean. The unit count is 279 + new; e2e is 19 + 4 tests × projects (phone, desktop). The offline test passes. The build output lists `dexie` inside the main chunk.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/storage.spec.ts docs CLAUDE.md src/features/whatsNew/changelog.ts
git commit -m "Test the storage move end to end and document it"
```
