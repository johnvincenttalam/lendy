export type MoneyEntryType = 'income' | 'expense'

export type MoneyCategory = {
  id: string
  /** A category belongs to exactly one type. */
  type: MoneyEntryType
  name: string
  /** Key into MONEY_ICONS (moneyIcons.ts). */
  icon: string
  builtIn: boolean
}

export type MoneyEntry = {
  id: string
  type: MoneyEntryType
  /** Always > 0; the sign is implied by `type`. */
  amount: number
  categoryId: string
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  note?: string
  createdAt: string
}

export type MoneyEntryFormData = Omit<MoneyEntry, 'id' | 'createdAt'>
