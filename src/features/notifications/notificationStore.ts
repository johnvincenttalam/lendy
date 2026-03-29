import { create } from 'zustand'

const ENABLED_KEY = 'loan-tracker-notif-enabled'
const DAYS_KEY = 'loan-tracker-notif-days'
const LAST_CHECKED_KEY = 'loan-tracker-notif-last-checked'

type NotificationStore = {
  enabled: boolean
  reminderDays: number
  lastChecked: string | null
  setEnabled: (v: boolean) => void
  setReminderDays: (n: number) => void
  markChecked: () => void
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  enabled: localStorage.getItem(ENABLED_KEY) === 'true',
  reminderDays: Number(localStorage.getItem(DAYS_KEY)) || 3,
  lastChecked: localStorage.getItem(LAST_CHECKED_KEY),

  setEnabled: (v: boolean) => {
    localStorage.setItem(ENABLED_KEY, String(v))
    set({ enabled: v })
  },

  setReminderDays: (n: number) => {
    localStorage.setItem(DAYS_KEY, String(n))
    set({ reminderDays: n })
  },

  markChecked: () => {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(LAST_CHECKED_KEY, today)
    set({ lastChecked: today })
  },
}))
