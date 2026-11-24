import { formatCurrencyParts } from '../features/loans/loanUtils'

type Props = { value: number }

/**
 * Renders a formatted PHP amount with the ₱ symbol in its own span, so the
 * symbol can be styled separately from the digits if ever needed. The digits
 * inherit whatever font/size/color classes the caller applies.
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
