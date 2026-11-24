import { useLoanStore } from '../loans/loanStore'
import { useBillStore } from '../bills/billStore'
import { useSavingsStore } from '../savings/savingsStore'
import { useMoneyStore } from '../money/moneyStore'
import { useIncomeStore } from '../finance/incomeStore'
import { usePrivateFolderStore } from '../privateFolder/privateFolderStore'
import type { SummaryInput } from './summary'

/** Everything the summary needs, read fresh at the moment a question is sent. */
export function readSummaryInput(includePrivate: boolean): SummaryInput {
  const { loans, payments } = useLoanStore.getState()
  const { bills, billPayments } = useBillStore.getState()
  const { goals } = useSavingsStore.getState()
  const { entries, customCategories } = useMoneyStore.getState()
  return {
    loans,
    payments,
    bills,
    billPayments,
    goals,
    moneyEntries: entries,
    moneyCategories: customCategories,
    monthlyIncome: useIncomeStore.getState().monthlyIncome,
    includePrivate,
    folderName: includePrivate ? usePrivateFolderStore.getState().name : null,
  }
}
