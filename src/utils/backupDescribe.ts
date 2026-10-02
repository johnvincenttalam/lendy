// Wording for the restore confirmation. Kept free of store imports so it can be unit tested.

type IncomingCounts = { loans: number; bills: number; savingsGoals: number; moneyEntries: number }
export type ExistingCounts = { loans: number; bills: number; goals: number; moneyEntries: number }

export function hasExistingData(existing: ExistingCounts): boolean {
  return existing.loans > 0 || existing.bills > 0 || existing.goals > 0 || existing.moneyEntries > 0
}

function describeCount(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`
}

export function describeBackupImport(incoming: IncomingCounts, existing: ExistingCounts): string {
  const parts: string[] = []
  if (incoming.loans > 0) parts.push(describeCount(incoming.loans, 'loan'))
  if (incoming.bills > 0) parts.push(describeCount(incoming.bills, 'bill'))
  if (incoming.savingsGoals > 0) parts.push(describeCount(incoming.savingsGoals, 'savings goal'))
  if (incoming.moneyEntries > 0) parts.push(describeCount(incoming.moneyEntries, 'money entry', 'money entries'))
  const incomingText = parts.length > 0 ? parts.join(', ') : 'no data'

  return hasExistingData(existing)
    ? `This will replace your existing data with ${incomingText} from the backup. This cannot be undone.`
    : `Import ${incomingText} from the backup?`
}
