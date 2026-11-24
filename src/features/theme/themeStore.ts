import { create } from 'zustand'

/** Must match the inline script in index.html, which applies the theme before first paint. */
export const THEME_KEY = 'loan-tracker-theme'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

/** Browser chrome colour per theme — matches each mode's page background. */
const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#F6F6F4',
  dark: '#121212',
}

const systemQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null

function loadPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // storage unavailable — fall through
  }
  // Follow the device until the user picks a theme in Settings.
  return 'system'
}

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') return systemQuery?.matches ? 'dark' : 'light'
  return pref
}

function apply(theme: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

type ThemeStore = {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (pref: ThemePreference) => void
}

const initialPreference = loadPreference()
const initialResolved = resolve(initialPreference)
apply(initialResolved)

export const useThemeStore = create<ThemeStore>((set) => ({
  preference: initialPreference,
  resolved: initialResolved,
  setPreference: (preference) => {
    try {
      localStorage.setItem(THEME_KEY, preference)
    } catch {
      // still apply for this session
    }
    const resolved = resolve(preference)
    apply(resolved)
    set({ preference, resolved })
  },
}))

// Follow the OS setting live while "System" is selected.
systemQuery?.addEventListener('change', () => {
  const { preference } = useThemeStore.getState()
  if (preference !== 'system') return
  const resolved = resolve('system')
  apply(resolved)
  useThemeStore.setState({ resolved })
})
