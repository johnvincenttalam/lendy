import { describe, it, expect } from 'vitest'
import { QUICK_QUESTIONS } from './quickQuestions'

describe('QUICK_QUESTIONS', () => {
  it('only suggests what Ollie can see (spending isn’t tracked since the Money page went)', () => {
    expect(QUICK_QUESTIONS.length).toBe(3)
    for (const q of QUICK_QUESTIONS) expect(q).not.toMatch(/spen[dt]/i)
  })
})
