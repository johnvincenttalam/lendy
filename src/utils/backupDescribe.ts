// Wording for the restore confirmation. Kept free of store imports so it can be unit tested.

type IncomingCounts = { loans: number; bills: number; savingsGoals: number }
export type ExistingCounts = { loans: number; bills: number; goals: number }

export function hasExistingData(existing: ExistingCounts): boolean {
  return existing.loans > 0 || existing.bills > 0 || existing.goals > 0
}

function describeCount(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`
}

export function describeBackupImport(incoming: IncomingCounts, existing: ExistingCounts, skipped = 0): string {
  const parts: string[] = []
  if (incoming.loans > 0) parts.push(describeCount(incoming.loans, 'loan'))
  if (incoming.bills > 0) parts.push(describeCount(incoming.bills, 'bill'))
  if (incoming.savingsGoals > 0) parts.push(describeCount(incoming.savingsGoals, 'savings goal'))
  const incomingText = parts.length > 0 ? parts.join(', ') : 'no data'

  const main = hasExistingData(existing)
    ? `This replaces everything on this device with ${incomingText} from the backup. You can undo it from Settings afterwards.`
    : `Import ${incomingText} from the backup?`
  return skipped > 0
    ? `${main} ${describeCount(skipped, 'record')} in the file couldn’t be read and will be left out.`
    : main
}
