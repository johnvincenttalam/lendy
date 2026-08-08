import { useParams, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useLoanStore } from '../features/loans/loanStore'
import LoanDetails from '../features/loans/LoanDetails'
import EmptyState from '../components/EmptyState'

export default function LoanDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { loans, markAsPaid, deleteLoan } = useLoanStore()
  const loan = loans.find((l) => l.id === id)

  if (!loan) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center transition-colors duration-300">
        <EmptyState
          icon={Search}
          title="Loan not found"
          subtitle="This loan may have been deleted, or the link is invalid"
        >
          <button
            onClick={() => navigate('/')}
            className="bg-brand text-on-brand text-[13px] font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity active:scale-95"
          >
            Back to loans
          </button>
        </EmptyState>
      </div>
    )
  }

  return (
    <LoanDetails
      loan={loan}
      onMarkPaid={() => markAsPaid(loan.id)}
      onDelete={() => {
        deleteLoan(loan.id)
        navigate('/')
      }}
      onBack={() => navigate(-1)}
    />
  )
}
