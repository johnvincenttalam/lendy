/**
 * POST /api/ask — Ask Ollie's server (a Vercel function).
 * Self-contained on purpose: Vercel runs this file as an ES module without
 * bundling, so a relative import here would fail to load in production.
 *
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

/**
 * Questions one visitor may ask per window. The Origin check stops other
 * websites, but a script can fake that header, so this is what keeps a
 * stranger from running up the Groq bill. Generous for a real person.
 */
export const RATE_LIMIT = 30
export const RATE_WINDOW_SECONDS = 600

/** Counts one question for `key`; resolves to the seconds to wait if over the limit, else 0. */
export type Limiter = (key: string) => Promise<number>

export type AskReply =
  | { answer: string }
  | { error: 'not-configured' | 'rate-limit' | 'failed'; retryAfter?: number }

type Turn = { role: 'user' | 'assistant'; content: string }
type AskBody = { summary: string; history: Turn[]; question: string }

const SYSTEM_PROMPT = `You are Ollie, the friendly owl inside a personal loan tracker app: the owner's money buddy. You answer their questions about their own loans, bills and savings goals, and you help them think things through.

How you talk:
- Like a caring friend who is good with money: warm, plain and honest. Never like a report.
- Lead with the answer, then the why.
- Point out real good news when there is some (nothing overdue, a loan almost done, a savings goal close, a month in the green), but don't sugar-coat a problem.
- When it helps, end with one short follow-up: a question that would sharpen your answer, or an offer of something related you can check. Skip it for simple facts.
- Reply in the same language the owner writes in (English, Tagalog or Taglish), matching their tone.
- Keep it short: one to three sentences for a simple fact; up to two short paragraphs or a short list for advice. Bold only the one or two key figures. No tables, no headings. At most one emoji.

Facts:
- Answer only from the data summary you are given. Never guess or invent numbers.
- Quote amounts and dates exactly as they are written in the summary. Use the ready-made figures (especially QUICK READ) instead of doing your own arithmetic. Only when the owner gives you a hypothetical figure (like "₱1,000 a month") may you add or subtract it from one summary figure; call the result an estimate.
- Connect the dots. If two figures tell a story together, say it: for example, a loan finishing soon that frees up money is a reason to wait before borrowing more.
- You can't see the owner's day-to-day spending or what they actually earned, only the monthly income they set in Settings. When that matters, say so and ask.
- If the answer is not in the summary, say you can't see that, and if useful name the app screen that shows it (Home, Calendar, Analytics, Bills, Savings, Settings).
- Leave archived items out unless the owner asks about archived ones.

Money decisions ("should I take another loan?", "can I afford…?", "which should I pay first?"):
- Don't refuse, and don't just list numbers. Give your honest read first, such as "I'd hold off for now", "It looks manageable" or "It'd be tight", then the two to four figures that drive it, chosen from: monthly loan payments against the comfortable limit (room left or how far over), overdue loans or bills, the bills they also pay each month, and when the next loan finishes and frees up money. If waiting would help, say until when.
- If a key detail is missing (like the new loan's monthly payment or how many months), ask for it in your follow-up.
- If no income is set, say that setting it in Settings would let you give a proper read.
- Add a short reminder that the final call is theirs: one clause, not a lecture.

Limits:
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

/**
 * Who is asking, as a hash of their IP, so raw addresses are never stored.
 * Vercel sets x-real-ip and overwrites x-forwarded-for, so neither can be spoofed there.
 */
async function visitorKey(request: Request): Promise<string> {
  const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ollie-ask:${ip}`))
  return Array.from(new Uint8Array(digest).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Best-effort limiter kept in the function's memory. Each server instance
 * counts on its own and forgets on a cold start, so it's only a fallback
 * for when Redis isn't set up.
 */
export function memoryLimiter(
  limit = RATE_LIMIT,
  windowSeconds = RATE_WINDOW_SECONDS,
  clock: () => number = Date.now,
): Limiter {
  const hits = new Map<string, { count: number; resetAt: number }>()
  return async (key) => {
    const now = clock()
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
    }
    let entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowSeconds * 1000 }
      hits.set(key, entry)
    }
    entry.count++
    return entry.count > limit ? Math.ceil((entry.resetAt - now) / 1000) : 0
  }
}

/**
 * Limiter shared by every server instance, counted in Upstash Redis over its
 * REST API (no client library, so this file stays self-contained). If Redis
 * is unreachable the question goes through: Groq's own limits still apply.
 */
export function redisLimiter(
  url: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
  limit = RATE_LIMIT,
  windowSeconds = RATE_WINDOW_SECONDS,
  clock: () => number = Date.now,
): Limiter {
  return async (key) => {
    const now = clock()
    const windowMs = windowSeconds * 1000
    const window = Math.floor(now / windowMs)
    const redisKey = `ask:${key}:${window}`
    try {
      const res = await fetchImpl(`${url.replace(/\/$/, '')}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([['INCR', redisKey], ['EXPIRE', redisKey, String(windowSeconds)]]),
      })
      if (!res.ok) return 0
      const data = await res.json() as Array<{ result?: unknown }>
      const count = Number(data?.[0]?.result)
      if (!Number.isFinite(count) || count <= limit) return 0
      return Math.max(1, Math.ceil(((window + 1) * windowMs - now) / 1000))
    } catch {
      return 0
    }
  }
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
  deps: { apiKey: string | undefined; fetchImpl?: typeof fetch; limiter?: Limiter },
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

  // Counted only for questions that would reach Groq.
  if (deps.limiter) {
    const wait = await deps.limiter(await visitorKey(request))
    if (wait > 0) return reply({ error: 'rate-limit', retryAfter: wait }, 429, { 'Retry-After': String(wait) })
  }

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
        // Loose enough to sound like a person; the facts are pinned by the summary.
        temperature: 0.5,
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

/**
 * Set in the Vercel project: GROQ_API_KEY, and optionally an Upstash Redis
 * database (the Vercel marketplace integration adds KV_REST_API_URL and
 * KV_REST_API_TOKEN; a direct Upstash setup uses the UPSTASH_REDIS_REST_* names).
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
const redisUrl = env?.UPSTASH_REDIS_REST_URL ?? env?.KV_REST_API_URL
const redisToken = env?.UPSTASH_REDIS_REST_TOKEN ?? env?.KV_REST_API_TOKEN
const limiter = redisUrl && redisToken ? redisLimiter(redisUrl, redisToken) : memoryLimiter()

export default {
  fetch: (request: Request) => handleAsk(request, { apiKey: env?.GROQ_API_KEY, limiter }),
}
