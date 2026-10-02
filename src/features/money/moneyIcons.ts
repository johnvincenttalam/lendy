import {
  Utensils, Car, ShoppingBag, HeartPulse, Film, GraduationCap, Wallet, Briefcase, Gift,
  CircleEllipsis, House, Coffee, Smartphone, Plane, Dumbbell, PawPrint, Shirt, Fuel, TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Keyed by string, not by index, and stored on the category by key: a restored
 * backup can name an icon this build lacks, so lookups fall back (see below).
 */
export const MONEY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  car: Car,
  'shopping-bag': ShoppingBag,
  'heart-pulse': HeartPulse,
  film: Film,
  'graduation-cap': GraduationCap,
  wallet: Wallet,
  briefcase: Briefcase,
  gift: Gift,
  other: CircleEllipsis,
  house: House,
  coffee: Coffee,
  smartphone: Smartphone,
  plane: Plane,
  dumbbell: Dumbbell,
  paw: PawPrint,
  shirt: Shirt,
  fuel: Fuel,
  'trending-up': TrendingUp,
}

/** What a user can pick for a custom category. */
export const ICON_KEYS = ['house', 'coffee', 'smartphone', 'plane', 'dumbbell', 'paw', 'shirt', 'fuel', 'trending-up', 'gift', 'wallet', 'other']

export function getCategoryIcon(key: string): LucideIcon {
  return MONEY_ICONS[key] ?? CircleEllipsis
}
