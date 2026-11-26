/**
 * Works out what restoring a backup would do, without changing anything.
 *
 * Merge adds what's missing and keeps this phone's version of anything
 * that's in both, unless the owner asks for the file's version of records
 * that differ. A record's children (a loan's payments, a bill's payments, a
 * goal's deposits) always come from the same place as the record, so a loan
 * never disagrees with its own payments. Likely double entries (same name and
 * amounts, different id) are held back unless the owner adds them anyway.
 *
 * Pure: the preview recomputes it whenever a choice changes.
 */
import type { RestoreData } from './restore'
import type { DataSnapshot } from '../storage/snapshot'
import type { FolderBackup } from '../privateFolder/privateFolderUtils'

export type Area = 'loans' | 'bills' | 'savings'
export type AreaCounts = { added: number; alreadyHere: number; different: number; heldBack: number; private: number }
export type DifferentItem = { area: Area; id: string; name: string | null; fileOnlyDates: string[]; deviceOnlyCount: number; detailsDiffer: boolean }
export type HeldBack = { area: Area; id: string; name: string | null }
export type MergeOptions = { useFileForDifferent: boolean; addPossibleDuplicates: boolean; rebuiltPayments: boolean }
export type MergePlan = {
  next: RestoreData
  counts: Record<Area, AreaCounts>
  different: DifferentItem[]
  heldBack: HeldBack[]
  income: { device: number; file: number | null; result: number }
  folderWarning: boolean
  changes: boolean
}

type Rec = Record<string, unknown> & { id: string }

type AreaDef = {
  area: Area
  parents: 'loans' | 'bills' | 'savingsGoals'
  children: 'payments' | 'billPayments' | 'savingsTransactions'
  parentKey: string
  childDate: string
  matchKey: (r: Rec) => string
}

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()

const AREAS: AreaDef[] = [
  { area: 'loans', parents: 'loans', children: 'payments', parentKey: 'loanId', childDate: 'dueDate', matchKey: (r) => `${norm(r.name)}|${String(r.totalAmount)}|${String(r.startDate)}` },
  { area: 'bills', parents: 'bills', children: 'billPayments', parentKey: 'billId', childDate: 'dueDate', matchKey: (r) => `${norm(r.name)}|${String(r.amount)}|${String(r.category)}` },
  { area: 'savings', parents: 'savingsGoals', children: 'savingsTransactions', parentKey: 'goalId', childDate: 'createdAt', matchKey: (r) => `${norm(r.name)}|${String(r.targetAmount)}` },
]

/** JSON with sorted keys, so equal records compare equal whatever their key order. */
function canon(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return `{${Object.keys(obj).sort().filter((k) => obj[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canon(obj[k])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

const isPrivate = (r: Rec) => r.private === true
const shownName = (r: Rec) => (isPrivate(r) ? null : typeof r.name === 'string' ? r.name : null)

function groupChildren(children: Rec[], parentKey: string): Map<string, Rec[]> {
  const out = new Map<string, Rec[]>()
  for (const c of children) {
    const pid = c[parentKey] as string
    const list = out.get(pid)
    if (list) list.push(c)
    else out.set(pid, [c])
  }
  return out
}

export function planMerge(
  device: { snapshot: DataSnapshot; folder: FolderBackup | null },
  file: RestoreData,
  opts: MergeOptions,
): MergePlan {
  const snap = device.snapshot as unknown as Record<string, Rec[]> & { monthlyIncome: number }
  const incoming = file as unknown as Record<string, Rec[]>
  const next: Record<string, Rec[]> = {}
  const counts = {} as Record<Area, AreaCounts>
  const different: DifferentItem[] = []
  const heldBack: HeldBack[] = []
  let changed = false
  let privateArrives = false

  for (const def of AREAS) {
    const c: AreaCounts = { added: 0, alreadyHere: 0, different: 0, heldBack: 0, private: 0 }
    counts[def.area] = c
    const deviceParents = snap[def.parents] ?? []
    const fileParents = incoming[def.parents] ?? []
    const deviceKids = groupChildren(snap[def.children] ?? [], def.parentKey)
    const fileKids = groupChildren(incoming[def.children] ?? [], def.parentKey)
    const deviceById = new Map(deviceParents.map((p) => [p.id, p]))
    // Only this phone's records the file doesn't already account for can be
    // doubles of a new one: the file itself shows its own look-alikes are separate.
    const fileIds = new Set(fileParents.map((p) => p.id))
    const deviceKeys = new Map(deviceParents.filter((p) => !fileIds.has(p.id)).map((p) => [def.matchKey(p), p]))
    // Rebuilt payment history gets fresh ids on every read, so those compare by content that matters.
    const childKey = def.area === 'loans' && opts.rebuiltPayments
      ? (k: Rec) => `${String(k.loanId)}|${String(k.month)}|${String(k.amount)}`
      : (k: Rec) => canon(k)

    const replaced = new Map<string, Rec>()
    const added: Rec[] = []

    for (const fp of fileParents) {
      const dp = deviceById.get(fp.id)
      if (!dp) {
        const match = deviceKeys.get(def.matchKey(fp))
        if (match !== undefined && !opts.addPossibleDuplicates) {
          // Named only when neither side is private: the line would reveal the hidden one.
          const hidden = isPrivate(fp) || isPrivate(match)
          c.heldBack++
          if (hidden) c.private++
          heldBack.push({ area: def.area, id: fp.id, name: hidden ? null : shownName(fp) })
          continue
        }
        c.added++
        if (isPrivate(fp)) { c.private++; privateArrives = true }
        added.push(fp)
        continue
      }
      const dKids = (deviceKids.get(fp.id) ?? []).map(childKey)
      const fKidsRecs = fileKids.get(fp.id) ?? []
      const fKids = fKidsRecs.map(childKey)
      const detailsDiffer = canon(dp) !== canon(fp)
      const dSet = new Set(dKids)
      const fSet = new Set(fKids)
      const fileOnly = fKidsRecs.filter((_, i) => !dSet.has(fKids[i]))
      const deviceOnlyCount = dKids.filter((k) => !fSet.has(k)).length
      if (!detailsDiffer && fileOnly.length === 0 && deviceOnlyCount === 0) {
        c.alreadyHere++
        continue
      }
      c.different++
      if (isPrivate(fp) || isPrivate(dp)) c.private++
      different.push({
        area: def.area,
        id: fp.id,
        name: isPrivate(dp) || isPrivate(fp) ? null : shownName(dp),
        fileOnlyDates: fileOnly.map((k) => String(k[def.childDate])),
        deviceOnlyCount,
        detailsDiffer,
      })
      if (opts.useFileForDifferent) {
        // The file's version comes in, but this phone decides what's in the private folder.
        const taken: Rec = { ...fp }
        if (dp.private === undefined) delete taken.private
        else taken.private = dp.private
        replaced.set(fp.id, taken)
      }
    }

    if (added.length > 0 || replaced.size > 0) changed = true
    next[def.parents] = [...deviceParents.map((p) => replaced.get(p.id) ?? p), ...added]
    const fromFile = new Set([...replaced.keys(), ...added.map((p) => p.id)])
    next[def.children] = [
      ...(snap[def.children] ?? []).filter((k) => !replaced.has(k[def.parentKey] as string)),
      ...(incoming[def.children] ?? []).filter((k) => fromFile.has(k[def.parentKey] as string)),
    ]
  }

  const deviceIncome = snap.monthlyIncome
  const takeIncome = file.monthlyIncome !== null && file.monthlyIncome !== deviceIncome
    && (opts.useFileForDifferent || deviceIncome === 0)
  if (takeIncome) changed = true

  // The file's folder (and PIN) comes only with private loans that need it.
  const takeFolder = device.folder === null && file.privateFolder !== null && privateArrives
  if (takeFolder) changed = true
  const folderWarning = device.folder !== null && !device.folder.pinHash && !!file.privateFolder?.pinHash && privateArrives

  return {
    next: {
      ...(next as unknown as Omit<RestoreData, 'monthlyIncome' | 'privateFolder'>),
      monthlyIncome: takeIncome ? file.monthlyIncome : null,
      privateFolder: takeFolder ? file.privateFolder : null,
    },
    counts,
    different,
    heldBack,
    income: { device: deviceIncome, file: file.monthlyIncome, result: takeIncome ? (file.monthlyIncome as number) : deviceIncome },
    folderWarning,
    changes: changed,
  }
}

/** What replace would remove: this phone's records that aren't in the file. */
export function planReplace(device: DataSnapshot, file: RestoreData): { removes: Record<Area, number> } {
  const snap = device as unknown as Record<string, Rec[]>
  const incoming = file as unknown as Record<string, Rec[]>
  const removes = {} as Record<Area, number>
  for (const def of AREAS) {
    const fileIds = new Set((incoming[def.parents] ?? []).map((p) => p.id))
    removes[def.area] = (snap[def.parents] ?? []).filter((p) => !fileIds.has(p.id)).length
  }
  return { removes }
}
