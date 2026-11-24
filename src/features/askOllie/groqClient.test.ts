import { describe, it, expect } from 'vitest'
import {
  askGroq, buildMessages, errorMessage, normalizeKey, GROQ_MODEL, GROQ_URL, MAX_HISTORY,
} from './groqClient'
import type { ChatMessage } from './groqClient'

type Captured = { url: string; init: RequestInit }

function fakeFetch(response: () => Response, captured?: Captured[]): typeof fetch {
  return (async (url: RequestInfo | URL, init?: RequestInit) => {
    captured?.push({ url: String(url), init: init ?? {} })
    return response()
  }) as typeof fetch
}

const ok = (content: unknown) =>
  () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })

const base = { apiKey: 'k', summary: 'LOANS\n- Phone', history: [] as ChatMessage[], question: 'Biggest loan?' }

describe('askGroq', () => {
  it('sends the key, model and question', async () => {
    const captured: Captured[] = []
    await askGroq({ ...base, fetchImpl: fakeFetch(ok('Phone.'), captured) })
    expect(captured[0].url).toBe(GROQ_URL)
    expect((captured[0].init.headers as Record<string, string>).Authorization).toBe('Bearer k')
    const body = JSON.parse(captured[0].init.body as string)
    expect(body.model).toBe(GROQ_MODEL)
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'Biggest loan?' })
  })

  it('returns the trimmed answer', async () => {
    expect(await askGroq({ ...base, fetchImpl: fakeFetch(ok('  Phone.  ')) })).toEqual({ ok: true, answer: 'Phone.' })
  })

  it('treats an empty answer as a failure', async () => {
    expect(await askGroq({ ...base, fetchImpl: fakeFetch(ok('')) })).toEqual({ ok: false, error: 'failed' })
    const noChoices = () => new Response(JSON.stringify({}), { status: 200 })
    expect(await askGroq({ ...base, fetchImpl: fakeFetch(noChoices) })).toEqual({ ok: false, error: 'failed' })
  })

  it('maps 401 to bad-key and 429 to rate-limit', async () => {
    const unauthorized = () => new Response('{}', { status: 401 })
    expect(await askGroq({ ...base, fetchImpl: fakeFetch(unauthorized) })).toEqual({ ok: false, error: 'bad-key' })
    const limited = () => new Response('{}', { status: 429, headers: { 'retry-after': '120' } })
    expect(await askGroq({ ...base, fetchImpl: fakeFetch(limited) })).toEqual({ ok: false, error: 'rate-limit', retryAfter: 120 })
  })

  it('maps a network error to offline', async () => {
    const offline = (async () => { throw new TypeError('Failed to fetch') }) as typeof fetch
    expect(await askGroq({ ...base, fetchImpl: offline })).toEqual({ ok: false, error: 'offline' })
  })
})

describe('buildMessages', () => {
  it('sends only the last 10 messages of history', () => {
    const history: ChatMessage[] = Array.from({ length: 14 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user', content: `m${i}`,
    }))
    const messages = buildMessages('summary', history, 'next?')
    expect(MAX_HISTORY).toBe(10)
    expect(messages).toHaveLength(2 + 10 + 1)
    expect(messages[2].content).toBe('m4')
    expect(messages.slice(0, 2).every((m) => m.role === 'system')).toBe(true)
  })
})

describe('normalizeKey', () => {
  it('trims and rejects empty', () => {
    expect(normalizeKey('  gsk_x \n')).toBe('gsk_x')
    expect(normalizeKey('   ')).toBeNull()
  })
})

describe('errorMessage', () => {
  it('explains each failure plainly', () => {
    expect(errorMessage('offline')).toBe('No connection. Ollie needs the internet to answer.')
    expect(errorMessage('bad-key')).toBe('Your Groq key was rejected. Check it in Settings.')
    expect(errorMessage('rate-limit')).toBe("Groq's free limit is used up for now. Try again in a minute.")
    expect(errorMessage('rate-limit', 300)).toContain('about 5 minutes')
    expect(errorMessage('failed')).toBe("Ollie couldn't get an answer. Try again.")
  })
})
