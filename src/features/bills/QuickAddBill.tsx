import BillForm from './BillForm'
import { useBillStore } from './billStore'

export default function QuickAddBill({ onClose }: { onClose: () => void }) {
  const addBill = useBillStore((s) => s.addBill)
  return (
    <BillForm
      onSubmit={(data) => {
        addBill(data)
        onClose()
      }}
      onClose={onClose}
    />
  )
}
