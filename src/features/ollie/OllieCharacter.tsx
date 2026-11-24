import { useState } from 'react'
import type { OllieMood } from './ollieTypes'
import { OLLIE_ALT, OLLIE_ANIMATION, OLLIE_FALLBACK_MOOD, OLLIE_IMAGES } from './ollieStates'

type Props = {
  mood: OllieMood
  /** Play the one-off confetti burst (celebrations). */
  celebrate?: boolean
  /** Tailwind width classes; height follows the artwork's own aspect ratio. */
  sizeClassName?: string
  /** Skip the idle animation (e.g. the compact minimized bar). */
  still?: boolean
}

const CONFETTI_COLORS = ['#14B8A6', '#037574', '#F2A33A', '#E07A3F', '#3B82F6', '#EC4899']
const CONFETTI_COUNT = 12

/** Evenly fanned particles — deterministic so renders stay pure. */
const CONFETTI = Array.from({ length: CONFETTI_COUNT }, (_, i) => {
  const angle = (i / CONFETTI_COUNT) * Math.PI * 2 - Math.PI / 2
  const distance = 34 + (i % 3) * 10
  return {
    dx: Math.round(Math.cos(angle) * distance),
    dy: Math.round(Math.sin(angle) * distance * 0.85),
    rotate: (i * 47) % 360,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: (i % 4) * 0.04,
    round: i % 3 === 0,
  }
})

/**
 * Ollie's artwork for the current mood. The supplied PNGs are shown as-is —
 * only the wrapper moves, and the image keeps its square aspect ratio.
 */
export default function OllieCharacter({ mood, celebrate = false, sizeClassName = 'w-[72px] sm:w-[88px]', still = false }: Props) {
  // If an expression's file is missing, fall back to the happy artwork
  // instead of showing a broken image.
  const [failedMood, setFailedMood] = useState<OllieMood | null>(null)
  const shownMood = failedMood === mood ? OLLIE_FALLBACK_MOOD : mood

  return (
    <div className={`relative shrink-0 self-center ${sizeClassName}`}>
      <div className={still ? '' : `ollie-anim ${OLLIE_ANIMATION[mood]}`}>
        <img
          key={shownMood}
          src={OLLIE_IMAGES[shownMood]}
          alt={OLLIE_ALT[mood]}
          width={384}
          height={384}
          decoding="async"
          draggable={false}
          onError={() => { if (shownMood !== OLLIE_FALLBACK_MOOD) setFailedMood(mood) }}
          className="block w-full h-auto object-contain select-none animate-fade-in"
        />
      </div>

      {celebrate && (
        <div className="ollie-confetti pointer-events-none absolute inset-0" aria-hidden="true">
          {CONFETTI.map((p, i) => (
            <span
              key={i}
              className={`absolute left-1/2 top-[38%] w-1.5 h-2 ${p.round ? 'rounded-full' : 'rounded-[1px]'}`}
              style={{
                backgroundColor: p.color,
                animationDelay: `${p.delay}s`,
                '--dx': `${p.dx}px`,
                '--dy': `${p.dy}px`,
                '--rot': `${p.rotate}deg`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
  )
}
