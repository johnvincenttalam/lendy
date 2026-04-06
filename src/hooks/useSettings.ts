import { create } from 'zustand'

const STORAGE_KEY = 'loan-tracker-settings'

type Settings = {
  showChart: boolean
}

type SettingsStore = Settings & {
  setShowChart: (show: boolean) => void
}

const DEFAULT_SETTINGS: Settings = { showChart: true }

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Settings>
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS
}

function saveSettings(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...loadSettings(),

  setShowChart: (show) => {
    set({ showChart: show })
    saveSettings({ ...get(), showChart: show })
  },
}))
