import { ArrowUp, ArrowDown } from 'lucide-react'
import Sheet from '../../components/Sheet'
import type { ModuleDef } from '../../core/modules/types'
import { allWidgets, moveWidget, resolveHomeWidgets, toggleWidget } from '../../core/modules/registry'
import { useSettingsStore } from '../../core/settings/settingsStore'

const iconButton =
  'w-9 h-9 rounded-full flex items-center justify-center bg-subtle text-secondary hover:text-primary disabled:opacity-30 disabled:hover:text-secondary transition-colors'

/** Reorder and hide Home's sections. Saved on this device. */
export default function CustomizeHomeSheet({ modules, onClose }: { modules: ModuleDef[]; onClose: () => void }) {
  const home = useSettingsStore((s) => s.home)
  const setHomeLayout = useSettingsStore((s) => s.setHomeLayout)
  const resetHomeLayout = useSettingsStore((s) => s.resetHomeLayout)
  const rows = resolveHomeWidgets(modules, home)
  const all = allWidgets(modules)

  return (
    <Sheet
      title="Customize Home"
      onClose={onClose}
      footer={(
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={resetHomeLayout}
            className="flex-1 py-3 rounded-xl bg-subtle text-secondary font-semibold text-[14px] hover:opacity-80 transition-opacity"
          >
            Reset to default
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-brand text-on-brand font-bold text-[14px] hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      )}
    >
      <p className="text-[13px] text-muted">Ollie always comes first. Sections with nothing to show stay out of the way on their own.</p>
      <ul className="space-y-2">
        {rows.map(({ widget, hidden }, i) => (
          <li key={widget.id} className="flex items-center gap-2 bg-subtle/50 rounded-2xl pl-4 pr-2 py-2">
            <span className={`flex-1 text-[14px] font-semibold ${hidden ? 'text-muted line-through' : 'text-primary'}`}>{widget.title}</span>
            <button
              type="button"
              role="switch"
              aria-checked={!hidden}
              aria-label={`Show ${widget.title}`}
              onClick={() => setHomeLayout(toggleWidget(home, widget.id))}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${hidden ? 'bg-[var(--tint-neutral)]' : 'bg-brand'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${hidden ? 'left-0.5' : 'left-[22px]'}`} />
            </button>
            <button
              type="button"
              aria-label={`Move ${widget.title} up`}
              disabled={i === 0}
              onClick={() => setHomeLayout(moveWidget(home, all, widget.id, -1))}
              className={iconButton}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label={`Move ${widget.title} down`}
              disabled={i === rows.length - 1}
              onClick={() => setHomeLayout(moveWidget(home, all, widget.id, 1))}
              className={iconButton}
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
