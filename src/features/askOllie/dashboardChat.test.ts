import { describe, it, expect, beforeEach } from 'vitest'
import { useDashboardChat } from './dashboardChat'

describe('useDashboardChat', () => {
  beforeEach(() => useDashboardChat.getState().clear())

  it('keeps the conversation after the sheet closes', () => {
    useDashboardChat.getState().add({ role: 'user', content: 'Biggest loan?' })
    useDashboardChat.getState().add({ role: 'assistant', content: 'Phone.' })
    // A newly opened sheet reads the same store.
    expect(useDashboardChat.getState().messages.map((m) => m.content)).toEqual(['Biggest loan?', 'Phone.'])
  })

  it('remembers that Ollie is still thinking', () => {
    useDashboardChat.getState().setWaiting(true)
    expect(useDashboardChat.getState().waiting).toBe(true)
  })

  it('starts a new chat', () => {
    useDashboardChat.getState().add({ role: 'user', content: 'hi' })
    useDashboardChat.getState().setWaiting(true)
    useDashboardChat.getState().clear()
    expect(useDashboardChat.getState().messages).toEqual([])
    expect(useDashboardChat.getState().waiting).toBe(false)
  })
})
