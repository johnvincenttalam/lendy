import { CURRENCY, LOCALE } from '../locale'

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

/**
 * Split a formatted currency value into its symbol and numeric portion.
 * Lets callers render the ₱ symbol with a font that actually has the glyph
 * (the tabular font used for financial values doesn't) without touching
 * the numeric formatting itself.
 */
export function formatCurrencyParts(amount: number): { symbol: string; amount: string } {
  let symbol = ''
  let rest = ''
  for (const part of currencyFormatter.formatToParts(amount)) {
    if (part.type === 'currency') symbol += part.value
    else rest += part.value
  }
  return { symbol, amount: rest }
}
