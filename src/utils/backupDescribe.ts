// Kept free of store imports so it can be unit tested. The restore preview's wording lives in features/backup/previewText.ts.

export type ExistingCounts = { loans: number; bills: number; goals: number }

export function hasExistingData(existing: ExistingCounts): boolean {
  return existing.loans > 0 || existing.bills > 0 || existing.goals > 0
}
