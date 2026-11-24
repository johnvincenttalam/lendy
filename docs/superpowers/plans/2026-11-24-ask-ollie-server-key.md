# Ask Ollie — Server Key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Groq key off the device into a Vercel function, so Ask Ollie works with nothing to set up.

**Architecture:** `src/server/askHandler.ts` holds everything server-side (system prompt, model, limits, validation, Groq call, error mapping) as a pure `handleAsk(request, deps)`. `api/ask.ts` is a thin Vercel wrapper passing `process.env.GROQ_API_KEY`. The browser client posts `{ summary, history, question }` to `/api/ask` and maps the reply to copy.

**Tech Stack:** Vercel Functions (Node runtime, `export default { fetch }` web handler), TypeScript, Vitest (node).

**Spec:** `docs/superpowers/specs/2026-11-24-ask-ollie-design.md` — section "Addendum: key on the server".

## Global Constraints

- Env var name `GROQ_API_KEY`. No key in the repo, bundle, logs or responses.
- Server-fixed: system prompt, `GROQ_MODEL = 'openai/gpt-oss-120b'`, temperature 0.2, `reasoning_effort: 'low'`, `max_completion_tokens: 1024`. Any `system` role or extra fields from the client are rejected.
- Caps: question 1–500 chars; summary 1–30,000 chars; history ≤ 10 items, role `user`|`assistant`, content ≤ 2,000 chars.
- Only `POST`; `Origin` header required and its host must equal the request URL's host.
- Response shapes: `200 { answer }`; errors `{ error: 'not-configured' | 'rate-limit' | 'failed', retryAfter? }` with status 503 / 429 / 502; bad input 400 `{ error: 'failed' }`; wrong origin 403 `{ error: 'failed' }`; wrong method 405.
- Client copy (verbatim):
  - not-configured: "Ask Ollie isn't set up yet."
  - unavailable (404): "Ask Ollie only works on the Vercel version of the app."
  - rate-limit / offline / failed: unchanged from the current client.

## Review Focus

1. A request whose `Origin` is another site, or missing — rejected before Groq is called. (Task 1 test.)
2. A client that sends its own `system` message in history to repurpose Ollie — rejected. (Task 1 test.)
3. `GROQ_API_KEY` unset in Vercel — "isn't set up yet", not a generic failure. (Task 1 + Task 2 tests.)
4. The GitHub Pages copy (no `/api`) — clear "only works on Vercel" message. (Task 2 test.)
5. Groq's error body or the key never echoed back to the browser. (Task 1 test: error responses contain only `error`/`retryAfter`.)

---

### Task 1: The server handler

**Files:**
- Create: `src/server/askHandler.ts`, `src/server/askHandler.test.ts`, `api/ask.ts`
- Modify: `tsconfig.node.json` (include `api`)

**Interfaces:**
- Produces: `handleAsk(request: Request, deps: { apiKey: string | undefined; fetchImpl?: typeof fetch }): Promise<Response>`; `type AskReply = { answer: string } | { error: 'not-configured' | 'rate-limit' | 'failed'; retryAfter?: number }`; exported limits `MAX_QUESTION = 500`, `MAX_SUMMARY = 30_000`, `MAX_HISTORY = 10`, `MAX_TURN = 2_000`.
- `api/ask.ts`: `export default { fetch: (request: Request) => handleAsk(request, { apiKey: process.env.GROQ_API_KEY }) }`.

- [ ] **Step 1: Failing tests** (`askHandler.test.ts`; helper `req(body, { origin = 'https://ollie.example', url = 'https://ollie.example/api/ask', method = 'POST' })`; fake Groq fetch capturing calls):
  - `answers a valid question` → 200 `{ answer: 'Phone.' }`; Groq call has `Authorization: Bearer k`, model `GROQ_MODEL`, `reasoning_effort: 'low'`, first message role `system`, second contains the summary.
  - `rejects other sites and missing origin` → origin `https://evil.example` → 403, no Groq call; no Origin header → 403.
  - `rejects anything but POST` → GET → 405.
  - `rejects bad input` → 400 each for: empty question, 501-char question, 30,001-char summary, 11 history items, a history item with role `system`, a 2,001-char turn, non-JSON body.
  - `says not configured without a key` → `apiKey: undefined` → 503 `{ error: 'not-configured' }`, no Groq call; Groq 401 → 503 `not-configured`.
  - `passes rate limits through` → Groq 429 `retry-after: 120` → 429 `{ error: 'rate-limit', retryAfter: 120 }`.
  - `fails cut-off and empty answers` → `finish_reason: 'length'` → 502 `failed`; empty content → 502 `failed`; fetch throws → 502 `failed`.
  - `never echoes Groq's error or the key` → Groq 500 body `{"error":"secret k details"}` → response text contains neither `secret` nor `Bearer`.
- [ ] **Step 2: Run** `npx vitest run src/server` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `handleAsk` (move `SYSTEM_PROMPT`, `GROQ_URL`, `GROQ_MODEL`, `buildMessages` here from `groqClient.ts`) and `api/ask.ts`; add `"api"` to `tsconfig.node.json` include.
- [ ] **Step 4: Run** `npx vitest run && npx tsc -b` — Expected: pass.
- [ ] **Step 5: Commit** — `Add a Vercel function that asks Groq with a server-side key`

---

### Task 2: Point the chat at the function; remove the key UI

**Files:**
- Rename/modify: `src/features/askOllie/groqClient.ts` → `askClient.ts` (and its test → `askClient.test.ts`)
- Modify: `src/features/askOllie/AskOllieSheet.tsx`, `src/pages/SettingsPage.tsx`, `src/features/whatsNew/changelog.ts`
- Delete: `src/features/askOllie/askOllieStore.ts`, `src/features/askOllie/AskOllieSettings.tsx`

**Interfaces:**
- Consumes: the `/api/ask` contract from Task 1.
- Produces: `ASK_URL = \`${import.meta.env.BASE_URL}api/ask\``; `askOllie(opts: { summary: string; history: ChatMessage[]; question: string; fetchImpl?: typeof fetch; url?: string }): Promise<AskResult>`; `type AskError = 'not-configured' | 'unavailable' | 'rate-limit' | 'offline' | 'failed'`; `errorMessage(error, retryAfter?)`; `ChatMessage`, `MAX_HISTORY` (client trims history to it before sending).

- [ ] **Step 1: Failing tests** (`askClient.test.ts`, replacing the Groq-direct tests):
  - `posts the summary, trimmed history and question` → URL equals the `url` option; body has exactly `summary`, `history` (last 10), `question`; no Authorization header.
  - `maps server replies` → 200 `{ answer: ' Hi ' }` → `{ ok: true, answer: 'Hi' }`; 503 not-configured → `not-configured`; 429 with `retryAfter: 300` → `rate-limit`, 300; 502 → `failed`; 404 → `unavailable`; fetch throws → `offline`; 200 with non-JSON → `failed`.
  - `errorMessage` → `not-configured` and `unavailable` copy verbatim; existing copy unchanged.
- [ ] **Step 2: Run** `npx vitest run src/features/askOllie` — Expected: FAIL.
- [ ] **Step 3: Implement** the client; the sheet drops the no-key state and `useAskOllieStore` and calls `askOllie`; remove the Settings card and both deleted files; changelog line "Uses your own free Groq key, added in Settings." → "Ready to use — nothing to set up."
- [ ] **Step 4: Run** `npx vitest run && npx tsc -b && npm run build && npx eslint src api` — Expected: pass (only the 3 pre-existing lint errors).
- [ ] **Step 5: Verify in the browser** (dev server; snapshot/restore localStorage; stub `fetch` for `/api/ask`): answer shows; stubbed 503 → "isn't set up yet"; stubbed 404 → "only works on the Vercel version"; dashboard request body has no private loan; Settings shows no key card.
- [ ] **Step 6: Commit** — `Ask Ollie through the server so there's no key to enter`
