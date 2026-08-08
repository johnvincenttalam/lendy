# Loan Notes Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional free-text `notes` field to loans so the user can record what a loan is for, visible on the loan detail page and searchable from the dashboard.

**Architecture:** `notes?: string` is added to the `Loan` type. Because the store's load/add/update/export/import paths all spread whole objects rather than naming fields individually, the new field flows through the existing data layer with zero store-logic changes — only the UI (form input, detail-page display, dashboard search) and the CSV exporter need edits.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind v4 (via the existing `.input-field` CSS class and Tailwind utility classes), Zustand store (`useLoanStore`).

## Global Constraints

- `notes` is always optional — never add a validation error for it, and never block form submission on it.
- Cap input at 300 characters via the textarea's `maxLength` attribute (client-side only; this app has no backend).
- The new `Notes` CSV column must be **appended** at the end of the existing header/row arrays — never inserted or reordered — so any existing column-position assumptions on already-exported files stay valid.
- Do **not** touch `LoanCard.tsx` (list or grid view) — notes are intentionally detail-page-only, per the approved spec.
- Do **not** touch Analytics or Calendar pages — out of scope per the approved spec.
- This project has no automated test runner (no `test` script in `package.json`). "Testing" a step means: `npx tsc -b` and `npx eslint <file>` both exit clean, plus the manual browser verification described in each task.
- Reference spec: `docs/superpowers/specs/2026-08-08-loan-notes-design.md`.

---

### Task 1: Add `notes` to the `Loan` type

**Files:**
- Modify: `src/features/loans/loanTypes.ts:1-16`

**Interfaces:**
- Produces: `Loan.notes?: string` — every later task reads/writes this field. `LoanFormData` (line 29: `Omit<Loan, 'id' | 'monthsPaid' | 'totalPaid' | 'totalInterestPaid' | 'createdAt'>`) automatically includes it since it isn't in the omit list — no separate edit needed there.

- [ ] **Step 1: Add the field**

In `src/features/loans/loanTypes.ts`, change:

```ts
export type Loan = {
  id: string
  name: string
  color: string
  tag?: string
  totalAmount: number
```

to:

```ts
export type Loan = {
  id: string
  name: string
  color: string
  tag?: string
  notes?: string
  totalAmount: number
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: no errors (existing loans in `localStorage`/mock data lack `notes`, but since it's optional this is valid — nothing else references `Loan` exhaustively in a way that would break).

- [ ] **Step 3: Commit**

```bash
git add src/features/loans/loanTypes.ts
git commit -m "Add optional notes field to Loan type"
```

---

### Task 2: Add the Notes input to `LoanForm`

**Files:**
- Modify: `src/features/loans/LoanForm.tsx:57` (state), `:315-325` (JSX placement), `:95-104` (submit payload)

**Interfaces:**
- Consumes: `Loan.notes?: string` from Task 1.
- Produces: `LoanForm`'s `onSubmit` payload now includes `notes: string | undefined`, which `Dashboard.tsx`'s `addLoan`/`updateLoan` callers pass straight through to the store (no change needed there — they already forward whatever `onSubmit` gives them).

- [ ] **Step 1: Add state for the field**

In `src/features/loans/LoanForm.tsx`, immediately after the `startDate` state declaration:

```tsx
  const [startDate, setStartDate] = useState(initial?.startDate ?? new Date().toISOString().split('T')[0])
```

add:

```tsx
  const [notes, setNotes] = useState(initial?.notes ?? '')
```

- [ ] **Step 2: Render the field after Start Date, before the summary card**

Find this block (the closing of the Start Date `Field` and the start of the auto-calc summary):

```tsx
          <Field label="Start Date" id="loan-start-date" error={errors.startDate}>
            <input
              id="loan-start-date"
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); clearError('startDate') }}
              aria-invalid={!!errors.startDate}
              aria-describedby={errors.startDate ? 'loan-start-date-error' : undefined}
              className="input-field"
            />
          </Field>

          {canAutoCalc && (
```

Insert a new `Field` between them, so it reads:

```tsx
          <Field label="Start Date" id="loan-start-date" error={errors.startDate}>
            <input
              id="loan-start-date"
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); clearError('startDate') }}
              aria-invalid={!!errors.startDate}
              aria-describedby={errors.startDate ? 'loan-start-date-error' : undefined}
              className="input-field"
            />
          </Field>

          <Field label="Notes" id="loan-notes">
            <textarea
              id="loan-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What's this loan for? (optional)"
              maxLength={300}
              rows={3}
              className="input-field resize-none"
            />
          </Field>

          {canAutoCalc && (
```

(`Field`'s `error` prop is simply omitted here since notes are never invalid — `Field`'s type already declares `error?: string`, so this is valid as-is.)

- [ ] **Step 3: Include it in the submit payload**

Find in `handleSubmit`:

```tsx
    onSubmit({
      name: name.trim(),
      color,
      tag: tag || undefined,
      totalAmount: isInstallment ? monthly * months : amt,
      interestRate: isInstallment ? 0 : rate,
      monthlyPayment: monthly,
      durationMonths: months,
      startDate,
    })
```

Change to:

```tsx
    onSubmit({
      name: name.trim(),
      color,
      tag: tag || undefined,
      notes: notes.trim() || undefined,
      totalAmount: isInstallment ? monthly * months : amt,
      interestRate: isInstallment ? 0 : rate,
      monthlyPayment: monthly,
      durationMonths: months,
      startDate,
    })
```

(`.trim() || undefined` matches the exact pattern already used for `tag` two lines above, so an all-whitespace note is stored as absent, keeping `loan.notes` truthy-checkable everywhere it's read.)

- [ ] **Step 4: Verify it compiles and lints**

Run: `npx tsc -b && npx eslint src/features/loans/LoanForm.tsx`
Expected: no errors.

- [ ] **Step 5: Manual check**

Run `npm run dev`, open the app, click the add-loan (+) button, confirm a "Notes" textarea appears below "Start Date" with placeholder "What's this loan for? (optional)", type more than 300 characters and confirm it stops accepting input at 300, then fill in the required fields and submit. No further check needed yet — display verification happens in Task 3.

- [ ] **Step 6: Commit**

```bash
git add src/features/loans/LoanForm.tsx
git commit -m "Add optional Notes field to the loan form"
```

---

### Task 3: Show notes on the loan detail page

**Files:**
- Modify: `src/features/loans/LoanDetails.tsx:242-244`

**Interfaces:**
- Consumes: `loan.notes?: string` (the `loan: Loan` prop `LoanDetails` already receives).

- [ ] **Step 1: Insert a conditional Notes card**

Find the boundary between the hero balance card and the Interest card:

```tsx
            )}
          </div>
        </div>

        {/* Interest overview */}
        {hasInterest && (
```

Insert a new card between the hero card's closing `</div>` and the Interest comment, so it reads:

```tsx
            )}
          </div>
        </div>

        {loan.notes && (
          <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-1.5">Notes</p>
            <p className="text-[13px] text-secondary whitespace-pre-wrap leading-relaxed">{loan.notes}</p>
          </div>
        )}

        {/* Interest overview */}
        {hasInterest && (
```

(`whitespace-pre-wrap` preserves any line breaks the user typed; the card is only rendered when `loan.notes` is a non-empty string, so loans without notes show nothing here — no empty-state clutter.)

- [ ] **Step 2: Verify it compiles and lints**

Run: `npx tsc -b && npx eslint src/features/loans/LoanDetails.tsx`
Expected: no errors.

- [ ] **Step 3: Manual check**

In the running app, open a loan that has no notes yet, confirm no "Notes" card appears. Edit it, add a note with two lines (press Enter inside the textarea), save, and confirm the detail page now shows a "Notes" card between the balance card and the Interest card (or Info grid, if the loan has 0% interest) with both lines preserved.

- [ ] **Step 4: Commit**

```bash
git add src/features/loans/LoanDetails.tsx
git commit -m "Show loan notes on the detail page"
```

---

### Task 4: Make the dashboard search match notes text

**Files:**
- Modify: `src/pages/Dashboard.tsx:112-115`

**Interfaces:**
- Consumes: `loan.notes?: string`.

- [ ] **Step 1: Extend the filter predicate**

Find:

```tsx
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((l) => l.name.toLowerCase().includes(q))
    }
```

Change to:

```tsx
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((l) => l.name.toLowerCase().includes(q) || (l.notes ?? '').toLowerCase().includes(q))
    }
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `npx tsc -b && npx eslint src/pages/Dashboard.tsx`
Expected: no errors.

- [ ] **Step 3: Manual check**

Give a loan a note containing a distinctive word (e.g. "laptop"). On the dashboard, type that word into "Search loans..." and confirm the loan appears even though the word isn't in its name. Clear the search and confirm all loans return.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "Include notes text in dashboard loan search"
```

---

### Task 5: Append notes to CSV export

**Files:**
- Modify: `src/features/loans/loanStore.ts:311-326`

**Interfaces:**
- Consumes: `loan.notes?: string`.

- [ ] **Step 1: Add the column**

Find:

```ts
  exportCSV: () => {
    const { loans } = get()
    const headers = ['Name', 'Total Amount', 'Monthly Payment', 'Interest Rate (%/mo)', 'Duration (months)', 'Months Paid', 'Total Paid', 'Start Date', 'Status']
    const rows = loans.map((l) => [
      `"${l.name}"`,
      l.totalAmount.toFixed(2),
      l.monthlyPayment.toFixed(2),
      l.interestRate.toString(),
      l.durationMonths.toString(),
      l.monthsPaid.toString(),
      l.totalPaid.toFixed(2),
      l.startDate,
      l.monthsPaid >= l.durationMonths ? 'Paid' : 'Active',
    ])
    return [headers, ...rows].map((r) => r.join(',')).join('\n')
  },
```

Change to:

```ts
  exportCSV: () => {
    const { loans } = get()
    const headers = ['Name', 'Total Amount', 'Monthly Payment', 'Interest Rate (%/mo)', 'Duration (months)', 'Months Paid', 'Total Paid', 'Start Date', 'Status', 'Notes']
    const rows = loans.map((l) => [
      `"${l.name}"`,
      l.totalAmount.toFixed(2),
      l.monthlyPayment.toFixed(2),
      l.interestRate.toString(),
      l.durationMonths.toString(),
      l.monthsPaid.toString(),
      l.totalPaid.toFixed(2),
      l.startDate,
      l.monthsPaid >= l.durationMonths ? 'Paid' : 'Active',
      `"${(l.notes ?? '').replace(/"/g, '""')}"`,
    ])
    return [headers, ...rows].map((r) => r.join(',')).join('\n')
  },
```

`Notes` is appended as the last column (never inserted earlier), and internal `"` characters are doubled per RFC 4180 CSV escaping — notes are free text and far more likely than a short loan name to contain a comma or quote, which would otherwise corrupt the row. (The pre-existing `l.name` field has the same unescaped-quote gap, but fixing that is unrelated to this feature — flag it separately rather than folding it into this task.)

- [ ] **Step 2: Verify it compiles and lints**

Run: `npx tsc -b && npx eslint src/features/loans/loanStore.ts`
Expected: no errors.

- [ ] **Step 3: Manual check**

Give one loan a note containing a comma and a quote character, e.g. `Gift for mom's birthday, paid in cash`. In Settings, trigger the CSV export/download, open the file, and confirm: the header row ends with `Notes`, that loan's row has the note correctly quoted with the embedded `"` doubled and the comma inside the quoted field (not splitting into an extra column), and loans without notes show an empty `""` at the end of their row.

- [ ] **Step 4: Commit**

```bash
git add src/features/loans/loanStore.ts
git commit -m "Include notes column in CSV export"
```

---

### Task 6: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck and lint pass**

Run: `npx tsc -b && npx eslint .`
Expected: no errors across the whole project.

- [ ] **Step 2: Full manual walkthrough**

In the running app:
1. Add a new loan, filling in a note. Confirm it saves without error and does **not** appear on its card in the dashboard list (list or grid view).
2. Open that loan's detail page and confirm the note appears in its own card, in the right position (after the balance card, before Interest/Info grid).
3. Edit the loan, clear the note field entirely, save, and confirm the Notes card disappears from the detail page.
4. Edit again, add a new note, save, search for a word from that note on the dashboard, and confirm the loan surfaces.
5. Export CSV from Settings and confirm the `Notes` column is present and correctly populated for loans with and without notes.
6. Export/import a full JSON backup (Settings) and confirm notes survive the round trip.

- [ ] **Step 3: Final commit (only if any fixes were needed in this task)**

```bash
git add -A
git commit -m "Fix issues found in end-to-end notes verification"
```
