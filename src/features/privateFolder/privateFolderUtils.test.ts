import { describe, it, expect } from 'vitest'
import type { Loan } from '../loans/loanTypes'
import { folderLabel, isPrivatePath, DEFAULT_FOLDER_LABEL, MAX_FOLDER_NAME } from './privateFolderUtils'

const loan = (id: string, isPrivate: boolean) => ({ id, private: isPrivate }) as Loan

describe('folderLabel', () => {
  it('falls back to the default when there is no name', () => {
    expect(folderLabel(null)).toBe(DEFAULT_FOLDER_LABEL)
    expect(folderLabel('   ')).toBe('Private folder')
  })

  it('trims the name and caps its length', () => {
    expect(folderLabel('  Receipts ')).toBe('Receipts')
    expect(folderLabel('x'.repeat(30))).toHaveLength(MAX_FOLDER_NAME)
    expect(MAX_FOLDER_NAME).toBe(24)
  })
})

describe('isPrivatePath', () => {
  it('covers the folder and its loans only', () => {
    expect(isPrivatePath('/private', [])).toBe(true)
    expect(isPrivatePath('/loan/p1', [loan('p1', true)])).toBe(true)
    expect(isPrivatePath('/loan/n1', [loan('n1', false)])).toBe(false)
    expect(isPrivatePath('/loan/missing', [])).toBe(false)
    expect(isPrivatePath('/', [loan('p1', true)])).toBe(false)
  })
})
