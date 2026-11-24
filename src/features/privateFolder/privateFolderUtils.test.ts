import { describe, it, expect } from 'vitest'
import type { Loan } from '../loans/loanTypes'
import { folderLabel, isPrivatePath, needsPin, verifyRecovery, DEFAULT_FOLDER_LABEL, MAX_FOLDER_NAME } from './privateFolderUtils'
import { hashPin } from '../lock/pinHash'

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

describe('needsPin', () => {
  it('asks only when a PIN is set and the folder is locked', () => {
    expect(needsPin('hash', false)).toBe(true)
    expect(needsPin('hash', true)).toBe(false)
    expect(needsPin(null, false)).toBe(false)
  })
})

describe('verifyRecovery', () => {
  it('accepts only the app PIN saved when the folder PIN was set', async () => {
    const saved = await hashPin('1234')
    expect(await verifyRecovery('1234', saved)).toBe(true)
    // Someone who sets a new app PIN later can't use it to reset the folder.
    expect(await verifyRecovery('1111', saved)).toBe(false)
  })

  it('never recovers when no app PIN was saved', async () => {
    expect(await verifyRecovery('1234', null)).toBe(false)
  })
})
