/**
 * Server side of Ask Ollie, run by the Vercel function in api/ask.ts.
 * The Groq key lives only here (an environment variable). Ollie's
 * instructions and the model are fixed on the server, so the endpoint
 * can't be repurposed as a general chatbot by sending different ones.
 */

export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
/** Groq's named replacement for the retired llama-3.3-70b-versatile (checked 2026-11-24). */
export const GROQ_MODEL = 'openai/gpt-oss-120b'

export const MAX_QUESTION = 500
export const MAX_SUMMARY = 30_000
export const MAX_HISTORY = 10
export const MAX_TURN = 2_000

export type AskReply =
  | { answer: string }
  | { error: 'not-configured' | 'rate-limit' | 'failed'; retryAfter?: number }

type Turn = { role: 'user' | 'assistant'; content: string }
type AskBody = { summary: string; history: Turn[]; question: string }

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

function reply(body: AskReply | { error: 'failed' }, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  })
}

const isString = (v: unknown, min: number, max: number): v is string =>
  typeof v === 'string' && v.trim().length >= min && v.length <= max

/** The request body if it is exactly Ollie's shape and within the caps. */
function parseBody(raw: unknown): AskBody | null {
  if (!raw || typeof raw !== 'object') return null
  const { summary, history, question } = raw as Record<string, unknown>
  if (!isString(question, 1, MAX_QUESTION) || !isString(summary, 1, MAX_SUMMARY)) return null
  if (!Array.isArray(history) || history.length > MAX_HISTORY) return null
  const turns: Turn[] = []
  for (const item of history) {
    if (!item || typeof item !== 'object') return null
    const { role, content } = item as Record<string, unknown>
    if ((role !== 'user' && role !== 'assistant') || !isString(content, 0, MAX_TURN)) return null
    turns.push({ role, content })
  }
  return { summary, history: turns, question: question.trim() }
}

/** Same-site check: other websites' pages can't use this endpoint. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

export async function handleAsk(
  request: Request,
  deps: { apiKey: string | undefined; fetchImpl?: typeof fetch },
): Promise<Response> {
  if (request.method !== 'POST') return reply({ error: 'failed' }, 405, { Allow: 'POST' })
  if (!sameOrigin(request)) return reply({ error: 'failed' }, 403)

  let body: AskBody | null
  try {
    body = parseBody(await request.json())
  } catch {
    body = null
  }
  if (!body) return reply({ error: 'failed' }, 400)
  if (!deps.apiKey) return reply({ error: 'not-configured' }, 503)

  let res: Response
  try {
    res = await (deps.fetchImpl ?? fetch)(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${deps.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: `The owner's data:\n\n${body.summary}` },
          ...body.history,
          { role: 'user', content: body.question },
        ],
        temperature: 0.2,
        // gpt-oss thinks before answering, and that thinking counts against
        // max_completion_tokens — keep it short so the answer fits.
        reasoning_effort: 'low',
        max_completion_tokens: 1024,
      }),
    })
  } catch {
    return reply({ error: 'failed' }, 502)
  }

  // Groq's own error text never goes back to the browser.
  if (res.status === 401 || res.status === 403) return reply({ error: 'not-configured' }, 503)
  if (res.status === 429) {
    const seconds = Number(res.headers.get('retry-after'))
    return Number.isFinite(seconds) && seconds > 0
      ? reply({ error: 'rate-limit', retryAfter: seconds }, 429)
      : reply({ error: 'rate-limit' }, 429)
  }
  if (!res.ok) return reply({ error: 'failed' }, 502)

  try {
    const data = await res.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: unknown } }> }
    const choice = data.choices?.[0]
    // A reply cut off at the token limit can look complete but miss items.
    if (choice?.finish_reason === 'length') return reply({ error: 'failed' }, 502)
    const content = choice?.message?.content
    const answer = typeof content === 'string' ? content.trim() : ''
    return answer ? reply({ answer }, 200) : reply({ error: 'failed' }, 502)
  } catch {
    return reply({ error: 'failed' }, 502)
  }
}
