export type MetricKey = 'debtLoad' | 'cashFlow' | 'savingsBuffer' | 'paymentReliability'

export type MetricScore = {
  key: MetricKey
  label: string
  /** 0-100, already rounded */
  score: number
  /** Contribution to the aggregate when included */
  weight: number
  /** Human-readable input, e.g. "23.3% of income" */
  detail: string
  included: boolean
  /** Shown in the breakdown when included is false */
  omissionReason?: string
}

export type FinancialOverview = {
  monthlyIncome: number
  /** Sum of scheduled monthly payments across active, unpaid loans */
  loanCommitments: number
  /** Sum of amounts across active bills */
  billCommitments: number
  totalCommitments: number
  /** monthlyIncome - totalCommitments; may be negative */
  uncommitted: number
  /** uncommitted / monthlyIncome; 0 when income is 0 */
  uncommittedRatio: number
  /** Sum of remaining balances across active, unpaid loans */
  totalDebt: number
  /** Sum of currentAmount across active savings goals */
  totalSavings: number
  /**
   * totalSavings / totalCommitments, falling back to monthlyIncome as the
   * denominator when there are no commitments; 0 when both are 0.
   */
  runwayMonths: number
}

export type ScoreBandName = 'at-risk' | 'needs-attention' | 'stable' | 'healthy'

/**
 * Why a score is suppressed, so the card can render the matching prompt
 * instead of inferring the reason from the overview:
 * - 'no-income': monthlyIncome is 0 — Debt Load and Cash Flow can't be scored.
 * - 'no-data': income is set but there is nothing to score against — no
 *   commitments and no savings, which is a fresh install's default state.
 */
export type SuppressedReason = 'no-income' | 'no-data'

export type HealthScore = {
  /** 0-100, already rounded */
  score: number
  band: ScoreBandName
  /** Display label, e.g. "Needs Attention" */
  label: string
  /** All four metrics, included or not, in display order */
  metrics: MetricScore[]
  /** True when there is nothing meaningful to score — render the prompt, not a number */
  suppressed: boolean
  /** Present when suppressed is true; null otherwise */
  suppressedReason: SuppressedReason | null
}
