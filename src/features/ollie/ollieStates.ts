import type { OllieMood, OllieSituation, OllieSituationKind } from './ollieTypes'

const ASSET_DIR = `${import.meta.env.BASE_URL}assets/ollie/`

/** Expression artwork, used exactly as supplied. */
export const OLLIE_IMAGES: Record<OllieMood, string> = {
  happy: `${ASSET_DIR}ollie-happy.png`,
  thinking: `${ASSET_DIR}ollie-thinking.png`,
  upcoming: `${ASSET_DIR}ollie-upcoming.png`,
  alert: `${ASSET_DIR}ollie-alert.png`,
  celebrating: `${ASSET_DIR}ollie-celebrating.png`,
  relaxed: `${ASSET_DIR}ollie-relaxed.png`,
}

/** Shown if an expression's file is missing, so Ollie never renders broken. */
export const OLLIE_FALLBACK_MOOD: OllieMood = 'happy'

export const OLLIE_ALT: Record<OllieMood, string> = {
  happy: 'Ollie the owl waving hello',
  thinking: 'Ollie the owl thinking',
  upcoming: 'Ollie the owl holding a calendar',
  alert: 'Ollie the owl calling for your attention',
  celebrating: 'Ollie the owl celebrating',
  relaxed: 'Ollie the owl relaxing',
}

/** Idle animation per expression — see the `.ollie-anim-*` rules in index.css. */
export const OLLIE_ANIMATION: Record<OllieMood, string> = {
  happy: 'ollie-anim-float',
  thinking: 'ollie-anim-tilt',
  upcoming: 'ollie-anim-bounce',
  alert: 'ollie-anim-attention',
  celebrating: 'ollie-anim-celebrate',
  relaxed: 'ollie-anim-breathe',
}

const MOOD_BY_KIND: Record<OllieSituationKind, OllieMood> = {
  overdue: 'alert',
  'due-today': 'alert',
  upcoming: 'upcoming',
  celebrating: 'celebrating',
  insight: 'thinking',
  greeting: 'happy',
  relaxed: 'relaxed',
}

export function moodFor(situation: OllieSituation): OllieMood {
  return MOOD_BY_KIND[situation.kind]
}

/**
 * Critical reminders can be minimized but never fully hidden — they collapse
 * to a compact bar that stays on the dashboard.
 */
export function isCritical(situation: OllieSituation): boolean {
  return situation.kind === 'overdue' || situation.kind === 'due-today'
}

export type OllieTone = {
  /** Speech-bubble fill as a CSS colour — also fills the tail. */
  bubble: string
  /** Small label sticker above the message. */
  chip: string
}

/** Sun-yellow chips keep dark text in both themes for contrast. */
const INK_TEXT = 'text-[#3A2216]'

export const OLLIE_TONES: Record<OllieSituationKind, OllieTone> = {
  overdue: { bubble: 'var(--tint-red)', chip: `bg-red-500 text-white` },
  'due-today': { bubble: 'var(--tint-amber)', chip: `bg-[var(--color-sun)] ${INK_TEXT}` },
  upcoming: { bubble: 'var(--tint-amber)', chip: `bg-[var(--color-sun)] ${INK_TEXT}` },
  celebrating: { bubble: 'var(--tint-teal)', chip: `bg-brand text-on-brand` },
  insight: { bubble: 'var(--color-card)', chip: 'bg-[var(--tint-neutral)] text-primary' },
  greeting: { bubble: 'var(--tint-teal)', chip: `bg-brand text-on-brand` },
  relaxed: { bubble: 'var(--color-card)', chip: `bg-[var(--tint-teal)] text-primary` },
}
