/**
 * Talks to Groq's OpenAI-compatible chat API straight from the browser
 * (Groq allows any origin). The owner's own key is passed in per call —
 * nothing here knows where it's stored.
 */

export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
/** Groq's named replacement for the retired llama-3.3-70b-versatile (checked 2026-11-24). */
export const GROQ_MODEL = 'openai/gpt-oss-120b'
/** Earlier turns sent with each question, so requests stay small. */
export const MAX_HISTORY = 10

export type ChatMessage = { role: 'user' | 'assistant'; content: string }
export type AskError = 'bad-key' | 'rate-limit' | 'offline' | 'failed'
export type AskResult =
  | { ok: true; answer: string }
  | { ok: false; error: AskError; retryAfter?: number }

const SYSTEM_PROMPT = `You are Ollie, the friendly owl inside a personal loan tracker app. You answer the owner's questions about their own loans, bills, savings goals and income and expenses.

Rules:
- Answer only from the data summary you are given. Never guess or invent numbers.
- Quote amounts and dates exactly as they are written in the summary. Do not do your own arithmetic when the summary already has the figure.
- If the answer is not in the summary, say you can't see that, and if useful name the app screen that shows it (Home, Calendar, Analytics, Bills, Savings, Money).
- Leave archived items out unless the owner asks about archived ones.
- Reply in the same language the owner writes in (English, Tagalog or Taglish).
- Keep it short: one to three sentences, or a short list when listing several items. No tables, no headings.
- You can only answer questions. If asked to change anything (mark paid, add, delete), say you can't do that yet and point to where in the app it's done.
- If the question isn't about the owner's money in this app, politely say you can only help with that.`

/** Trimmed key, or null for an empty paste. */
export function normalizeKey(raw: string): string | null {
  const key = raw.trim()
  return key ? key : null
}

export function buildMessages(summary: string, history: ChatMessage[], question: string) {
  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'system' as const, content: `The owner's data:\n\n${summary}` },
    ...history.slice(-MAX_HISTORY),
    { role: 'user' as const, content: question },
  ]
}

export async function askGroq(opts: {
  apiKey: string
  summary: string
  history: ChatMessage[]
  question: string
  fetchImpl?: typeof fetch
}): Promise<AskResult> {
  const doFetch = opts.fetchImpl ?? fetch
  let res: Response
  try {
    res = await doFetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: buildMessages(opts.summary, opts.history, opts.question),
        temperature: 0.2,
        max_completion_tokens: 1024,
      }),
    })
  } catch {
    return { ok: false, error: 'offline' }
  }

  if (res.status === 401 || res.status === 403) return { ok: false, error: 'bad-key' }
  if (res.status === 429) {
    const seconds = Number(res.headers.get('retry-after'))
    return Number.isFinite(seconds) && seconds > 0
      ? { ok: false, error: 'rate-limit', retryAfter: seconds }
      : { ok: false, error: 'rate-limit' }
  }
  if (!res.ok) return { ok: false, error: 'failed' }

  try {
    const data = await res.json() as { choices?: Array<{ message?: { content?: unknown } }> }
    const content = data.choices?.[0]?.message?.content
    const answer = typeof content === 'string' ? content.trim() : ''
    return answer ? { ok: true, answer } : { ok: false, error: 'failed' }
  } catch {
    return { ok: false, error: 'failed' }
  }
}

export function errorMessage(error: AskError, retryAfter?: number): string {
  switch (error) {
    case 'bad-key':
      return 'Your Groq key was rejected. Check it in Settings.'
    case 'rate-limit':
      return retryAfter && retryAfter > 90
        ? `Groq's free limit is used up for now. Try again in about ${Math.ceil(retryAfter / 60)} minutes.`
        : "Groq's free limit is used up for now. Try again in a minute."
    case 'offline':
      return 'No connection. Ollie needs the internet to answer.'
    default:
      return "Ollie couldn't get an answer. Try again."
  }
}
