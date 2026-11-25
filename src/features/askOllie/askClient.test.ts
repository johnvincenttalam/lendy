import { describe, it, expect } from 'vitest'
import { askOllie, errorMessage, MAX_HISTORY, MAX_TURN } from './askClient'
import type { ChatMessage } from './askClient'

type Captured = { url: string; init: RequestInit }

function server(make: () => Response, captured?: Captured[]): typeof fetch {
  return (async (url: RequestInfo | URL, init?: RequestInit) => {
    captured?.push({ url: String(url), init: init ?? {} })
    return make()
  }) as typeof fetch
}

const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status })
const base = { summary: 'LOANS\n- Phone', history: [] as ChatMessage[], question: 'Biggest loan?', url: '/api/ask' }

describe('askOllie', () => {
  it('posts the summary, trimmed history and question', async () => {
    const captured: Captured[] = []
    const history: ChatMessage[] = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }))
    await askOllie({ ...base, history, fetchImpl: server(json({ answer: 'Phone.' }), captured) })
    expect(captured[0].url).toBe('/api/ask')
    expect((captured[0].init.headers as Record<string, string>).Authorization).toBeUndefined()
    const body = JSON.parse(captured[0].init.body as string)
    expect(Object.keys(body).sort()).toEqual(['history', 'question', 'summary'])
    expect(MAX_HISTORY).toBe(10)
    expect(body.history).toHaveLength(10)
    expect(body.history[0].content).toBe('m4')
    expect(body.question).toBe('Biggest loan?')
  })

  it('says unavailable when the site has no function (GitHub Pages answers 405)', async () => {
    const pages = () => new Response('<html>405 Not Allowed</html>', { status: 405 })
    expect(await askOllie({ ...base, fetchImpl: server(pages) })).toEqual({ ok: false, error: 'unavailable' })
  })

  it('shortens long earlier answers so the next question still fits', async () => {
    const captured: Captured[] = []
    const history: ChatMessage[] = [{ role: 'user', content: 'list my bills' }, { role: 'assistant', content: 'x'.repeat(3_000) }]
    await askOllie({ ...base, history, fetchImpl: server(json({ answer: 'ok' }), captured) })
    const sent = JSON.parse(captured[0].init.body as string).history
    expect(sent[1].content.length).toBeLessThanOrEqual(MAX_TURN)
  })

  it('maps server replies', async () => {
    const run = (make: () => Response) => askOllie({ ...base, fetchImpl: server(make) })
    expect(await run(json({ answer: ' Hi ' }))).toEqual({ ok: true, answer: 'Hi' })
    expect(await run(json({ error: 'not-configured' }, 503))).toEqual({ ok: false, error: 'not-configured' })
    expect(await run(json({ error: 'rate-limit', retryAfter: 300 }, 429))).toEqual({ ok: false, error: 'rate-limit', retryAfter: 300 })
    expect(await run(json({ error: 'failed' }, 502))).toEqual({ ok: false, error: 'failed' })
    expect(await run(() => new Response('Not found', { status: 404 }))).toEqual({ ok: false, error: 'unavailable' })
    expect(await run(() => new Response('<html>', { status: 200 }))).toEqual({ ok: false, error: 'failed' })
    const offline = (async () => { throw new TypeError('Failed to fetch') }) as typeof fetch
    expect(await askOllie({ ...base, fetchImpl: offline })).toEqual({ ok: false, error: 'offline' })
  })
})

describe('errorMessage', () => {
  it('explains each failure plainly', () => {
    expect(errorMessage('not-configured')).toBe("Ask Ollie isn't set up yet.")
    expect(errorMessage('unavailable')).toBe('Ask Ollie only works on the Vercel version of the app.')
    expect(errorMessage('offline')).toBe('No connection. Ollie needs the internet to answer.')
    expect(errorMessage('rate-limit')).toBe("Ollie has answered a lot of questions for now. Try again in a minute.")
    expect(errorMessage('rate-limit', 300)).toContain('about 5 minutes')
    expect(errorMessage('failed')).toBe("Ollie couldn't get an answer. Try again.")
  })
})
