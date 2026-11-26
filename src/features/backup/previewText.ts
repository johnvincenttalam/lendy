/**
 * Wording for the restore preview and the toast after a merge. Pure, so
 * every sentence is unit tested. Private loans are never named here: the
 * preview sits in Settings, outside the PIN-locked folder.
 */
import { LOCALE } from '../../core/locale'
import { formatCurrency } from '../../core/money/format'
import { parseLocalISODate } from '../../core/time/localDate'
import type { ChecksumStatus, FileInfo } from './envelope'
import type { Area, AreaCounts, DifferentItem, HeldBack, MergePlan } from './planMerge'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const PARENT: Record<Area, string> = { loans: 'loan', bills: 'bill', savings: 'goal' }
const CHILD: Record<Area, string> = { loans: 'payment', bills: 'payment', savings: 'deposit' }
const AREA_NOUN: Record<Area, [string, string]> = { loans: ['loan', 'loans'], bills: ['bill', 'bills'], savings: ['savings goal', 'savings goals'] }
const AREAS: Area[] = ['loans', 'bills', 'savings']

function shortDate(iso: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? parseLocalISODate(iso) : new Date(iso)
  return date.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' })
}

function label(area: Area, name: string | null): string {
  return name === null ? `a private ${PARENT[area]}` : `"${name}" ${PARENT[area]}`
}

export function fileLine(info: FileInfo): string {
  if (!info.appVersion) return 'Made by an earlier Ollie'
  const when = info.exportedAt
    ? ` on ${new Date(info.exportedAt).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : ''
  return `Made by Ollie ${info.appVersion}${when}`
}

export function checksumWarning(status: ChecksumStatus): string | null {
  return status === 'mismatch' || status === 'missing'
    ? 'This file was changed or damaged since Ollie made it. Look it over before going on.'
    : null
}

/** What keeping this phone's version leaves out, or (with the switch on) what this phone loses. */
export function differentLine(item: DifferentItem, useFile: boolean): string {
  const parts: string[] = []
  const child = CHILD[item.area]
  const n = item.fileOnlyDates.length
  const shown = item.fileOnlyDates.slice(0, 3).map(shortDate)
  if (n > 3) shown.push('…')
  if (!useFile && n > 0) parts.push(`the file has ${plural(n, child)} this phone doesn't (${shown.join(', ')})`)
  if (useFile && item.deviceOnlyCount > 0) parts.push(`this phone has ${plural(item.deviceOnlyCount, child)} the file doesn't`)
  if (useFile && n > 0) parts.push(`${plural(n, child)} from the file ${n === 1 ? 'comes' : 'come'} in (${shown.join(', ')})`)
  if (item.detailsDiffer) parts.push('other details differ')
  return `${label(item.area, item.name)}: ${parts.join('; ')}`
}

export function heldBackLine(item: HeldBack): string {
  const why = item.area === 'loans' ? 'same name, amount and start date' : item.area === 'bills' ? 'same name, amount and category' : 'same name and target'
  return `${label(item.area, item.name)}: ${why} as one you have`
}

export function removesLine(removes: Record<Area, number>): string | null {
  const parts = AREAS.filter((a) => removes[a] > 0).map((a) => plural(removes[a], ...AREA_NOUN[a]))
  return parts.length > 0 ? `removes ${parts.join(', ')}` : null
}

export function incomeLine(income: MergePlan['income']): string | null {
  if (income.file === null || income.file === income.device) return null
  return income.result === income.device
    ? `Monthly income: keeping ${formatCurrency(income.device)} (the file has ${formatCurrency(income.file)})`
    : `Monthly income: using the file's ${formatCurrency(income.file)}`
}

export function mergeToast(counts: Record<Area, AreaCounts>): string {
  const parts = AREAS.filter((a) => counts[a].added > 0).map((a) => plural(counts[a].added, ...AREA_NOUN[a]))
  return parts.length > 0 ? `Merged: ${parts.join(', ')} added` : 'Merged: nothing new to add'
}

export function skippedLine(n: number): string {
  return `${plural(n, 'record')} in the file couldn't be read and will be left out.`
}

export function setAsideLine(n: number): string {
  return n === 1
    ? '1 record Ollie set aside is in this file; it isn\'t imported.'
    : `${n} records Ollie set aside are in this file; they aren't imported.`
}
