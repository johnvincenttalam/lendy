import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, CalendarDays, X } from 'lucide-react'
import CurrencyAmount from '../../components/CurrencyAmount'
import type { OllieSituation } from './ollieTypes'
import type { Deadline } from '../../core/deadlines/deadlines'
import type { OllieMessageContent } from './ollieMessages'
import { describeDue } from './ollieMessages'
import type { OllieTone } from './ollieStates'

type Props = {
  situation: OllieSituation
  content: OllieMessageContent
  tone: OllieTone
  now: Date
  critical: boolean
  onDismiss: () => void
}

/** Where a message about one loan or bill links to, and what the link says. */
function focusLink(situation: OllieSituation): { href: string; label: string } | null {
  switch (situation.kind) {
    case 'overdue':
    case 'due-today':
    case 'upcoming': {
      if (situation.payments.length !== 1) return null
      const d = situation.payments[0]
      return { href: d.href, label: d.module === 'bills' ? 'View bill' : 'View loan' }
    }
    case 'celebrating':
      return { href: `/loan/${situation.loan.id}`, label: 'View loan' }
    case 'insight':
      return situation.insight.type === 'finish-line' ? { href: `/loan/${situation.insight.loan.id}`, label: 'View loan' } : null
    default:
      return null
  }
}

function duePayments(situation: OllieSituation): Deadline[] {
  return situation.kind === 'overdue' || situation.kind === 'due-today' || situation.kind === 'upcoming'
    ? situation.payments
    : []
}

const linkButton =
  'inline-flex items-center gap-1 text-[13px] font-extrabold text-brand underline decoration-2 underline-offset-[3px] decoration-transparent hover:decoration-current transition-colors rounded-md'

export default function OllieMessage({ situation, content, tone, now, critical, onDismiss }: Props) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()

  const focus = focusLink(situation)
  const payments = duePayments(situation)
  const showDetails = payments.length > 1
  const showCalendar = situation.kind === 'upcoming' || (situation.kind === 'relaxed' && situation.next !== null)
  const showBackup = situation.kind === 'insight' && situation.insight.type === 'backup-due'

  return (
    <div className="relative flex-1 min-w-0 rounded-2xl px-4 py-3.5" style={{ backgroundColor: tone.bubble }}>
      {/* Speech-bubble tail pointing at Ollie */}
      <span
        aria-hidden="true"
        className="absolute -left-[9px] top-1/2 -translate-y-1/2 w-[10px] h-[16px]"
        style={{ backgroundColor: tone.bubble, clipPath: 'polygon(100% 0, 0 50%, 100% 100%)' }}
      />

      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <span className={`inline-block text-[11px] font-extrabold px-2 py-0.5 rounded-full mb-2 ${tone.chip}`}>
            {content.label}
          </span>
          <p className="text-[15px] leading-snug text-primary font-bold">{content.text}</p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label={critical ? 'Minimize reminder' : "Dismiss Ollie's message"}
          title={critical ? 'Minimize' : 'Dismiss'}
          className="-mr-1.5 -mt-1 p-1.5 rounded-full text-secondary hover:text-primary hover:bg-[var(--color-subtle-bg)] transition-colors shrink-0"
        >
          {critical ? <ChevronDown className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </button>
      </div>

      {(focus || showDetails || showCalendar || showBackup) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5">
          {focus && (
            <button type="button" onClick={() => navigate(focus.href)} className={linkButton}>
              {focus.label} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
          {showDetails && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-controls={detailsId}
              className={linkButton}
            >
              {expanded ? 'Hide details' : `View ${payments.length} payments`}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
          {showCalendar && (
            <button type="button" onClick={() => navigate('/calendar')} className={linkButton}>
              <CalendarDays className="w-3.5 h-3.5" /> Schedule
            </button>
          )}
          {showBackup && (
            <button type="button" onClick={() => navigate('/settings')} className={linkButton}>
              Back up now <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {showDetails && expanded && (
        <ul id={detailsId} className="mt-2.5 -mx-1 space-y-0.5 animate-fade-in">
          {payments.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => navigate(p.href)}
                className="w-full flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg hover:bg-subtle transition-colors text-left"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[12.5px] font-semibold text-primary truncate">{p.title}</span>
                  <span className={`block text-[11px] ${p.daysUntil < 0 ? 'text-red-500' : 'text-muted'}`}>
                    {describeDue(p, now)}
                  </span>
                </span>
                <span className="text-[12.5px] font-semibold font-display tabular-nums text-primary shrink-0">
                  <CurrencyAmount value={p.amount} />
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
