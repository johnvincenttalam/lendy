# Private Folder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One owner-named, PIN-locked folder whose loans are hidden from every screen, number and reminder, like Archive.

**Architecture:** A `private?: boolean` mark on `Loan`, filtered everywhere through one `isTracked()` helper. A small zustand store holds the folder name, PIN hash and an in-memory `unlocked` flag. A `/private` route shows setup → PIN pad → loan list; the app relocks it whenever the route leaves private territory or the app is backgrounded.

**Tech Stack:** React 19, TypeScript, Zustand, react-router-dom (HashRouter), Tailwind v4, Vitest (node environment — no DOM, no localStorage in tests).

**Spec:** `docs/superpowers/specs/2026-11-24-private-folder-design.md`

## Global Constraints

- Nothing outside the unlocked folder may reveal private loans: no counts, badges, totals, reminders, search hits, Ollie messages or calendar dots.
- The folder PIN is 4 digits, stored only as a SHA-256 hex hash (same as `lockStore`), in its own localStorage key.
- `unlocked` is never persisted.
- Backups (`exportAllData`) include private loans; `exportCSV` excludes them.
- Copy: sentence case, folder name shown verbatim wherever the folder is named. Default label before setup: "Private folder".
- Flat style: use existing tokens (`bg-card`, `bg-page`, `text-primary`, `text-muted`, `bg-brand`), no shadows.

## Review Focus

1. A private loan that is also overdue — must not trigger the Ollie overdue message, a notification, or the Health score. (Task 1 test: `selectOllieSituation` with an overdue private loan returns `greeting`/`relaxed`.)
2. Opening `#/loan/<private id>` directly (history, typed link) while locked — must show the PIN pad, never the loan. (Task 3: guard in `LoanDetailsPage`; `isPrivatePath` test.)
3. Navigating from the folder into a private loan and back — must not relock in between. (Task 2 test: `isPrivatePath('/loan/p1', loans)` is true for a private loan, false for a normal one.)
4. Forgot PIN with app lock off — no button may reveal or delete loans. (Task 3: "Forgot PIN" only rendered when `useLockStore.getState().enabled`.)
5. Folder name blank or whitespace — falls back to "Private folder"; names over 24 chars are trimmed. (Task 2 test: `folderLabel`.)

---

### Task 1: The private mark and one filter for "tracked" loans

**Files:**
- Modify: `src/features/loans/loanTypes.ts` (add `private?: boolean`)
- Modify: `src/features/loans/loanUtils.ts` (add `isTracked`; use it at the 5 `!l.archived` / `loan.archived` sites)
- Modify: `src/features/finance/financeUtils.ts:16,250`
- Modify: `src/features/ollie/ollieUtils.ts:46,86,106,167`
- Modify: `src/features/notifications/useNotificationCheck.ts:26`
- Modify: `src/pages/Dashboard.tsx:73-135` (active list and the Archive filter/count both exclude private)
- Modify: `src/pages/AnalyticsPage.tsx:143`, `src/pages/CalendarPage.tsx:28,68`, `src/pages/SettingsPage.tsx:41`
- Modify: `src/features/loans/loanStore.ts` (actions `makePrivate`, `makePublic`; `exportCSV` skips private)
- Test: `src/features/loans/loanUtils.test.ts` (new), `src/features/ollie/ollieUtils.test.ts`

**Interfaces:**
- Produces: `isTracked(loan: Loan): boolean` — `!loan.archived && !loan.private`
- Produces: store actions `makePrivate(id: string): void` and `makePublic(id: string): void`. Both toast `"<loan name>" moved` — generic on purpose, so a toast never names the folder.

- [ ] **Step 1: Write failing tests**

`loanUtils.test.ts`:
- `isTracked` → false for `{private: true}`, false for `{archived: true}`, true otherwise.
- `debtFreeDate([publicLoan, privateLoanEndingLater])` equals publicLoan's end date.
- `getOverdueLoans([overduePrivateLoan])` → `[]`; `upcomingPayments([privateLoanDueTomorrow])` → `null`.

`ollieUtils.test.ts`:
- `it('never mentions private loans')`: `loans: [makeLoan({ id: 'secret', startDate: dayOffset(-5), private: true })]`, `greetingEligible: true` → `kind` is `'greeting'` and `hasLoans` is `false`.

- [ ] **Step 2: Run** `npx vitest run src/features/loans src/features/ollie` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** the type, `isTracked`, and replace every loan `archived` check listed above with it (bills/savings `archived` checks stay untouched). In Dashboard, `archivedLoans` becomes `loans.filter((l) => l.archived && !l.private)`, and the search/filter base list drops private loans first.
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc -b` — Expected: all pass, no type errors.
- [ ] **Step 5: Commit** — `git commit -m "Add a private mark that hides loans everywhere, like archive"`

---

### Task 2: Folder store, shared PIN pad, and route helpers

**Files:**
- Create: `src/features/privateFolder/privateFolderStore.ts`
- Create: `src/features/privateFolder/privateFolderUtils.ts`
- Create: `src/features/privateFolder/privateFolderUtils.test.ts`
- Create: `src/features/lock/PinPad.tsx` (extracted from `PinScreen.tsx`: dots, shake, keypad)
- Modify: `src/features/lock/PinScreen.tsx` (use `PinPad`); `src/features/lock/lockStore.ts` (export `hashPin`)

**Interfaces:**
- Produces (`privateFolderUtils.ts`, pure):
  - `DEFAULT_FOLDER_LABEL = 'Private folder'`, `MAX_FOLDER_NAME = 24`
  - `folderLabel(name: string | null): string` — trimmed name, cut to 24 chars, or the default when blank/null.
  - `isPrivatePath(pathname: string, loans: Loan[]): boolean` — true for `/private` and for `/loan/:id` when that loan is private.
- Produces (`privateFolderStore.ts`, `usePrivateFolderStore`):
  - state `name: string | null`, `pinHash: string | null`, `unlocked: boolean`; derived `isSetUp = pinHash !== null`
  - `setUp(name: string, pin: string): Promise<void>` (sets `unlocked: true`)
  - `unlock(pin: string): Promise<boolean>`, `lock(): void`
  - `rename(name: string): void`
  - `changePin(pin: string): Promise<void>` (callers verify the old PIN first)
  - localStorage keys `loan-tracker-private-name`, `loan-tracker-private-pin-hash`
- Produces: `<PinPad title subtitle error onComplete={(pin) => void} footer?: ReactNode icon?: ReactNode />` — clears itself after `onComplete`; shakes when `error` flips true.

- [ ] **Step 1: Write failing tests** in `privateFolderUtils.test.ts`:
  - `folderLabel(null)` and `folderLabel('   ')` → `'Private folder'`; `folderLabel('  Receipts ')` → `'Receipts'`; a 30-char name → length 24.
  - `isPrivatePath('/private', [])` → true; `isPrivatePath('/loan/p1', [privateLoan p1])` → true; `isPrivatePath('/loan/n1', [normalLoan n1])` → false; `isPrivatePath('/', ...)` → false.
- [ ] **Step 2: Run** `npx vitest run src/features/privateFolder` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the utils, the store (pattern of `lockStore.ts`), and `PinPad`; rewire `PinScreen` onto `PinPad` with no visual change.
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc -b` — Expected: pass.
- [ ] **Step 5: Commit** — `git commit -m "Add the private folder store and a shared PIN pad"`

---

### Task 3: The folder screen, locking, and guarding loan links

**Files:**
- Create: `src/pages/PrivateFolderPage.tsx`
- Create: `src/features/privateFolder/PrivateFolderSetup.tsx` (name field + PIN twice via `PinPad`)
- Create: `src/features/privateFolder/PrivateFolderGate.tsx` (PIN pad + "Forgot PIN" flow)
- Modify: `src/App.tsx` (route `/private`; effect that calls `lock()` when `!isPrivatePath(pathname, loans)`; `visibilitychange` → hidden → `lock()`)
- Modify: `src/pages/LoanDetailsPage.tsx` (private loan + locked → render `PrivateFolderGate`)
- Modify: `src/pages/MorePage.tsx` (row: `folderLabel(name)`, Lock icon, description "Locked with its own PIN", no count; navigates to `/private`)

**Interfaces:**
- Consumes: `usePrivateFolderStore`, `folderLabel`, `isPrivatePath` (Task 2); `isTracked`, `makePublic` (Task 1); `useLockStore` `enabled`, `verifyPin`.
- Produces: `<PrivateFolderGate />` — renders nothing once unlocked; `<PrivateFolderSetup onDone={() => void} />`.

- [ ] **Step 1: Build `PrivateFolderPage`:** not set up → `PrivateFolderSetup`; locked → `PrivateFolderGate`; unlocked → `PageHeader` (title `folderLabel(name)`, back button, `HeaderIconButton` with Lock icon that calls `lock()` and navigates to `/more`) + private loans as `LoanCard` list, or `EmptyState` mood `relaxed`, title "Nothing in here yet", subtitle "Open a loan and choose Move to {label} from its menu."
- [ ] **Step 2: Forgot PIN:** shown under the PIN pad only when the app lock is enabled. It swaps the pad to "Enter your app PIN"; on success, the pad asks for a new folder PIN twice, then `changePin` and unlock. With the app lock off, no link is shown.
- [ ] **Step 3: Locking + guard** in `App.tsx` and `LoanDetailsPage.tsx` as listed.
- [ ] **Step 4: Verify in the browser** (dev server, 375px): set up "Receipts" + PIN; More shows "Receipts"; folder opens after PIN; a private loan opens from the folder without a second PIN; going to Home and back asks again; pasting `#/loan/<id>` asks for the PIN; wrong PIN shakes. Remove the test folder keys from localStorage afterwards.
- [ ] **Step 5: Run** `npx tsc -b && npx vitest run` — pass. **Commit** — `git commit -m "Add the private folder screen with its own PIN"`

---

### Task 4: Moving loans in and out, Settings, and release notes

**Files:**
- Modify: `src/features/loans/LoanDetails.tsx` (⋯ menu item, confirm sheet)
- Create: `src/features/privateFolder/PrivateFolderSettings.tsx`; Modify: `src/pages/SettingsPage.tsx` (render it under the app lock setting)
- Modify: `src/features/whatsNew/changelog.ts` (new version entry)

**Interfaces:**
- Consumes: `makePrivate`, `makePublic` (Task 1); store + `folderLabel` + `PrivateFolderSetup` (Tasks 2–3).

- [ ] **Step 1: Menu:** non-private loan → "Move to {label}" (Lock icon). If the folder isn't set up, open `PrivateFolderSetup` first, then move. After moving, navigate to `/` (the loan is gone from the borrower view). Private loan → "Move out of {label}" (LockOpen icon) → `makePublic`, stay on the page. Archive/Delete keep working for private loans.
- [ ] **Step 2: Settings section** "Private folder": not set up → button "Set up"; set up → name input (max 24, saved on blur, `folderLabel` fallback) and "Change PIN" (current PIN via `PinPad`, then new PIN twice).
- [ ] **Step 3: Changelog:** add the next minor version dated 2026-11-24, title "A private folder", highlights: "Move loans into a folder only you can open, with its own PIN." / "Name the folder whatever you like." / "Loans in it stay out of your totals, reminders and Ollie."
- [ ] **Step 4: Verify in the browser:** move a loan in → it disappears from Home totals, Calendar, Analytics; move it out → it returns. Rename in Settings → More row updates. Clean up test data.
- [ ] **Step 5: Run** `npx tsc -b && npx vitest run && npm run build` — pass. **Commit** — `git commit -m "Let loans move into the private folder and manage it in Settings"`
