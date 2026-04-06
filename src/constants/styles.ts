// Shared styling constants

export const BRAND_GRADIENT = 'linear-gradient(135deg, #E8541E 0%, #F3622D 40%, #F87E54 100%)'

export const progressBarStyles = (color: string) => ({
  track: { backgroundColor: `${color}15` },
  bar: { background: `linear-gradient(90deg, ${color}, ${color}dd)` },
})

export const badgeStyles = (color: string) => ({
  container: { backgroundColor: `${color}10`, color },
})
