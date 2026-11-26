/**
 * The backup file, version 2: what made it, a section per module, and a
 * check value that catches a damaged or edited file. Reading unwraps it into
 * the flat shape v0/v1 files already have, so every version then goes
 * through the same upgrade-and-check path (`prepareRestore`).
 *
 * The check value detects damage; it isn't security (anyone can recompute it).
 */
import type { FolderBackup } from '../privateFolder/privateFolderUtils'
import type { DataSnapshot } from '../storage/snapshot'
import type { Snapshot } from './schema'

export const BACKUP_FORMAT = 'ollie-backup'
export const FORMAT_VERSION = 2

export type ChecksumStatus = 'ok' | 'mismatch' | 'missing' | 'none'

export type FileInfo = {
  /** 0: from before versioning; 1: flat with schemaVersion; 2: this format. */
  formatVersion: number
  appVersion: string | null
  exportedAt: string | null
  /** The file has parts only a newer Ollie knows; they were left out. */
  unknownSections: boolean
  /** Records the storage move set aside, carried in the file but not imported. */
  setAside: number
}

const KNOWN_SECTIONS = new Set(['loans', 'bills', 'savings', 'finance', 'privateFolder', 'setAside'])

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function buildBackup(input: {
  snapshot: DataSnapshot
  schemaVersion: number
  appVersion: string
  exportedAt: string
  privateFolder?: FolderBackup
  setAside?: unknown[]
}): Promise<string> {
  const s = input.snapshot
  const data: Record<string, unknown> = {
    loans: { loans: s.loans, payments: s.payments },
    bills: { bills: s.bills, billPayments: s.billPayments },
    savings: { savingsGoals: s.savingsGoals, savingsTransactions: s.savingsTransactions },
    finance: { monthlyIncome: s.monthlyIncome },
  }
  if (input.privateFolder) data.privateFolder = input.privateFolder
  if (input.setAside && input.setAside.length > 0) data.setAside = input.setAside
  return JSON.stringify({
    format: BACKUP_FORMAT,
    formatVersion: FORMAT_VERSION,
    schemaVersion: input.schemaVersion,
    appVersion: input.appVersion,
    exportedAt: input.exportedAt,
    checksum: { algorithm: 'SHA-256', value: await sha256Hex(JSON.stringify(data)) },
    data,
  }, null, 2)
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const section = (data: Record<string, unknown>, key: string): Record<string, unknown> => (isObject(data[key]) ? data[key] : {})
const textOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null)

export function unwrapBackup(raw: unknown): { ok: true; flat: Snapshot; info: FileInfo } | { ok: false; reason: 'invalid' | 'newer' } {
  if (!isObject(raw)) return { ok: false, reason: 'invalid' }

  if (raw.format !== BACKUP_FORMAT) {
    if (!Array.isArray(raw.loans)) return { ok: false, reason: 'invalid' }
    const info: FileInfo = {
      formatVersion: typeof raw.schemaVersion === 'number' ? 1 : 0,
      appVersion: null,
      exportedAt: textOrNull(raw.exportedAt),
      unknownSections: false,
      setAside: 0,
    }
    return { ok: true, flat: raw, info }
  }

  const version = raw.formatVersion
  if (typeof version === 'number' && version > FORMAT_VERSION) return { ok: false, reason: 'newer' }
  if (!isObject(raw.data)) return { ok: false, reason: 'invalid' }
  const data = raw.data
  const loans = section(data, 'loans')
  if (!Array.isArray(loans.loans)) return { ok: false, reason: 'invalid' }
  const bills = section(data, 'bills')
  const savings = section(data, 'savings')
  const finance = section(data, 'finance')

  const flat: Snapshot = {
    schemaVersion: raw.schemaVersion,
    loans: loans.loans,
    payments: loans.payments,
    bills: bills.bills,
    billPayments: bills.billPayments,
    savingsGoals: savings.savingsGoals,
    savingsTransactions: savings.savingsTransactions,
    monthlyIncome: finance.monthlyIncome,
    privateFolder: data.privateFolder,
  }
  const info: FileInfo = {
    formatVersion: FORMAT_VERSION,
    appVersion: textOrNull(raw.appVersion),
    exportedAt: textOrNull(raw.exportedAt),
    unknownSections: Object.keys(data).some((k) => !KNOWN_SECTIONS.has(k)),
    setAside: Array.isArray(data.setAside) ? data.setAside.length : 0,
  }
  return { ok: true, flat, info }
}

/** Whether a v2 file's check value matches its data; 'none' for older files, which have none. */
export async function checkChecksum(raw: unknown): Promise<ChecksumStatus> {
  if (!isObject(raw) || raw.format !== BACKUP_FORMAT) return 'none'
  const value = isObject(raw.checksum) ? raw.checksum.value : undefined
  if (typeof value !== 'string' || !value) return 'missing'
  return (await sha256Hex(JSON.stringify(raw.data))) === value ? 'ok' : 'mismatch'
}
