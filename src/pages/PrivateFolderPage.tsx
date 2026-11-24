import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, FolderLock, ChevronRight } from 'lucide-react'
import { useLoanStore } from '../features/loans/loanStore'
import LoanCard from '../features/loans/LoanCard'
import PageHeader, { HeaderIconButton } from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import PrivateFolderSetup from '../features/privateFolder/PrivateFolderSetup'
import PrivateFolderGate from '../features/privateFolder/PrivateFolderGate'
import { usePrivateFolderStore, selectIsSetUp } from '../features/privateFolder/privateFolderStore'
import { folderLabel, needsPin } from '../features/privateFolder/privateFolderUtils'
import AskOllieSheet from '../features/askOllie/AskOllieSheet'
import OllieCharacter from '../features/ollie/OllieCharacter'

export default function PrivateFolderPage() {
  const navigate = useNavigate()
  const loans = useLoanStore((s) => s.loans)
  const { name, pinHash, unlocked, lock } = usePrivateFolderStore()
  const isSetUp = usePrivateFolderStore(selectIsSetUp)
  const privateLoans = useMemo(() => loans.filter((l) => l.private), [loans])
  const label = folderLabel(name)
  const leave = () => navigate('/more')
  const locked = needsPin(pinHash, unlocked)

  // The chat only lives while the folder is open: when it locks (leaving,
  // backgrounding the app) the gate replaces the page, the sheet unmounts and
  // its conversation is gone. Reset the flag too so it doesn't reopen later.
  const [asking, setAsking] = useState(false)
  if (locked && asking) setAsking(false)

  if (!isSetUp) return <PrivateFolderSetup onDone={() => {}} onCancel={leave} />
  if (locked) return <PrivateFolderGate onCancel={leave} />

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
            {/* The only place Ollie can see private loans — say so plainly. */}
            <button
              type="button"
              onClick={() => setAsking(true)}
              className="w-full flex items-center gap-3 rounded-2xl bg-[var(--tint-teal)] pl-2 pr-4 py-2 text-left active:scale-[0.98] transition-transform"
            >
              <OllieCharacter mood="happy" sizeClassName="w-11" still />
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-bold text-primary">Ask Ollie about these loans</span>
                <span className="block text-[12px] text-secondary">Only here can Ollie see what's in {label}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-secondary shrink-0" />
            </button>
            {privateLoans.map((loan) => <LoanCard key={loan.id} loan={loan} />)}
          </div>
        )}
      </div>
      {asking && <AskOllieSheet includePrivate onClose={() => setAsking(false)} />}
    </div>
  )
}
