import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS, parseSettings } from './settings'

describe('parseSettings', () => {
  it('gives the defaults when nothing is saved', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
  })

  it('gives the defaults for unreadable text', () => {
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps the good parts of a damaged value', () => {
    expect(parseSettings('{"home":{"order":["a"],"hidden":"x"}}')).toEqual({
      home: { order: ['a'], hidden: [] },
      sidebarCollapsed: false,
    })
  })

  it('ignores fields it does not know', () => {
    expect(parseSettings('{"sidebarCollapsed":true,"theme":"dark"}')).toEqual({ ...DEFAULT_SETTINGS, sidebarCollapsed: true })
  })

  it('round-trips a saved value', () => {
    const saved = { home: { order: ['loans', 'due-soon'], hidden: ['health'] }, sidebarCollapsed: true }
    expect(parseSettings(JSON.stringify(saved))).toEqual(saved)
  })
})
