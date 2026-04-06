import { create } from 'zustand'

const ENABLED_KEY = 'loan-tracker-notif-enabled'
const DAYS_KEY = 'loan-tracker-notif-days'
const LAST_CHECKED_KEY = 'loan-tracker-notif-last-checked'
const REMIND_ON_DUE_KEY = 'loan-tracker-notif-on-due'
const REMIND_OVERDUE_KEY = 'loan-tracker-notif-overdue'
const REMINDER_TIME_KEY = 'loan-tracker-notif-time'

type NotificationStore = {
  enabled: boolean
  reminderDays: number
  remindOnDueDate: boolean
  remindOverdue: boolean
  reminderTime: string // HH:MM format
  lastChecked: string | null
  setEnabled: (v: boolean) => void
  setReminderDays: (n: number) => void
  setRemindOnDueDate: (v: boolean) => void
  setRemindOverdue: (v: boolean) => void
  setReminderTime: (t: string) => void
  markChecked: () => void
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  enabled: localStorage.getItem(ENABLED_KEY) === 'true',
  reminderDays: Number(localStorage.getItem(DAYS_KEY)) || 3,
  remindOnDueDate: localStorage.getItem(REMIND_ON_DUE_KEY) !== 'false', // default true
  remindOverdue: localStorage.getItem(REMIND_OVERDUE_KEY) !== 'false', // default true
  reminderTime: localStorage.getItem(REMINDER_TIME_KEY) || '09:00',
  lastChecked: localStorage.getItem(LAST_CHECKED_KEY),

  setEnabled: (v: boolean) => {
    localStorage.setItem(ENABLED_KEY, String(v))
    set({ enabled: v })
  },

  setReminderDays: (n: number) => {
    localStorage.setItem(DAYS_KEY, String(n))
    set({ reminderDays: n })
  },

  setRemindOnDueDate: (v: boolean) => {
    localStorage.setItem(REMIND_ON_DUE_KEY, String(v))
    set({ remindOnDueDate: v })
  },

  setRemindOverdue: (v: boolean) => {
    localStorage.setItem(REMIND_OVERDUE_KEY, String(v))
    set({ remindOverdue: v })
  },

  setReminderTime: (t: string) => {
    localStorage.setItem(REMINDER_TIME_KEY, t)
    set({ reminderTime: t })
  },

  markChecked: () => {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(LAST_CHECKED_KEY, today)
    set({ lastChecked: today })
  },
}))
