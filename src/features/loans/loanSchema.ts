import { z } from 'zod'
import { DEFAULT_COLOR } from './loanTypes'
import type { Loan, PaymentRecord } from './loanTypes'
import { dateString, optionalText } from '../../core/validation/fields'

/**
 * A loan as read from a backup. Fields older versions didn't save get their
 * defaults; anything that would break the maths or the dates fails the record.
 * Unknown fields are kept, so a file from a later version loses nothing.
 */
export const loanSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  color: z.string().min(1).catch(DEFAULT_COLOR),
  tag: optionalText,
  notes: optionalText,
  totalAmount: z.number().nonnegative(),
  monthlyPayment: z.number().nonnegative(),
  interestRate: z.number().nonnegative().default(0),
  durationMonths: z.number().int().nonnegative(),
  startDate: dateString,
  monthsPaid: z.number().int().nonnegative(),
  totalPaid: z.number(),
  totalInterestPaid: z.number().default(0),
  createdAt: dateString.optional(),
  archived: z.boolean().optional(),
  // Strict on purpose: a garbled flag must not turn a private loan public.
  private: z.boolean().optional(),
}).transform((l) => ({ ...l, createdAt: l.createdAt ?? l.startDate }) as Loan)

export const paymentSchema = z.looseObject({
  id: z.string().min(1),
  loanId: z.string().min(1),
  amount: z.number(),
  principal: z.number(),
  interest: z.number(),
  paidAt: dateString,
  dueDate: dateString,
  month: z.number().int().nonnegative(),
}).transform((p) => p as PaymentRecord)
