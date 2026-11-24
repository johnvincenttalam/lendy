import { describe, it, expect } from 'vitest'
import { ollieView } from './ollieStates'

describe('ollieView', () => {
  it('shows the full message until it is closed', () => {
    expect(ollieView(false, false)).toBe('full')
    expect(ollieView(false, true)).toBe('full')
  })

  it('shrinks a closed reminder to its summary bar', () => {
    expect(ollieView(true, true)).toBe('reminder-bar')
  })

  it('leaves a Show Ollie bar after any other message is closed', () => {
    expect(ollieView(true, false)).toBe('show-bar')
  })
})
