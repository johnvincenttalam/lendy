import { z } from 'zod'
import { DEFAULT_COLOR } from '../loans/loanTypes'
import type { SavingsGoal, SavingsTransaction } from './savingsTypes'
import { dateString, optionalText } from '../../core/validation/fields'

const UNKNOWN_DATE = new Date(0).toISOString()

/** A savings goal as read from a backup; see loanSchema for the rules. */
export const savingsGoalSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  color: z.string().min(1).catch(DEFAULT_COLOR),
  targetAmount: z.number().nonnegative(),
  currentAmount: z.number().default(0),
  notes: optionalText,
  createdAt: dateString.optional(),
  archived: z.boolean().optional(),
}).transform((g) => ({ ...g, createdAt: g.createdAt ?? UNKNOWN_DATE }) as SavingsGoal)

export const savingsTransactionSchema = z.looseObject({
  id: z.string().min(1),
  goalId: z.string().min(1),
  type: z.enum(['deposit', 'withdrawal']),
  amount: z.number(),
  note: optionalText,
  createdAt: dateString,
}).transform((t) => t as SavingsTransaction)
