/**
 * Ollie's answers come back as light Markdown (bold, bullet and numbered
 * lists, the odd heading). This turns that into plain data the chat renders
 * with React elements — no HTML is ever injected.
 */

export type Span = { text: string; bold: boolean }
export type Line = Span[]
export type Block =
  | { type: 'p'; lines: Line[] }
  | { type: 'ul'; items: Line[] }
  | { type: 'ol'; items: Line[] }

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/
const HEADING = /^\s*#{1,6}\s+(.*)$/
const BOLD = /\*\*(.+?)\*\*|__(.+?)__/g
const ITALIC = /(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\w)/g

/** Removes markers we don't style: `code` and *italics*. */
function stripMinor(text: string): string {
  return text.replace(/`([^`]*)`/g, '$1').replace(ITALIC, '$1$2')
}

function parseInline(text: string): Line {
  const spans: Span[] = []
  const push = (value: string, isBold: boolean) => {
    if (!value) return
    const last = spans[spans.length - 1]
    if (last && last.bold === isBold) last.text += value
    else spans.push({ text: value, bold: isBold })
  }
  let index = 0
  for (const match of text.matchAll(BOLD)) {
    push(stripMinor(text.slice(index, match.index)), false)
    push(stripMinor(match[1] ?? match[2]), true)
    index = (match.index ?? 0) + match[0].length
  }
  push(stripMinor(text.slice(index)), false)
  return spans
}

export function parseAnswer(text: string): Block[] {
  const blocks: Block[] = []
  // Widened on purpose: close() reassigns it, which TypeScript's narrowing can't see.
  let current = null as Block | null
  const close = () => {
    if (current) blocks.push(current)
    current = null
  }

  const cleaned = text
    .replace(/\r\n/g, '\n')
    // The model sometimes uses narrow or no-break spaces, which phones show as odd gaps.
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')

  for (const raw of cleaned.split('\n')) {
    if (!raw.trim()) {
      close()
      continue
    }
    const bullet = BULLET.exec(raw)
    const numbered = bullet ? null : NUMBERED.exec(raw)
    const listType = bullet ? 'ul' : numbered ? 'ol' : null
    if (listType) {
      const item = parseInline((bullet ?? numbered)![1])
      if (current?.type !== listType) {
        close()
        current = { type: listType, items: [] }
      }
      ;(current as { items: Line[] }).items.push(item)
      continue
    }
    const heading = HEADING.exec(raw)
    const line = heading
      ? parseInline(heading[1]).map((s) => ({ ...s, bold: true }))
      : parseInline(raw)
    if (current?.type !== 'p') {
      close()
      current = { type: 'p', lines: [] }
    }
    ;(current as { lines: Line[] }).lines.push(line)
  }
  close()
  return blocks
}
