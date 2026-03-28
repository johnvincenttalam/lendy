import { create } from 'zustand'

type ThemeStore = {
  dark: boolean
  toggle: () => void
}

function loadTheme(): boolean {
  try {
    const stored = localStorage.getItem('loan-tracker-theme')
    if (stored !== null) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return true
  }
}

export const useTheme = create<ThemeStore>((set) => {
  const dark = loadTheme()
  applyTheme(dark)
  return {
    dark,
    toggle: () =>
      set((state) => {
        const next = !state.dark
        localStorage.setItem('loan-tracker-theme', next ? 'dark' : 'light')
        applyTheme(next)
        return { dark: next }
      }),
  }
})

function applyTheme(dark: boolean) {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', dark)
  }
}
