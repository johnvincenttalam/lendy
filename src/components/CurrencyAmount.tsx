import { formatCurrencyParts } from '../features/loans/loanUtils'

type Props = { value: number }

/**
 * Renders a formatted PHP amount with the ₱ symbol split into its own span
 * so it can fall back to a font that has the glyph, while the digits keep
 * inheriting whatever font/size/color classes the caller already applies.
 */
export default function CurrencyAmount({ value }: Props) {
  const { symbol, amount } = formatCurrencyParts(value)
  return (
    <>
      <span className="currency-symbol">{symbol}</span>
      {amount}
    </>
  )
}
