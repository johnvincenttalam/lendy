// Shared styling constants

export const progressBarStyles = (color: string) => ({
  track: { backgroundColor: `${color}15` },
  bar: { background: `linear-gradient(90deg, ${color}, ${color}dd)` },
})

export const badgeStyles = (color: string) => ({
  container: { backgroundColor: `${color}10`, color },
})
