# Ask Ollie (chat) — design

## Intent

The owner asks a handful of questions a day (1–5) about their money in their
own words — "which loan is the biggest?", "how much is left on Home Credit
TV?", "what's due this week?", "how much did I spend on food this month?" —
and wants a straight, correct answer without digging through screens. The
owner chose Groq's free tier as the AI service.

## Goals

- A chat with Ollie, opened by tapping Ollie, that answers questions about
  loans, bills, savings goals and money entries.
- Exact figures: every number in an answer comes from the app's own
  calculations, formatted like the rest of the app (₱).
- Works with the owner's own Groq API key; costs nothing at 1–5 questions/day.
- Replies in the language the question was asked in (English, Tagalog,
  Taglish).

## Non-goals

- Changing data from the chat (no "mark as paid", no "add expense"). Answers
  only, for now.
- A server or proxy. The app stays a static site on GitHub Pages.
- Saved chat history.
- Questions unrelated to the owner's money.

## Anti-goals

- **A private loan leaking outside the unlocked folder** — in an answer,
  a quick-question chip, or anything left on screen.
- **A built-in API key.** The site is public; a key in the bundle would be
  taken and used up.
- **Made-up numbers.** An answer that states a figure the summary didn't
  contain (or adds numbers wrong) is the failure this design is shaped
  around.
- Failing silently: no key, no connection, a rejected key or a rate limit
  must each say what happened and what to do.

## Constraints

- Groq's API is OpenAI-compatible (`POST https://api.groq.com/openai/v1/chat/completions`,
  `Authorization: Bearer <key>`). Its CORS preflight allows any origin
  (checked 2026-11-24: `access-control-allow-origin: *`), so the browser can
  call it directly. The service worker ignores non-GET and cross-origin
  requests, so it doesn't interfere.
- Free-tier limits are per model, per minute and per day, and change over
  time. Total data today is ~15 KB; the summary must stay well under a
  free-tier model's per-minute token limit (budget: ≤ 6,000 tokens of
  summary).
- Vitest runs in Node: summary building must be pure functions with tests.

## Approaches

1. **Prepared summary with each question** — *chosen.* The app builds a
   compact text summary with all arithmetic done (balances, totals, due
   dates, monthly category totals) and sends it with the question in one
   request. Simple, one request per question, exact for the questions the
   owner described. Weakness: arbitrary date ranges over raw entries need
   the model to add up numbers.
2. Tool calling — the model asks the app for figures (find loan, sum
   spending between dates…). Exact for any range, scales with data, but
   2–3 requests per question, more code, and free models sometimes emit
   malformed calls. Kept as the upgrade path if (1) gets ranges wrong.
3. Local phrase matching, no AI — rejected: the owner chose Groq to ask in
   their own words.

## Design (as decided)

### Who sees what

- Archived loans, bills and goals are included but marked archived; the
  model is told to leave them out unless asked about archived items.
- **Private loans are in the summary only when the chat is opened from
  inside the private folder** (which itself requires the PIN, if one is
  set). Opened from the dashboard, private loans and the folder's name are
  absent — not marked, absent — whether or not the folder has a PIN, to
  match "hidden from the rest of Ollie". *(Owner chose "only from inside the
  unlocked folder"; gating on where the chat was opened, not on PIN state,
  is my reading of that — it also covers the PIN-off case.)*
- So `includePrivate` = "opened from the folder page". The sheet also
  closes (and clears) if the folder locks while it's open from there.
- Opened from the folder, the summary covers everything (loans, bills,
  savings, money) plus the private loans — the owner said "Ollie sees
  everything" there.

### The summary (`features/askOllie/summary.ts`, pure)

`buildSummary(input, now) → string`, input = loans, payments, bills, bill
payments, goals, savings transactions, money entries, money categories,
monthly income, `includePrivate: boolean`. Plain text, one line per item,
labelled fields, amounts pre-formatted with `formatCurrency`. Contents:

- Today's date and the currency.
- **Loans:** name, tag, status (active / paid off / archived / private),
  total amount, monthly payment, interest rate, payments made / total,
  remaining balance, total paid, total cost, next due date, overdue days,
  end date. Plus overall: total left to pay, total monthly, debt-free date.
  *(My call:)* these overall figures stay exactly the dashboard's (from the
  existing functions, which leave private loans out). When private loans
  are included, a separate "Private folder" block lists them with their own
  subtotal (left to pay, monthly), and the "largest/smallest balance"
  ranking covers every loan listed. Per-loan figures always come from the
  existing `loanUtils` functions; subtotals are plain sums of those.
- **Bills:** name, category, amount, next due date, overdue?, paid this
  cycle. Plus total monthly bills.
- **Savings goals:** name, saved, target, % reached, remaining to target.
  Plus total saved.
- **Money:** monthly income setting; for each of the last 12 months,
  income, expenses and net, and expenses per category; plus every entry
  from the last 60 days (date, type, category, amount, note).
- Sorted so "biggest / smallest" questions are easy (loans by remaining
  balance, descending), with ranks stated ("largest remaining balance: …").

If the summary exceeds the budget, drop the oldest monthly breakdowns first,
then shorten the entries window — never drop loans, bills or goals.

### The request (`features/askOllie/groqClient.ts`)

- One `chat/completions` call per question: system prompt + summary as a
  system message + the conversation so far + the new question.
- System prompt rules (exact wording is the builder's): you are Ollie, the
  owl in a personal loan tracker; answer only from the summary; quote
  figures exactly as written there; if the answer isn't in the summary,
  say you can't see that rather than estimating; if a calculation is
  needed that the summary doesn't give, say so and name the screen where
  it's shown; reply in the user's language; short answers (1–3 sentences,
  a short list when listing); politely decline unrelated topics.
- Low temperature (≈0.2), modest max tokens (≈400). No streaming needed.
- Model: a current production chat model from Groq's model list, held in
  one constant (builder verifies the name against Groq's docs at build time).
- Errors mapped to plain messages: 401 → "Your Groq key was rejected —
  check it in Settings"; 429 → "Groq's free limit is used up for now — try
  again in a minute" (or later, per `retry-after`); network failure → "No
  connection — Ollie needs the internet to answer"; anything else → "Ollie
  couldn't get an answer — try again".

### The key (`features/askOllie/askOllieStore.ts` + Settings)

- Settings → "Ask Ollie" section: a password-type field for the Groq API
  key, a "Get a free key" link to Groq's console, a Remove button, and one
  line saying questions and a summary of your data are sent to Groq.
- Stored in localStorage under its own key; never logged, never in
  backups or exports.

### The chat (`features/askOllie/AskOllieSheet.tsx`)

- Opens as a bottom sheet (reuse the money feature's `Sheet`) when Ollie is
  tapped on the dashboard, and from an "Ask Ollie" button in the unlocked
  private folder's header.
- *(My call:)* Ollie's message on the dashboard can be dismissed, leaving
  no owl to tap, so the dashboard's app bar also gets a small "Ask Ollie"
  button next to Settings that is always there.
- Header "Ask Ollie" with the owl and a close button. Quick-question chips
  when the chat is empty: "Biggest loan?", "What's due this week?",
  "How much did I spend this month?" — fixed copy, no data in them.
- Messages: owner's on the right, Ollie's on the left with the small owl.
  While waiting, Ollie's thinking expression and a typing indicator; the
  send button is disabled.
- Follow-ups use the conversation so far (kept in component state only).
- **Closing the sheet clears the conversation.** It also clears when the
  folder locks while the chat is open from inside it.
- No key yet → the sheet shows a short explanation and a button to
  Settings instead of the input.
- Tapping Ollie must keep working as today for minimised critical
  reminders (the compact bar restores the reminder); the chat opens from
  the owl artwork in the full companion.

### Release

- What's New entry: "Ask Ollie" — ask about your loans, bills, savings and
  spending in your own words (needs a free Groq key).

## Left to the builder

- Exact system-prompt wording, chip copy, and visual details within the
  flat style.
- Which Groq model (current, production, free-tier) — one constant.
- Line format of the summary, within the contents above.

## Addendum: key on the server (decided after review)

**Why.** The owner doesn't want to type a Groq key on every device. A key
built into the app would be readable by anyone on the public site, so the
key moves to a server the owner already has: Vercel, which deploys this
repo from `main`. The owner uses (and will keep using) the Vercel site.

**Approach (only sensible one).** A Vercel function in this repo,
`api/ask.ts`, holds the key as the `GROQ_API_KEY` environment variable.
The browser still builds the summary (the data only exists on the phone)
and posts `{ summary, history, question }` to `/api/ask` on the same site.
The function adds the system prompt, model and settings, calls Groq and
returns `{ answer }` or `{ error }`. Rejected: a Cloudflare Worker (second
account, cross-site again); the server building the summary (it has no
data).

**Guard rails (owner chose "no passphrase, guard rails").**
- POST with JSON only; `Origin` must match the request's own host — so
  other websites' pages can't use it (scripts can still fake it; accepted).
- Fixed system prompt, model, temperature, reasoning effort and token
  limit live only on the server; the client can't send its own.
- Caps: question ≤ 500 characters; summary ≤ 30,000 characters; history
  ≤ 10 messages of role `user`/`assistant`, each ≤ 2,000 characters.
  Anything else → 400.
- Request bodies and the key are never logged.
- Worst case accepted by the owner: someone faking requests uses up the
  day's free Groq allowance (no billing on the Groq account → no cost).

**Errors.** Server responds with an error kind the client maps to copy:
- `not-configured` (no `GROQ_API_KEY`, or Groq rejects it) → "Ask Ollie
  isn't set up yet."
- `rate-limit` (+ `retryAfter`) → existing free-limit copy.
- `failed` → existing "couldn't get an answer" copy.
- Browser can't reach the site → existing "No connection" copy.
- `/api/ask` missing (404, e.g. the GitHub Pages copy) → "Ask Ollie only
  works on the Vercel version of the app."

**What goes away.** The Settings "Ask Ollie" key card, the key store and
the sheet's "add your key" state. The What's New line about adding a key
becomes "Ollie is ready to answer — nothing to set up."

**Owner's one-time step.** Add `GROQ_API_KEY` in the Vercel project's
Environment Variables (Production, and Preview if wanted), then redeploy.
The owner does this themselves; the key never passes through this
conversation or the repo.

**Local development.** `vite` doesn't run `/api`; use `vercel dev` for a
live local check. Tests cover the function's logic with a fake `fetch`.
