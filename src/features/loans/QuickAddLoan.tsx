import LoanForm from './LoanForm'
import { useLoanStore } from './loanStore'

/** The [+] menu's Loan form. Loans added inside the private folder stay private. */
export default function QuickAddLoan({ onClose, privateLoan = false }: { onClose: () => void; privateLoan?: boolean }) {
  const addLoan = useLoanStore((s) => s.addLoan)
  return (
    <LoanForm
      onSubmit={(data) => {
        addLoan(privateLoan ? { ...data, private: true } : data)
        onClose()
      }}
      onClose={onClose}
    />
  )
}
