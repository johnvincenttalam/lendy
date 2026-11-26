/** When this device last made or restored a backup (ISO time). */
export const LAST_BACKUP_KEY = 'loan-tracker-last-backup'

/** After this many days without a backup, Ollie suggests making one. */
export const BACKUP_STALE_DAYS = 30

/** Whole calendar days since the last backup, or null if there has never been one. */
export function daysSinceBackup(lastBackupAt: string | null, now: Date): number | null {
  if (!lastBackupAt) return null
  const at = new Date(lastBackupAt)
  if (Number.isNaN(at.getTime())) return null
  // Local y/m/d fields, so a daylight-saving shift can't skew the count.
  const from = Date.UTC(at.getFullYear(), at.getMonth(), at.getDate())
  const to = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.round((to - from) / 86_400_000))
}

export function isBackupDue(lastBackupAt: string | null, now: Date): boolean {
  const days = daysSinceBackup(lastBackupAt, now)
  return days === null || days >= BACKUP_STALE_DAYS
}

/** "Never backed up", "Last backup: today", "Last backup: 34 days ago"… */
export function describeLastBackup(lastBackupAt: string | null, now: Date): string {
  const days = daysSinceBackup(lastBackupAt, now)
  if (days === null) return 'Never backed up'
  if (days === 0) return 'Last backup: today'
  if (days === 1) return 'Last backup: yesterday'
  return `Last backup: ${days} days ago`
}
