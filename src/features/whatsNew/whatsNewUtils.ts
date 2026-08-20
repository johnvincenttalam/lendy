import type { Release } from './changelog'

const VERSION_PATTERN = /^\d+(\.\d+)*$/

/**
 * Compare two dotted numeric versions, returning a sort-comparator number.
 * Parts are compared as numbers, so 1.10.0 correctly beats 1.9.0, and a
 * missing trailing part counts as zero, so 1.3 equals 1.3.0.
 */
export function compareVersions(a: string, b: string): number {
  const left = a.split('.')
  const right = b.split('.')
  const parts = Math.max(left.length, right.length)

  for (let i = 0; i < parts; i++) {
    const diff = (Number(left[i]) || 0) - (Number(right[i]) || 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * Read a stored "last seen" version. Anything we cannot compare — absent,
 * empty, hand-edited — comes back as null, which shows the badge again. The
 * alternative failure mode, an uncomparable value that suppresses the badge
 * forever, is the one worth avoiding.
 */
export function parseSeenVersion(raw: string | null): string | null {
  if (raw === null) return null
  const trimmed = raw.trim()
  return VERSION_PATTERN.test(trimmed) ? trimmed : null
}

/**
 * How many releases the badge should claim. A fresh install has not missed the
 * whole changelog, so it gets 1 — the current release — rather than the
 * entire history.
 */
export function unseenCount(releases: Release[], seenVersion: string | null): number {
  if (seenVersion === null) return releases.length > 0 ? 1 : 0
  return releases.filter((release) => compareVersions(release.version, seenVersion) > 0).length
}
