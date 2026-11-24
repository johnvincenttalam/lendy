import type { Loan } from '../loans/loanTypes'
import { hashPin } from '../lock/pinHash'

export const DEFAULT_FOLDER_LABEL = 'Private folder'
export const MAX_FOLDER_NAME = 24

/** The name shown for the folder: the owner's choice, or the default. */
export function folderLabel(name: string | null): string {
  const trimmed = (name ?? '').trim().slice(0, MAX_FOLDER_NAME).trim()
  return trimmed || DEFAULT_FOLDER_LABEL
}

/**
 * Routes that belong to the unlocked folder: the folder itself and the
 * details page of a private loan. Leaving them relocks the folder.
 */
export function isPrivatePath(pathname: string, loans: Loan[]): boolean {
  if (pathname === '/private') return true
  const match = /^\/loan\/([^/]+)$/.exec(pathname)
  if (!match) return false
  return loans.some((l) => l.id === match[1] && l.private === true)
}

/** Whether opening the folder (or one of its loans) must ask for the PIN. */
export function needsPin(pinHash: string | null, unlocked: boolean): boolean {
  return pinHash !== null && !unlocked
}

/**
 * "Forgot PIN" check. `recoveryHash` is the app PIN's hash saved at the
 * moment the folder PIN was set — never the current app PIN — so someone
 * who turns the app lock on (or changes it) later can't use it to reset
 * the folder.
 */
export async function verifyRecovery(appPin: string, recoveryHash: string | null): Promise<boolean> {
  if (!recoveryHash) return false
  return (await hashPin(appPin)) === recoveryHash
}
