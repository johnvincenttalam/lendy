/**
 * Layout preferences saved on this device. Read field by field so one damaged
 * value falls back to its default without throwing away the rest. Hand-written
 * rather than zod: this loads with Home, and zod would add 25 kB (gzip) to
 * the main bundle.
 */
export type HomeLayout = { order: string[]; hidden: string[] }
export type Settings = { home: HomeLayout; sidebarCollapsed: boolean }

export const SETTINGS_KEY = 'loan-tracker-settings'

export const DEFAULT_SETTINGS: Settings = { home: { order: [], hidden: [] }, sidebarCollapsed: false }

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

const stringList = (v: unknown): string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? [...v] : []

export function parseSettings(raw: string | null): Settings {
  let data: unknown
  try {
    data = raw === null ? null : JSON.parse(raw)
  } catch {
    data = null
  }
  if (!isRecord(data)) return { home: { order: [], hidden: [] }, sidebarCollapsed: false }
  const home = isRecord(data.home) ? data.home : {}
  return {
    home: { order: stringList(home.order), hidden: stringList(home.hidden) },
    sidebarCollapsed: data.sidebarCollapsed === true,
  }
}
