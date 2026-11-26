import { z } from 'zod'
import { DEFAULT_COLOR } from '../loans/loanTypes'
import type { Bill, BillPaymentRecord } from './billTypes'
import { dateString, optionalText } from '../../core/validation/fields'

const UNKNOWN_DATE = new Date(0).toISOString()

/** A bill as read from a backup; see loanSchema for the rules. */
export const billSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  color: z.string().min(1).catch(DEFAULT_COLOR),
  category: z.string().min(1).catch('Other'),
  amount: z.number().nonnegative(),
  nextDueDate: dateString,
  notes: optionalText,
  createdAt: dateString.optional(),
  archived: z.boolean().optional(),
}).transform((b) => ({ ...b, createdAt: b.createdAt ?? UNKNOWN_DATE }) as Bill)

export const billPaymentSchema = z.looseObject({
  id: z.string().min(1),
  billId: z.string().min(1),
  amount: z.number(),
  paidAt: dateString,
  dueDate: dateString,
}).transform((p) => p as BillPaymentRecord)
