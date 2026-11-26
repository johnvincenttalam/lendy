import { z } from 'zod'

/** A string `new Date()` can read (YYYY-MM-DD or a full ISO timestamp). */
export const dateString = z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), 'not a date')

/** Free text that is only cosmetic: anything unreadable becomes "not set" instead of failing the record. */
export const optionalText = z.string().optional().catch(undefined)
