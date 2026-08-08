// Shared styling constants

// Dark charcoal panel with a soft green glow in one corner — Supabase's green
// shows up as a selective accent/signal, not a full-bleed saturated fill.
export const BRAND_GRADIENT =
  'radial-gradient(circle at 15% 15%, rgba(62, 207, 142, 0.18) 0%, transparent 45%), linear-gradient(180deg, #1F1F1F 0%, #181818 100%)'

export const progressBarStyles = (color: string) => ({
  track: { backgroundColor: `${color}15` },
  bar: { background: `linear-gradient(90deg, ${color}, ${color}dd)` },
})

export const badgeStyles = (color: string) => ({
  container: { backgroundColor: `${color}10`, color },
})
