# Private folder — design

## Intent

The owner sometimes lends their phone to someone else. Some loans should be
invisible to that person — not just hidden from view, but absent from every
number, reminder and screen — unless they know a separate code.

## Goals

- One folder, named by the owner (e.g. "Receipts"), locked with its own PIN.
- Loans moved into it behave like archived loans: left out of dashboard
  totals, Ollie, Calendar, Analytics, Money, notifications and search.
- Inside the folder the loans work normally: view details, mark paid, edit,
  move back out.

## Non-goals

- Several folders, or one PIN per loan.
- Protecting against someone reading the browser's stored data or a backup
  file. The threat is a casual borrower using the app's own screens.
- Reminders for private loans (chosen: option B — fully hidden, like Archive).

## Anti-goals

- Anything that hints at how many private loans exist, or how much is owed,
  while the folder is locked (counts, badges, a larger "Left to pay").
- A private loan reachable by opening its `/loan/:id` link without the PIN.

## Approaches

1. **A `private` mark on the loan, filtered like `archived`** — *chosen.*
   Reuses every existing path (pay, edit, details, backup). One shared helper
   replaces the scattered `!l.archived` checks so no screen can forget it.
2. Separate store for private loans — never seen by existing screens, but
   payments, editing, details and backup would all need duplicating.
3. Encrypting private loans with the PIN — guards against data inspection
   the owner doesn't need, and a forgotten PIN destroys the loans.

## Design (as decided)

- **Data:** `Loan.private?: boolean`. Store actions `makePrivate(id)` /
  `makePublic(id)`, each with a toast. Archived and private are independent.
- **One helper:** `isTracked(loan) = !loan.archived && !loan.private` in
  `loanUtils.ts`. Every current `!l.archived` loan filter switches to it:
  `loanUtils` (5), `financeUtils` (2), `ollieUtils` (4),
  `useNotificationCheck`, Dashboard, Analytics, Calendar, Settings' monthly
  total. The Dashboard's Archive filter and count exclude private loans too.
- **Folder settings store** (`features/privateFolder/`): folder name and the
  PIN as a SHA-256 hash, in their own localStorage keys — same pattern as
  `lockStore`. An `unlocked` flag that lives only in memory.
- **Locking:** the folder relocks when you leave the folder (or a private
  loan's details), when the app goes to the background, and on reload.
- **Entry point:** a row in More with the owner's chosen name and a lock
  icon — no count. If the folder isn't set up, the row reads "Private folder"
  and opens setup (name + PIN, PIN entered twice).
- **Route** `/private`: PIN pad (reusing the PinScreen look) → list of
  private loans using the normal LoanCard, with an empty state.
- **Loan menu:** LoanDetails' ⋯ menu gets "Move to [folder name]" or
  "Move out of [folder name]". The first time a loan is moved and no folder
  exists, setup runs first.
- **Guarding details:** `/loan/:id` for a private loan shows the PIN pad
  while the folder is locked.
- **Settings:** rename the folder and change its PIN (current PIN required).

## Calls I made (correct any)

- Backups and the full JSON export include private loans, so restoring never
  loses them. Someone could still export a backup and open the file — out of
  scope per the threat above.
- The CSV export leaves private loans out (it's a human-readable report).
- If no private loans exist the folder still shows in More once set up, so
  emptying it doesn't change what a borrower sees.

## Forgotten PIN (decided)

- If the app lock is on, "Forgot PIN" on the folder's PIN pad asks for the
  app PIN, then lets the owner set a new folder PIN.
- If the app lock is off, there is no reset: the loans stay in the folder
  until the PIN is remembered. No button ever reveals or deletes them.

## Addendum: optional PIN (requested during build)

- Settings gets a "Require PIN" switch for the folder.
- Turning it off asks for the current PIN, then forgets the PIN hash. With
  no PIN the folder opens directly, but its loans stay hidden everywhere
  else (an Archive the owner names).
- Turning it on chooses a new PIN (entered twice).
- Setup still asks for a PIN; it can be switched off afterwards.
- "Set up" now means the folder has a name record (possibly empty), not a
  PIN hash. More's description reads "Locked with its own PIN" or "Hidden
  from the rest of Ollie" to match.
