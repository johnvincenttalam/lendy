import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import Sheet from '../components/Sheet'
import type { QuickAddAction } from '../core/modules/types'
import { quickAddActions, quickAddTarget } from '../core/modules/registry'
import { MODULES } from './modules'

type Choice = { action: QuickAddAction; privateLoan: boolean }

/**
 * What [+] opens: on a module's own page, that module's form straight away;
 * everywhere else, a short menu of things to add.
 */
export default function QuickAddSheet({ pathname, privateContext, onClose }: { pathname: string; privateContext: boolean; onClose: () => void }) {
  const [choice, setChoice] = useState<Choice | null>(() => {
    const target = quickAddTarget(pathname, MODULES, { privateContext })
    return target === 'menu' ? null : target
  })

  if (choice) {
    const Form = choice.action.Form
    return <Form onClose={onClose} privateLoan={choice.privateLoan} />
  }

  return (
    <Sheet title="Add" onClose={onClose}>
      <ul className="space-y-2">
        {quickAddActions(MODULES).map((action) => {
          const Icon = action.icon
          return (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => setChoice({ action, privateLoan: false })}
                className="w-full flex items-center gap-3 bg-subtle/60 rounded-2xl p-4 text-left hover:bg-card-hover focus-visible:ring-2 focus-visible:ring-brand transition-colors"
              >
                <span className="w-10 h-10 rounded-[12px] bg-brand/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-brand" />
                </span>
                <span className="flex-1 text-[15px] font-bold text-primary">{action.label}</span>
                <ChevronRight className="w-4 h-4 text-muted" />
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
