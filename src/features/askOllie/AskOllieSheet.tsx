import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import Sheet from '../money/Sheet'
import OllieCharacter from '../ollie/OllieCharacter'
import { askOllie, errorMessage } from './askClient'
import type { ChatMessage } from './askClient'
import { buildSummary } from './summary'
import { readSummaryInput } from './readSummaryInput'

const QUICK_QUESTIONS = ['Biggest loan?', "What's due this week?", 'How much did I spend this month?']

type Bubble = ChatMessage & { error?: boolean }

/**
 * A read-only chat with Ollie. The conversation lives only in this
 * component: closing the sheet throws it away, so nothing about a private
 * loan is left behind to scroll back to.
 */
export default function AskOllieSheet({ includePrivate, onClose }: { includePrivate: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Bubble[]>([])
  const [draft, setDraft] = useState('')
  const [waiting, setWaiting] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages, waiting])

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || waiting) return
    // Failed turns aren't real answers — keep them out of what Groq sees.
    const history: ChatMessage[] = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }))
    setMessages((m) => [...m, { role: 'user', content: question }])
    setDraft('')
    setWaiting(true)
    const result = await askOllie({
      summary: buildSummary(readSummaryInput(includePrivate), new Date()),
      history,
      question,
    })
    setWaiting(false)
    setMessages((m) => [...m, result.ok
      ? { role: 'assistant', content: result.answer }
      : { role: 'assistant', content: errorMessage(result.error, result.retryAfter), error: true }])
  }

  const footer = (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        void send(draft)
      }}
    >
      <label htmlFor="ask-ollie-input" className="sr-only">Ask Ollie a question</label>
      <input
        id="ask-ollie-input"
        className="input-field flex-1 min-w-0"
        placeholder="Ask about your money…"
        value={draft}
        maxLength={500}
        autoComplete="off"
        onChange={(e) => setDraft(e.target.value)}
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={waiting || !draft.trim()}
        className="w-11 h-11 shrink-0 rounded-full bg-brand text-on-brand flex items-center justify-center disabled:opacity-40 transition-opacity"
      >
        <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
      </button>
    </form>
  )

  return (
    <Sheet title="Ask Ollie" onClose={onClose} footer={footer}>
      <div className="space-y-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex flex-col items-center text-center pt-4">
            <OllieCharacter mood="happy" />
            <p className="text-[15px] font-bold text-primary mt-3">What would you like to know?</p>
            <p className="text-[13px] text-muted mt-1">I can answer questions about your loans, bills, savings and spending.</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void send(q)}
                  className="px-3 py-2 rounded-full bg-[var(--tint-teal)] text-[13px] font-semibold text-primary"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-md bg-brand text-on-brand px-3.5 py-2 text-[14px] whitespace-pre-wrap">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={i} className="flex items-end gap-2">
              <OllieCharacter mood={m.error ? 'alert' : 'happy'} sizeClassName="w-8" still />
              <p
                className="max-w-[80%] rounded-2xl rounded-bl-md px-3.5 py-2 text-[14px] text-primary whitespace-pre-wrap"
                style={{ backgroundColor: m.error ? 'var(--tint-red)' : 'var(--tint-neutral)' }}
              >
                {m.content}
              </p>
            </div>
          )
        ))}

        {waiting && (
          <div className="flex items-end gap-2">
            <OllieCharacter mood="thinking" sizeClassName="w-8" still />
            <p className="rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-[var(--tint-neutral)]" aria-label="Ollie is thinking">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-pulse [animation-delay:300ms]" />
              </span>
            </p>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </Sheet>
  )
}
