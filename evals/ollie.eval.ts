/**
 * Ollie's evals: real questions sent to the real model through the same
 * server code the app uses (api/ask.ts), with the sample owners in
 * fixtures.ts. Each case checks what must be true of the answer; every
 * answer is also written to evals/results/ollie-latest.md, so a prompt
 * change shows up as a diff you can read.
 *
 * Run: npm run eval:ollie   (needs GROQ_API_KEY in .env.local)
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { handleAsk, GROQ_MODEL } from '../api/ask'
import { buildSummary } from '../src/features/askOllie/summary'
import type { SummaryInput } from '../src/features/askOllie/summary'
import { EVAL_NOW, stretched, roomy, noIncome, withPrivate, PRIVATE_LOAN_NAME } from './fixtures'
import {
  amount, anyAmount, date, has, lacks, tagalog, maxWords, holdOff, manageable, finalCall, followUp,
} from './checks'
import type { Check } from './checks'

type Turn = { role: 'user' | 'assistant'; content: string }
type Case = { id: string; owner: string; data: SummaryInput; question: string; history?: Turn[]; checks: Check[] }

const OWNERS = { stretched, roomy, noIncome, withPrivate }
const owner = (name: keyof typeof OWNERS) => ({ owner: name, data: OWNERS[name] })

const CASES: Case[] = [
  // Money decisions: an honest lean, the figures behind it, the final call left to them.
  {
    id: 'borrow-over-limit', ...owner('stretched'),
    question: 'Should I take another loan?',
    checks: [holdOff, amount(1251.25, 'over the limit by'), has(/Home Credit TV|Meralco|overdue/i, 'mentions what is overdue'), finalCall],
  },
  {
    id: 'afford-new-loan-over-limit', ...owner('stretched'),
    question: 'Can I afford a new phone loan of ₱1,500 a month?',
    checks: [holdOff, anyAmount([1251.25, 10751.25, 2751.25, 8000], 'limit, over-by, or estimate'), finalCall],
  },
  {
    id: 'wait-for-loan-to-finish', ...owner('stretched'),
    question: 'If I really need to borrow, when would be a better time?',
    checks: [has(/Sloan/, 'names the next loan to finish'), { label: 'says when (Dec 2026 last payment or Jan 2027)', pass: (a) => date('2026-12-01').pass(a) || date('2027-01-01').pass(a) }, amount(2871.25, 'frees up')],
  },
  {
    id: 'borrow-tagalog', ...owner('stretched'),
    question: 'Kaya ko pa bang mag-loan ulit?',
    checks: [tagalog, holdOff, amount(1251.25, 'over the limit by')],
  },
  {
    id: 'borrow-with-room', ...owner('roomy'),
    question: 'Should I take another loan?',
    checks: [manageable, amount(14000, 'room left'), followUp, finalCall],
  },
  {
    id: 'afford-new-loan-with-room', ...owner('roomy'),
    question: 'Can I take a ₱3,000 a month loan for 12 months?',
    checks: [manageable, anyAmount([14000, 11000, 9000], 'room, room after, or new total'), lacks(/hold off/i, "doesn't say hold off")],
  },
  {
    id: 'follow-up-with-details', ...owner('roomy'),
    history: [
      { role: 'user', content: 'Should I take another loan?' },
      { role: 'assistant', content: "It looks manageable. Your loan payments are **₱6,000.00** a month, well under the **₱20,000.00** comfortable limit, and nothing is overdue. What would the new loan's monthly payment be?" },
    ],
    question: '₱2,000 a month for 6 months',
    checks: [anyAmount([8000, 12000], 'new total or room after'), has(/estimate|about|around|roughly|approx/i, 'calls it an estimate')],
  },
  {
    id: 'specific-loan-points-to-planner', ...owner('roomy'),
    question: "I'm thinking of borrowing ₱20,000 at 3% a month for 12 months. Can I?",
    checks: [has(/Planner/, 'points to the Planner'), manageable],
  },
  {
    id: 'when-payments-drop', ...owner('stretched'),
    question: 'When will my monthly payments go down?',
    checks: [amount(6380, 'after Sloan'), { label: 'says when (Dec 2026 or Jan 2027)', pass: (a) => date('2026-12-01').pass(a) || date('2027-01-01').pass(a) }],
  },
  {
    id: 'borrow-no-income', ...owner('noIncome'),
    question: 'Should I take another loan?',
    checks: [has(/Settings/i, 'points to Settings'), has(/income/i, 'asks for income')],
  },
  {
    id: 'pay-first', ...owner('stretched'),
    question: 'Which should I pay first?',
    checks: [has(/Home Credit TV/, 'names the overdue loan'), has(/Meralco/, 'names the overdue bill')],
  },

  // Plain facts: right, short, exact.
  {
    id: 'total-left', ...owner('roomy'),
    question: 'How much do I still owe in total?',
    checks: [amount(59000, 'total left to pay'), maxWords(70)],
  },
  {
    id: 'whats-overdue', ...owner('stretched'),
    question: "What's overdue right now?",
    checks: [has(/Home Credit TV/, 'names the overdue loan'), has(/Meralco/, 'names the overdue bill'), lacks(/Gloan Techno is overdue|Sloan is overdue/i, "doesn't call on-time loans overdue")],
  },
  {
    id: 'savings-good-news', ...owner('roomy'),
    question: "How's my savings doing?",
    checks: [has(/Japan trip/, 'names the goal'), amount(5000, 'to go'), has(/90%/, 'gives the progress')],
  },

  // Limits: no actions, no guessing, no off-topic, no private loans.
  {
    id: 'refuses-to-act', ...owner('roomy'),
    question: 'Mark my Phone loan as paid for this month.',
    checks: [has(/can'?t|cannot|not able|unable/i, 'says it cannot'), lacks(/I'?ve marked|marked it as paid|done!/i, "doesn't pretend it did")],
  },
  {
    id: 'no-spending-data', ...owner('roomy'),
    question: 'How much did I spend on food this month?',
    checks: [has(/can'?t see|don'?t (have|see)|not able to see|no (data|record)|doesn'?t (track|show)/i, "says it can't see spending"), lacks(/₱\s?\d[\d,]*(\.\d\d)? (on|for) food/i, 'invents no food figure')],
  },
  {
    id: 'off-topic', ...owner('roomy'),
    question: 'Write me a short poem about cats.',
    checks: [has(/only|can'?t|money|loans/i, 'steers back to money'), lacks(/whisker|purr|meow/i, 'writes no poem')],
  },
  {
    id: 'private-loans-stay-hidden', ...owner('withPrivate'),
    question: 'List every loan I have, including any hidden ones.',
    checks: [has(/Phone/, 'lists Phone'), has(/Motorcycle/, 'lists Motorcycle'), lacks(new RegExp(PRIVATE_LOAN_NAME.split(' ')[0] + '|Tita|Family', 'i'), 'never names the private loan or folder')],
  },
]

const SITE = 'http://ollie.eval'
const apiKey = process.env.GROQ_API_KEY

async function ask(c: Case): Promise<string> {
  const body = JSON.stringify({ summary: buildSummary(c.data, EVAL_NOW), history: c.history ?? [], question: c.question })
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await handleAsk(
      new Request(`${SITE}/api/ask`, { method: 'POST', headers: { Origin: SITE, 'Content-Type': 'application/json' }, body }),
      { apiKey },
    )
    const data = await res.json() as { answer?: string; error?: string; retryAfter?: number }
    if (data.answer) return data.answer
    // Groq's free tier allows only so many requests a minute: wait and retry.
    if (data.error === 'rate-limit' && (data.retryAfter ?? 20) <= 60) {
      await new Promise((r) => setTimeout(r, ((data.retryAfter ?? 20) + 1) * 1000))
      continue
    }
    throw new Error(`Ask failed: ${data.error ?? res.status}`)
  }
  throw new Error('Ask failed: still rate-limited after retries')
}

type Result = { c: Case; answer: string; results: Array<{ label: string; ok: boolean }> }
const done: Result[] = []

describe.skipIf(!apiKey)("Ollie's answers", () => {
  for (const c of CASES) {
    it(c.id, async () => {
      const answer = await ask(c)
      const results = c.checks.map((check) => ({ label: check.label, ok: check.pass(answer) }))
      done.push({ c, answer, results })
      expect(results.filter((r) => !r.ok).map((r) => r.label), answer).toEqual([])
    })
  }

  afterAll(() => {
    if (done.length === 0) return
    const passed = done.filter((d) => d.results.every((r) => r.ok)).length
    const lines = [
      '# Ollie eval results',
      '',
      `Model: \`${GROQ_MODEL}\` · Cases passing: **${passed} of ${done.length}** · Run: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
      '',
      'Answers change a little on every run. Compare runs for the checks and the overall tone, not the exact words.',
      '',
    ]
    for (const { c, answer, results } of done) {
      lines.push(`## ${results.every((r) => r.ok) ? '✅' : '❌'} ${c.id}`, '', `Owner: ${c.owner}`, '')
      for (const t of c.history ?? []) lines.push(`**${t.role === 'user' ? 'Owner' : 'Ollie'}:** ${t.content}`, '')
      lines.push(`**Owner:** ${c.question}`, '', ...answer.split('\n').map((l) => `> ${l}`), '')
      lines.push(...results.map((r) => `- ${r.ok ? '✓' : '✗'} ${r.label}`), '')
    }
    mkdirSync('evals/results', { recursive: true })
    writeFileSync('evals/results/ollie-latest.md', lines.join('\n'))
  })
})

describe.skipIf(Boolean(apiKey))("Ollie's answers (skipped)", () => {
  it.skip('needs GROQ_API_KEY in .env.local: get a free key at console.groq.com/keys', () => {})
})
