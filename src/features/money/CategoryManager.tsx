import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import Sheet from './Sheet'
import ConfirmDialog from './ConfirmDialog'
import { useMoneyStore } from './moneyStore'
import { getCategoryIcon } from './moneyIcons'
import { allCategories, validateCategoryName } from './moneyUtils'
import { showToast } from '../../components/Toast'
import type { MoneyCategory } from './moneyTypes'

type Props = { onClose: () => void }

export default function CategoryManager({ onClose }: Props) {
  const { customCategories, renameCategory, deleteCategory } = useMoneyStore()
  const [pendingDelete, setPendingDelete] = useState<MoneyCategory | null>(null)

  return (
    <>
      <Sheet title="Categories" onClose={onClose}>
        <p className="text-[12px] text-muted">
          Built-in categories can&apos;t be changed. Deleting one of yours moves its entries to Other.
        </p>

        {customCategories.length === 0 ? (
          <p className="text-[13px] text-secondary py-6 text-center">
            No custom categories yet. Add one while creating an entry.
          </p>
        ) : (
          (['expense', 'income'] as const).map((type) => {
            const list = customCategories.filter((c) => c.type === type)
            if (list.length === 0) return null
            return (
              <section key={type}>
                <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
                  {type === 'expense' ? 'Expense' : 'Income'}
                </h3>
                <ul className="space-y-2">
                  {list.map((c) => (
                    <CategoryRow
                      key={c.id}
                      category={c}
                      onRename={(name) => {
                        const problem = validateCategoryName(name, c.type, allCategories(customCategories), c.id)
                        if (problem) {
                          showToast(problem)
                          return false
                        }
                        return renameCategory(c.id, name)
                      }}
                      onDelete={() => setPendingDelete(c)}
                    />
                  ))}
                </ul>
              </section>
            )
          })
        )}
      </Sheet>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete Category"
          message={`Delete "${pendingDelete.name}"? Its entries will move to Other.`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteCategory(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      )}
    </>
  )
}

function CategoryRow({
  category,
  onRename,
  onDelete,
}: {
  category: MoneyCategory
  onRename: (name: string) => boolean
  onDelete: () => void
}) {
  const Icon = getCategoryIcon(category.icon)
  const [draft, setDraft] = useState(category.name)

  function commit() {
    if (draft.trim() === category.name) return
    // Rejected renames snap back so the field never shows a name that isn't saved.
    if (!onRename(draft)) setDraft(category.name)
  }

  return (
    <li className="flex items-center gap-3 bg-subtle rounded-2xl px-3 py-2">
      <div className="w-8 h-8 rounded-[10px] bg-brand/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-brand" />
      </div>
      <input
        value={draft}
        maxLength={24}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        aria-label={`Rename ${category.name}`}
        className="flex-1 min-w-0 bg-transparent text-[14px] font-semibold text-primary outline-none"
      />
      <button
        onClick={onDelete}
        aria-label={`Delete ${category.name}`}
        className="w-8 h-8 flex items-center justify-center text-red-500 hover:opacity-70 transition-opacity"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </li>
  )
}
