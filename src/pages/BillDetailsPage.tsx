import { useParams, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useBillStore } from '../features/bills/billStore'
import BillDetails from '../features/bills/BillDetails'
import EmptyState from '../components/EmptyState'

export default function BillDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { bills, markBillPaid, deleteBill } = useBillStore()
  const bill = bills.find((b) => b.id === id)

  if (!bill) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center transition-colors duration-300">
        <EmptyState icon={Search} title="Bill not found" subtitle="This bill may have been deleted, or the link is invalid">
          <button
            onClick={() => navigate('/bills')}
            className="bg-brand text-on-brand text-[13px] font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity active:scale-95"
          >
            Back to bills
          </button>
        </EmptyState>
      </div>
    )
  }

  return (
    <BillDetails
      bill={bill}
      onMarkPaid={() => markBillPaid(bill.id)}
      onDelete={() => {
        deleteBill(bill.id)
        navigate('/bills')
      }}
      onBack={() => navigate(-1)}
    />
  )
}
