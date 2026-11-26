# Backup v2 (Phase 2, piece 2): sturdier file, preview, merge or replace

Date: 2026-11-27 · Roadmap: `docs/ROADMAP.md` Phase 2 · Branch: `feature/phase-2-backup-v2`
Piece 1 (IndexedDB storage move) is merged locally. Piece 3 (snooze/dismiss + activity log) follows.

## Intent

Today a backup can only replace everything on the device. There are real
cases for combining instead. The owner's two live sites (Vercel and GitHub
Pages) keep separate data. Piece 1's "Save the old copy as a backup file"
holds changes an older window made, and those need bringing back in without
wiping newer work. A file can also simply be older than the phone. The owner
should see exactly what a file would do before anything changes, and nothing
should land twice.

## Owner's decisions

- The owner asked for my recommendation and accepted it. **Merge = add what's
  missing, and keep this phone's version when a record is in both.** One
  switch takes the file's version for every record that differs. Possible
  double entries are held back and listed.
- Merge is undoable exactly like replace (safety copy, 7 days).
- After the builder check, the owner chose to **keep the record-level rule as
  designed** for records in both places. They declined per-record ticks and
  merging inside a record. The preview must therefore say plainly, record by
  record, what keeping this phone's version leaves out (see Preview).

## Goals

1. A new backup file format (v2): what made it, a section per module, and a
   check value that catches a damaged or edited file.
2. Files from before (v0 without a version, v1 with `schemaVersion`) keep restoring.
3. A preview before anything changes, with per-area counts and the choice of
   merge or replace.
4. Merge as decided above. Exact repeats are skipped. Records in both but
   different keep this phone's version, unless the switch says otherwise.
   Likely double entries are held back.
5. Replace stays as today, and the preview now says what it would remove.

## Non-goals

- Choosing record by record.
- "Newest change wins": records have no last-changed time. Revisit in Phase 3.
- Encrypted backups, cloud sync, automatic scheduled backups.
- Merging set-aside (quarantined) records automatically. They ride along in
  the file under `setAside` and are shown, not imported.

## Anti-goals

- Any record lost or changed without the owner seeing it in the preview first.
- A merge that leaves a loan disagreeing with its payments, a bill with its
  payment history, or a goal with its deposits.
- A file the app made being refused by the same version of the app.

## Approaches considered

1. **Add what's missing; this phone wins; one switch for "use the file's"
   (chosen).** Predictable and never overwrites by surprise; the undo copy
   covers mistakes.
2. **Per-record choice in the preview.** Most control, but a long screen of
   decisions for a one-person app. The switch plus undo covers the need.
3. **Newest change wins.** Needs a last-changed time on every record, which
   the data doesn't have. Older records would be guesses.

## Design

### File format v2

```json
{
  "format": "ollie-backup",
  "formatVersion": 2,
  "schemaVersion": 1,
  "appVersion": "1.16.0",
  "exportedAt": "2026-11-27T08:00:00.000Z",
  "checksum": { "algorithm": "SHA-256", "value": "<hex>" },
  "data": {
    "loans":   { "loans": [], "payments": [] },
    "bills":   { "bills": [], "billPayments": [] },
    "savings": { "savingsGoals": [], "savingsTransactions": [] },
    "finance": { "monthlyIncome": 30000 },
    "privateFolder": { "name": "…", "pinHash": "…", "recoveryHash": null },
    "setAside": []
  }
}
```

- **Section keys** are the module ids from `src/app/modules.ts` (loans, bills,
  savings, finance), so future modules add their own section. `privateFolder`
  and `setAside` are top-level parts of `data`. `setAside` is written only when
  there are set-aside records (the old-copy file from piece 1).
- **`schemaVersion`** stays the *data* version (the `MIGRATIONS` chain);
  `formatVersion` is the envelope. Reading a v2 file unwraps `data` into the
  flat shape v1 files already have (`loans`, `payments`, `monthlyIncome`, …),
  then runs today's `migrateSnapshot`. So v0, v1 and v2 share one path after
  unwrapping, and `SCHEMA_VERSION` does not change.
- **`appVersion`** = `CURRENT_VERSION` from the changelog. It's shown in the
  preview ("Made by Ollie 1.16.0 on Nov 27, 2026").
- **Checksum** = SHA-256 (`crypto.subtle.digest`) of `JSON.stringify(data)` (no
  spacing), hex. Reading re-stringifies the parsed `data`, so the file's
  pretty-printing doesn't matter. A mismatch or a missing checksum on a v2 file
  shows a warning ("This file was changed or damaged since Ollie made it. Look
  it over before going on.") and still allows going on; it detects damage, it
  isn't security. v0/v1 files have no checksum, and the preview says nothing
  about it for them.
- **A newer file** (`formatVersion` > 2 or `schemaVersion` > `SCHEMA_VERSION`)
  is refused, as today, with the existing "newer version" message.
- **Unknown sections** in `data` (from a later module) are ignored, and the
  preview says "Some parts of this file are for a newer Ollie and were left
  out."
- Export (`exportAllData`) writes v2. CSV is unchanged. Piece 1's old-copy file
  (`legacyBackupJson`) also writes v2, using the old copy's stored data
  version, and including `setAside`.

### Reading a file (`prepareRestore`)

Unchanged in spirit: parse, unwrap (v2), migrate, validate every record with
the zod schemas, skip unreadable records and repeated ids (counted), drop
children whose parent was dropped. It additionally returns file info:
`{ formatVersion, appVersion | null, exportedAt | null, checksum: 'ok' | 'mismatch' | 'missing' | 'none', unknownSections: boolean, setAside: number }`.
`'none'` means a v0/v1 file.

### Planning a merge (`planMerge`, pure)

Input: the device snapshot (pesos) + the device's folder settings + the prepared
file data. Output: the full next snapshot, plus counts and lists for the
preview. Per parent type (loans, bills, savings goals):

- **New:** the id isn't on the device. It's added at the end, in file order,
  together with its children from the file. Exception: a *possible double
  entry* is held back unless "Add them anyway" is on. That means its match
  key equals a device record that has a different id:
  - loan: name (trimmed, case-folded) + totalAmount + startDate
  - bill: name + amount + category
  - goal: name + targetAmount
- **Already here:** same id, and the record plus its children are deep-equal
  (ignoring key order). Nothing changes.
- **Different:** same id, and the record or its children differ. By default
  this phone's record *and its children* are kept. With "Use the file's version
  for records that differ" on, the file's record *and its children* replace
  this phone's (device children of that parent that aren't in the file are
  removed). Children always follow their parent, so a loan and its payments
  never mix sources.
- Device records that aren't in the file are always kept in merge.

**Comparing children of v0 files:** v0 files have no payment history, and it's
rebuilt on every read with new random ids. So a loan's payments compare by
`(loanId, month, amount)` when the file is v0. Otherwise they compare by id
and content. (My call.)

Other parts:
- **Monthly income:** keep the device's, unless it's 0 and the file has one.
  With the switch on, the file's (when it has one).
- **Private folder settings:** keep the device's if it has a folder. If not,
  take the file's (so private loans arrive locked). Private loans themselves
  follow the record rules. If this phone's folder has no PIN, the file's has
  one, and the file brings private loans, the preview warns: "Private loans
  from this file will be in your private folder, which has no PIN on this
  phone." (My call: the owner chose no PIN on this phone, so it isn't
  overridden silently.)
- **Last-backup date:** a merge does *not* mark the device as backed up (the
  device now holds more than the file). Replace still does, as today.

The plan's counts per area are: new, already here, different,
possible duplicates (with names), and, from `prepareRestore`, unreadable.
Replace also reports what it would remove: device records not in the file.

### Applying

Both modes go through today's `writeRestore(active, data, now)`. For merge,
`data` is the plan's full next snapshot, so the safety copy, all-or-nothing
replace and undo work unchanged on either storage. `applyRestore` gains a
mode, used only for the toast text ("Merged: 2 loans added, 1 kept as it
was" / today's "… restored") and the last-backup rule above.

### Preview (replaces today's confirmation dialog)

Built on the existing `Sheet` (dialog, Escape, focus). Sketch:

```
Restore backup
Made by Ollie 1.16.0 on Nov 27, 2026          (v0/v1: "Made by an earlier Ollie")
⚠ This file was changed or damaged since Ollie made it. Look it over before going on.   (only if so)

            New   Already here   Different
Loans         2        5             1
Bills         0        3             0
Savings       1        1             0
Monthly income: keeping ₱30,000 (the file has ₱25,000)

Different, keeping this phone's version:
  "Laptop" loan: the file has 1 payment this phone doesn't (Nov 15); other details differ
  "Fund" goal: other details differ

Possible double entries, held back:
  "Phone" loan: same name, amount and start date as one you have
  [ ] Add them anyway

(•) Merge: add what's missing and keep this phone's version of the rest
( ) Replace: make this phone match the file (removes 3 loans, 1 bill)

[ ] Use the file's version for the 1 record that's different

2 records in the file couldn't be read and will be left out.
4 records Ollie set aside are in this file; they aren't imported.

            [Cancel]  [Merge]          (button says Replace / Restore to match)
```

- **"Different" records are listed one by one** with what keeping this phone's
  version leaves out. The file's extra children are counted and dated: "the
  file has 2 payments this phone doesn't (Nov 15, Dec 15)". The phone's
  extra children are counted the other way. "other details differ" appears
  when the record's own fields differ. With the switch on, the line flips to
  what this phone loses.
- **Private records are counted but never named** in the preview (CLAUDE.md:
  private loans stay out of everything outside the folder). They appear as
  "a private loan" in lists, and as "including 1 private loan" in counts. (My call.)
- With an empty device, there's no mode choice: the preview shows "New" counts and a **Restore** button.
- With data on the device, **Merge is the default**: it never removes anything.
- Rows and lines with nothing to say are hidden.
- The switches show only when they'd change something.
- The numbers update when a switch or the mode changes. The plan is recomputed, which is cheap.

## Constraints

- `api/ask.ts` untouched. No new dependency (`crypto.subtle` is built in).
  Validation stays lazy-loaded (the preview is in the Settings chunk).
- Device data shape and `SCHEMA_VERSION` unchanged.
- Works offline; precache picks up new chunks.
- Tests use synthetic records only.

## Testing

- Unit:
  - The envelope round trip (export → prepare → same data).
  - Checksum ok / mismatch (edit one amount) / missing.
  - v0 and v1 fixtures still restore.
  - A newer `formatVersion` is refused.
  - Unknown sections are ignored and flagged.
  - `setAside` is counted, not imported.
- `planMerge`:
  - Each class (new, already here, different).
  - Children follow their parent both ways.
  - A possible duplicate is held back, then added with the switch.
  - Income and folder rules.
  - Order is kept (new records at the end, in file order).
  - Merging a file into an identical device changes nothing.
  - Merging twice is the same as once.
  - Private loans stay private.
- `applyRestore` merge mode: an undo puts back the device exactly; the last-backup date is not set by merge.
- Playwright: export a backup, add a loan, restore that file with Merge → both
  the old and new loans are shown; restore with Replace → only the file's.

## Sections

The four sections are a fixed list for now. Letting each module declare its
own backup section (parent/child lists, duplicate key, merge rule) waits until
Phase 3 brings the next module; the format already leaves room for it. (My
call: keeps this piece small; the registry's `module.ts` files import UI, so
hooks need their own light files when they come.)

## Left to the builder

File layout under `src/features/backup/`; the preview's exact layout within
the app's existing style; how deep-equality is computed; how the toast words
counts beyond the examples.

## Calls I made (flag if wrong)

- Merge is the default when the device has data; replace needs choosing.
- Children always follow their parent's source.
- Possible double entries are held back by default, with one "Add them anyway" switch.
- Income: the device's wins unless it's 0. Folder settings: the device's win if it has a folder.
- A merge doesn't count as "backed up".
- A checksum mismatch warns but doesn't block.
- The envelope wraps the existing flat data; `SCHEMA_VERSION` stays 1.
- Set-aside records in a file are shown, not imported.
- Private records are counted but never named in the preview.
- A folder-PIN mismatch warns rather than taking the file's PIN.
- Sections are a fixed list until Phase 3; registry hooks come with the next module.
- v0 files' rebuilt payments compare by loan, month and amount, not id.
