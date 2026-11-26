import { create } from 'zustand'
import { DEFAULT_SETTINGS, SETTINGS_KEY, parseSettings } from './settings'
import type { HomeLayout, Settings } from './settings'

function load(): Settings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_KEY))
  } catch {
    return DEFAULT_SETTINGS
  }
}

function save(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Storage full or blocked: the layout still applies until the app closes.
  }
}

type SettingsStore = Settings & {
  setHomeLayout: (home: HomeLayout) => void
  resetHomeLayout: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

const snapshot = (s: Settings): Settings => ({ home: s.home, sidebarCollapsed: s.sidebarCollapsed })

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...load(),
  setHomeLayout: (home) => {
    set({ home })
    save(snapshot(get()))
  },
  resetHomeLayout: () => {
    set({ home: DEFAULT_SETTINGS.home })
    save(snapshot(get()))
  },
  setSidebarCollapsed: (sidebarCollapsed) => {
    set({ sidebarCollapsed })
    save(snapshot(get()))
  },
}))
