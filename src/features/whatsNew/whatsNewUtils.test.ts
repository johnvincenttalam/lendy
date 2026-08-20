import { describe, it, expect } from 'vitest'
import { compareVersions, parseSeenVersion, unseenCount } from './whatsNewUtils'
import type { Release } from './changelog'

function makeRelease(version: string): Release {
  return {
    version,
    date: '2026-08-20',
    title: `Release ${version}`,
    highlights: ['Something changed'],
  }
}

// Newest first, the same order the changelog itself is stored in.
const RELEASES = [makeRelease('1.3.0'), makeRelease('1.2.0'), makeRelease('1.1.0'), makeRelease('1.0.0')]

describe('compareVersions', () => {
  it('orders by major before minor before patch', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0)
    expect(compareVersions('1.2.0', '1.1.9')).toBeGreaterThan(0)
    expect(compareVersions('1.1.1', '1.1.0')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0)
  })

  it('compares parts numerically, not as text', () => {
    // Lexical comparison would put '1.10.0' before '1.9.0'.
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0)
  })

  it('treats a missing trailing part as zero', () => {
    expect(compareVersions('1.3', '1.3.0')).toBe(0)
    expect(compareVersions('1.3.1', '1.3')).toBeGreaterThan(0)
  })

  it('reports identical versions as equal', () => {
    expect(compareVersions('1.3.0', '1.3.0')).toBe(0)
  })
})

describe('parseSeenVersion', () => {
  it('returns null when nothing has been stored', () => {
    expect(parseSeenVersion(null)).toBeNull()
  })

  it('returns null for a value it cannot compare', () => {
    // A hand-edited or corrupted key must fall back to showing the badge
    // rather than silently suppressing it forever.
    expect(parseSeenVersion('banana')).toBeNull()
    expect(parseSeenVersion('')).toBeNull()
    expect(parseSeenVersion('1.3.0-beta')).toBeNull()
  })

  it('accepts a dotted numeric version, trimmed', () => {
    expect(parseSeenVersion('1.3.0')).toBe('1.3.0')
    expect(parseSeenVersion(' 1.3.0 ')).toBe('1.3.0')
    expect(parseSeenVersion('2')).toBe('2')
  })
})

describe('unseenCount', () => {
  it('counts every release newer than the one last seen', () => {
    expect(unseenCount(RELEASES, '1.1.0')).toBe(2)
  })

  it('counts nothing when the latest release has been seen', () => {
    expect(unseenCount(RELEASES, '1.3.0')).toBe(0)
  })

  it('badges only the current release on a fresh install', () => {
    // A new install has not missed the whole changelog; badging '4' would
    // claim it did.
    expect(unseenCount(RELEASES, null)).toBe(1)
  })

  it('badges nothing on a fresh install with no releases', () => {
    expect(unseenCount([], null)).toBe(0)
  })

  it('counts nothing when the seen version is ahead of the changelog', () => {
    // Restoring an old backup or rolling back a deploy must not badge.
    expect(unseenCount(RELEASES, '2.0.0')).toBe(0)
  })
})
