import { useLoanStore } from '../loans/loanStore'
import { useBillStore } from '../bills/billStore'
import { useSavingsStore } from '../savings/savingsStore'
import { useIncomeStore } from '../finance/incomeStore'
import { usePrivateFolderStore } from '../privateFolder/privateFolderStore'
import type { SummaryInput } from './summary'

/** Everything the summary needs, read fresh at the moment a question is sent. */
export function readSummaryInput(includePrivate: boolean): SummaryInput {
  const { loans, payments } = useLoanStore.getState()
  const { bills, billPayments } = useBillStore.getState()
  const { goals } = useSavingsStore.getState()
  return {
    loans,
    payments,
    bills,
    billPayments,
    goals,
    monthlyIncome: useIncomeStore.getState().monthlyIncome,
    includePrivate,
    folderName: includePrivate ? usePrivateFolderStore.getState().name : null,
  }
}
