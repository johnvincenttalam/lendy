import { Home, Zap, Wifi, Repeat, Shield, Car, Receipt } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * One icon per BILL_CATEGORIES entry. Keyed by the category string rather than
 * an index so reordering that list cannot silently reassign icons.
 */
export const BILL_CATEGORY_ICONS: Record<string, LucideIcon> = {
  Rent: Home,
  Utilities: Zap,
  'Internet/Phone': Wifi,
  Subscription: Repeat,
  Insurance: Shield,
  Transportation: Car,
  Other: Receipt,
}

/**
 * Bill.category is a bare string, not the BILL_CATEGORIES union — a restored
 * backup can carry a category this build has never heard of. Those fall back to
 * the generic receipt rather than rendering an empty tile.
 */
export const DEFAULT_BILL_ICON: LucideIcon = Receipt
