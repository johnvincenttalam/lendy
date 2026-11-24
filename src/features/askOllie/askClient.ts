/**
 * Browser side of Ask Ollie: posts the summary and question to the app's
 * own /api/ask function, which holds the Groq key (see src/server).
 */

/** Same site as the app; on GitHub Pages this path doesn't exist (→ 'unavailable'). */
export const ASK_URL = `${import.meta.env.BASE_URL}api/ask`
/** Earlier turns sent with each question, so requests stay small. */
export const MAX_HISTORY = 10

export type ChatMessage = { role: 'user' | 'assistant'; content: string }
export type AskError = 'not-configured' | 'unavailable' | 'rate-limit' | 'offline' | 'failed'
export type AskResult =
  | { ok: true; answer: string }
  | { ok: false; error: AskError; retryAfter?: number }

export async function askOllie(opts: {
  summary: string
  history: ChatMessage[]
  question: string
  fetchImpl?: typeof fetch
  url?: string
}): Promise<AskResult> {
  let res: Response
  try {
    res = await (opts.fetchImpl ?? fetch)(opts.url ?? ASK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: opts.summary,
        history: opts.history.slice(-MAX_HISTORY),
        question: opts.question,
      }),
    })
  } catch {
    return { ok: false, error: 'offline' }
  }

  if (res.status === 404) return { ok: false, error: 'unavailable' }

  let data: { answer?: unknown; error?: unknown; retryAfter?: unknown }
  try {
    data = await res.json()
  } catch {
    return { ok: false, error: 'failed' }
  }

  if (res.ok && typeof data.answer === 'string' && data.answer.trim()) {
    return { ok: true, answer: data.answer.trim() }
  }
  if (data.error === 'not-configured') return { ok: false, error: 'not-configured' }
  if (data.error === 'rate-limit') {
    const seconds = Number(data.retryAfter)
    return Number.isFinite(seconds) && seconds > 0
      ? { ok: false, error: 'rate-limit', retryAfter: seconds }
      : { ok: false, error: 'rate-limit' }
  }
  return { ok: false, error: 'failed' }
}

export function errorMessage(error: AskError, retryAfter?: number): string {
  switch (error) {
    case 'not-configured':
      return "Ask Ollie isn't set up yet."
    case 'unavailable':
      return 'Ask Ollie only works on the Vercel version of the app.'
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
