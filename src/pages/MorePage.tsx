import { useNavigate } from 'react-router-dom'
import { Receipt, PiggyBank, Wallet, Settings, ChevronRight, FolderLock } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { usePrivateFolderStore } from '../features/privateFolder/privateFolderStore'
import { folderLabel } from '../features/privateFolder/privateFolderUtils'

const MORE_ITEMS = [
  { path: '/bills', icon: Receipt, label: 'Bills', description: 'Track your monthly bills' },
  { path: '/savings', icon: PiggyBank, label: 'Savings', description: 'Track your savings goals' },
  { path: '/money', icon: Wallet, label: 'Money', description: 'Track income and expenses' },
  { path: '/settings', icon: Settings, label: 'Settings', description: 'Appearance, income, security and your data' },
] as const

export default function MorePage() {
  const navigate = useNavigate()
  const folderName = usePrivateFolderStore((s) => s.name)
  const folderHasPin = usePrivateFolderStore((s) => s.pinHash !== null)

  // The folder row never shows a count, so it reads the same empty or full.
  const items = [
    ...MORE_ITEMS.slice(0, 3),
    { path: '/private', icon: FolderLock, label: folderLabel(folderName), description: folderHasPin ? 'Locked with its own PIN' : 'Hidden from the rest of Ollie' },
    MORE_ITEMS[3],
  ]

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <PageHeader title="More" subtitle="Bills, savings, money and settings" />

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-2.5">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 bg-card rounded-2xl border border-themed p-4 text-left transition-all duration-200 active:scale-[0.98] hover:bg-card-hover"
            >
              <div className="w-9 h-9 rounded-[11px] bg-brand/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-primary text-[14px] tracking-tight">{item.label}</p>
                <p className="text-[12px] text-muted">{item.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
