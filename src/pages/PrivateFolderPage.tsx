import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, FolderLock } from 'lucide-react'
import { useLoanStore } from '../features/loans/loanStore'
import LoanCard from '../features/loans/LoanCard'
import PageHeader, { HeaderIconButton } from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import PrivateFolderSetup from '../features/privateFolder/PrivateFolderSetup'
import PrivateFolderGate from '../features/privateFolder/PrivateFolderGate'
import { usePrivateFolderStore, selectIsSetUp } from '../features/privateFolder/privateFolderStore'
import { folderLabel, needsPin } from '../features/privateFolder/privateFolderUtils'

export default function PrivateFolderPage() {
  const navigate = useNavigate()
  const loans = useLoanStore((s) => s.loans)
  const { name, pinHash, unlocked, lock } = usePrivateFolderStore()
  const isSetUp = usePrivateFolderStore(selectIsSetUp)
  const privateLoans = useMemo(() => loans.filter((l) => l.private), [loans])
  const label = folderLabel(name)
  const leave = () => navigate('/more')

  if (!isSetUp) return <PrivateFolderSetup onDone={() => {}} onCancel={leave} />
  if (needsPin(pinHash, unlocked)) return <PrivateFolderGate onCancel={leave} />

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <PageHeader
        title={label}
        subtitle="Hidden from the rest of Ollie"
        back
        action={pinHash !== null && (
          <HeaderIconButton
            label={`Lock ${label}`}
            onClick={() => {
              lock()
              leave()
            }}
          >
            <Lock className="w-[18px] h-[18px] text-primary" />
          </HeaderIconButton>
        )}
      />

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28">
        {privateLoans.length === 0 ? (
          <EmptyState
            icon={FolderLock}
            mood="relaxed"
            title="Nothing in here yet"
            subtitle={`Open a loan and choose Move to ${label} from its menu.`}
          />
        ) : (
          <div className="space-y-3">
            {privateLoans.map((loan) => <LoanCard key={loan.id} loan={loan} />)}
          </div>
        )}
      </div>
    </div>
  )
}
