import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { BRAND_GRADIENT } from '../constants/styles'
import { CHANGELOG, CURRENT_VERSION } from '../features/whatsNew/changelog'
import { useSeenVersionStore } from '../features/whatsNew/seenVersionStore'
import { unseenCount } from '../features/whatsNew/whatsNewUtils'
import { formatDate } from '../utils/dateUtils'

export default function WhatsNewPage() {
  const navigate = useNavigate()
  const seenVersion = useSeenVersionStore((s) => s.seenVersion)
  const markCurrentSeen = useSeenVersionStore((s) => s.markCurrentSeen)

  // Snapshot what was unseen on arrival. Marking the release seen updates the
  // store mid-visit, and without this the "New" pills would vanish out from
  // under the reader before they had read them. Releases are newest first, so
  // the first N are the unseen ones.
  const [newOnArrival] = useState(() => unseenCount(CHANGELOG, seenVersion))

  useEffect(() => {
    markCurrentSeen()
  }, [markCurrentSeen])

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <div style={{ background: BRAND_GRADIENT }}>
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-5">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="w-8 h-8 -ml-1.5 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all shrink-0"
            >
              <ArrowLeft className="w-[18px] h-[18px] text-white/70" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold text-white tracking-tight leading-tight">What&rsquo;s New</h1>
              <p className="text-[12px] text-white/55 font-medium">Recent updates to Lendy</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-3">
        {CHANGELOG.map((release, index) => (
          <article
            key={release.version}
            className="bg-card rounded-2xl border border-themed p-4 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[12px] font-bold text-primary tracking-tight">{release.version}</span>
              {index < newOnArrival && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-brand/10 text-brand">
                  New
                </span>
              )}
              <span className="ml-auto text-[11px] text-muted shrink-0">
                {formatDate(release.date, { month: 'long', year: 'numeric' })}
              </span>
            </div>

            <p className="font-semibold text-primary text-[15px] tracking-tight mb-2.5">{release.title}</p>

            <ul className="space-y-1.5">
              {release.highlights.map((highlight) => (
                <li key={highlight} className="flex gap-2 text-[13px] text-secondary leading-snug">
                  <span className="text-brand shrink-0" aria-hidden="true">&bull;</span>
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}

        <p className="text-center text-[11px] text-muted pt-1">Lendy v{CURRENT_VERSION}</p>
      </div>
    </div>
  )
}
