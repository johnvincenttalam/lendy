/**
 * Small, forgiving checks on Ollie's free-text answers. They test what must
 * be true (the right figure, an honest lean, a refusal) without demanding
 * exact wording, since the model phrases things differently every run.
 */

export type Check = { label: string; pass: (answer: string) => boolean }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Matches 8000 as "₱8,000.00", "₱8,000", "8,000" or "P8,000", but not "18,000" or "8,0001". */
export function mentionsAmount(answer: string, amount: number): boolean {
  const whole = Math.floor(amount)
  const cents = Math.round((amount - whole) * 100)
  const grouped = whole.toLocaleString('en-US')
  const decimals = cents === 0 ? String.raw`(?:\.00)?` : String.raw`\.${String(cents).padStart(2, '0')}`
  const pattern = new RegExp(String.raw`(?<![\d,.])${grouped.replace(/,/g, ',?')}${decimals}(?!\d|[,.]\d)`)
  return pattern.test(answer.replace(/\*\*/g, ''))
}

/** Matches 2027-01-01 as the ISO date, or the month name with the year ("January 2027", "Jan 1, 2027"). */
export function mentionsDate(answer: string, iso: string): boolean {
  if (answer.includes(iso)) return true
  const [year, month] = iso.split('-').map(Number)
  const name = MONTHS[month - 1]
  return new RegExp(String.raw`\b(?:${name}|${name.slice(0, 3)})\.?\b[^.\n]{0,8}\b${year}\b`, 'i').test(answer)
}

/** A rough "is this Tagalog or Taglish?" test: enough common Tagalog words. */
export function looksTagalog(answer: string): boolean {
  const words = answer.toLowerCase().match(/[a-z']+/g) ?? []
  const tagalog = new Set(['ang', 'ng', 'mga', 'mo', 'ko', 'ka', 'na', 'pa', 'po', 'lang', 'kasi', 'pero', 'kung', 'ito', 'yung', 'sa', 'ay', 'muna', 'pwede', 'kaya', 'wala', 'may', 'ba', 'naman', 'talaga', 'ikaw', 'iyong', 'mong', 'natin'])
  return words.filter((w) => tagalog.has(w)).length >= 4
}

export function wordCount(answer: string): number {
  return (answer.match(/\S+/g) ?? []).length
}

// Ready-made checks.
export const amount = (n: number, what = ''): Check => ({
  label: `mentions ${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}${what ? ` (${what})` : ''}`,
  pass: (a) => mentionsAmount(a, n),
})
export const anyAmount = (ns: number[], what: string): Check => ({
  label: `mentions one of ${ns.join(' / ')} (${what})`,
  pass: (a) => ns.some((n) => mentionsAmount(a, n)),
})
export const date = (iso: string, what = ''): Check => ({
  label: `mentions ${iso}${what ? ` (${what})` : ''}`,
  pass: (a) => mentionsDate(a, iso),
})
export const has = (re: RegExp, label: string): Check => ({ label, pass: (a) => re.test(a) })
export const lacks = (re: RegExp, label: string): Check => ({ label, pass: (a) => !re.test(a) })
export const tagalog: Check = { label: 'answers in Tagalog/Taglish', pass: looksTagalog }
export const maxWords = (n: number): Check => ({ label: `at most ${n} words`, pass: (a) => wordCount(a) <= n })

export const holdOff = has(/hold off|wait|not (the best|a good|the right) time|tight|wouldn'?t|i'?d pause|too much|stretch|huwag muna|maghintay|hintay/i, 'leans "hold off"')
export const manageable = has(/manageable|doable|room|comfortabl|can (handle|afford)|fits|kaya/i, 'leans "manageable"')
export const finalCall = has(/your call|up to you|final (call|decision|say)|you decide|ikaw (pa rin )?ang (bahala|magdedesisyon)|nasa ('?yo|iyo)/i, 'says the final call is theirs')
export const followUp = has(/\?/, 'asks a follow-up question')
