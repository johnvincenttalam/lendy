import { Fragment, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowUp, RotateCcw } from 'lucide-react'
import OllieCharacter from '../ollie/OllieCharacter'
import { askOllie, errorMessage } from './askClient'
import type { ChatMessage } from './askClient'
import { buildSummary } from './summary'
import { readSummaryInput } from './readSummaryInput'
import { useDashboardChat } from './dashboardChat'
import { parseAnswer } from './formatAnswer'
import type { Line } from './formatAnswer'
import { usePrivateFolderStore } from '../privateFolder/privateFolderStore'
import { folderLabel } from '../privateFolder/privateFolderUtils'
import type { Bubble } from './dashboardChat'

const QUICK_QUESTIONS = ['Biggest loan?', "What's due this week?", 'How much did I spend this month?']

/**
 * A read-only chat with Ollie. `frame` places the conversation and the input
 * (a sheet in the private folder, a full page on the Ollie tab).
 * - Outside the folder, the conversation is kept in memory while the app is
 *   open, so leaving the page or closing it by accident doesn't lose it.
 * - From the private folder (`includePrivate`), it lives only in this
 *   component: closing the sheet or locking the folder throws it away, so
 *   nothing about a private loan is left behind to scroll back to.
 */
export default function AskOllieChat({ includePrivate, frame }: {
  includePrivate: boolean
  frame: (conversation: ReactNode, input: ReactNode) => ReactNode
}) {
  const remembered = useDashboardChat()
  const [localMessages, setLocalMessages] = useState<Bubble[]>([])
  const [localWaiting, setLocalWaiting] = useState(false)
  const remember = !includePrivate
  const messages = remember ? remembered.messages : localMessages
  const waiting = remember ? remembered.waiting : localWaiting
  const add = remember ? remembered.add : (m: Bubble) => setLocalMessages((prev) => [...prev, m])
  const setWaiting = remember ? remembered.setWaiting : setLocalWaiting
  const [draft, setDraft] = useState('')
  const folderName = usePrivateFolderStore((s) => s.name)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages, waiting])

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || waiting) return
    // Failed turns aren't real answers — keep them out of what Groq sees.
    const history: ChatMessage[] = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }))
    add({ role: 'user', content: question })
    setDraft('')
    setWaiting(true)
    const result = await askOllie({
      summary: buildSummary(readSummaryInput(includePrivate), new Date()),
      history,
      question,
    })
    // For the dashboard chat this lands even if the sheet was closed meanwhile.
    setWaiting(false)
    add(result.ok
      ? { role: 'assistant', content: result.answer }
      : { role: 'assistant', content: errorMessage(result.error, result.retryAfter), error: true })
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

  const conversation = (
      <div className="space-y-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex flex-col items-center text-center pt-4">
            <OllieCharacter mood="happy" />
            <p className="text-[15px] font-bold text-primary mt-3">What would you like to know?</p>
            <p className="text-[13px] text-muted mt-1">
              {includePrivate
                ? `I can see the loans in ${folderLabel(folderName)} too, as well as your bills, savings and spending.`
                : 'I can answer questions about your loans, bills, savings and spending.'}
            </p>
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

        {remember && messages.length > 0 && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={remembered.clear}
              disabled={waiting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--tint-neutral)] text-[12px] font-semibold text-secondary disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New chat
            </button>
          </div>
        )}

        {messages.map((m, i) => (
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-md bg-brand text-on-brand px-3.5 py-2 text-[14px] leading-snug whitespace-pre-wrap">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={i} className="flex items-end gap-2.5">
              <OllieCharacter mood={m.error ? 'alert' : 'happy'} sizeClassName="w-12" still />
              <div
                className="max-w-[78%] min-w-0 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[14px] leading-snug text-primary"
                style={{ backgroundColor: m.error ? 'var(--tint-red)' : 'var(--tint-neutral)' }}
              >
                {m.error ? m.content : <AnswerText text={m.content} />}
              </div>
            </div>
          )
        ))}

        {waiting && (
          <div className="flex items-end gap-2.5">
            <OllieCharacter mood="thinking" sizeClassName="w-12" />
            <div className="rounded-2xl rounded-bl-md px-3.5 py-3 bg-[var(--tint-neutral)]">
              <span className="sr-only">Ollie is thinking</span>
              <span className="inline-flex gap-1" aria-hidden="true">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-pulse [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
  )

  return frame(conversation, footer)
}

/** One of Ollie's answers: bold, bullet and numbered lists, rendered as elements. */
function AnswerText({ text }: { text: string }) {
  const renderLine = (line: Line) =>
    line.map((span, i) => (span.bold ? <strong key={i} className="font-bold">{span.text}</strong> : <Fragment key={i}>{span.text}</Fragment>))

  return (
    <div className="space-y-2">
      {parseAnswer(text).map((block, i) => {
        if (block.type === 'p') {
          return (
            <p key={i}>
              {block.lines.map((line, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {renderLine(line)}
                </Fragment>
              ))}
            </p>
          )
        }
        const List = block.type === 'ul' ? 'ul' : 'ol'
        return (
          <List key={i} className={`pl-5 space-y-1 ${block.type === 'ul' ? 'list-disc' : 'list-decimal'} marker:text-[var(--color-text-muted)]`}>
            {block.items.map((item, j) => <li key={j}>{renderLine(item)}</li>)}
          </List>
        )
      })}
    </div>
  )
}
