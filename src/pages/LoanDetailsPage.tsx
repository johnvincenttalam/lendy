import { useParams, useNavigate } from 'react-router-dom'
import { useLoanStore } from '../features/loans/loanStore'
import LoanDetails from '../features/loans/LoanDetails'

export default function LoanDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { loans, markAsPaid, deleteLoan } = useLoanStore()
  const loan = loans.find((l) => l.id === id)

  if (!loan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-2">Loan not found</p>
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 font-medium"
          >
            Go back
          </button>
        </div>
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
