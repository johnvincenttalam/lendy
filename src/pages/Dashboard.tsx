import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, MessageCircle, SlidersHorizontal } from 'lucide-react'
import OllieCompanion from '../features/ollie/OllieCompanion'
import { HeaderIconButton } from '../components/PageHeader'
import CustomizeHomeSheet from '../features/home/CustomizeHomeSheet'
import { resolveHomeWidgets } from '../core/modules/registry'
import { useSettingsStore } from '../core/settings/settingsStore'
import { MODULES } from '../app/modules'
import NotificationBell from '../app/NotificationBell'

/**
 * Home: Ollie first, then each module's widgets in the owner's order.
 * Widgets with nothing to show render nothing.
 */
export default function Dashboard() {
  const [customizing, setCustomizing] = useState(false)
  const home = useSettingsStore((s) => s.home)
  const navigate = useNavigate()
  const widgets = resolveHomeWidgets(MODULES, home).filter((r) => !r.hidden)

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-28 lg:pb-10">
        {/* App bar */}
        <div className="flex items-center gap-3 mb-5">
          <img
            src={`${import.meta.env.BASE_URL}icon-192.png`}
            alt=""
            className="w-11 h-11 rounded-2xl"
          />
          <p className="flex-1 text-[26px] font-extrabold text-primary tracking-tight leading-none">Ollie</p>
          {/* On desktop the bell lives in the sidebar. */}
          <div className="lg:hidden"><NotificationBell /></div>
          <HeaderIconButton label="Ask Ollie" onClick={() => navigate('/ollie')}>
            <MessageCircle className="w-[18px] h-[18px] text-primary" strokeWidth={2.5} />
          </HeaderIconButton>
          <HeaderIconButton label="Settings" onClick={() => navigate('/settings')}>
            <Settings className="w-[18px] h-[18px] text-primary" strokeWidth={2.5} />
          </HeaderIconButton>
        </div>

        {/* Ollie is the page header */}
        <OllieCompanion className="mb-4" hero onAsk={() => navigate('/ollie')} />

        <div className="space-y-3">
          {widgets.map(({ widget }) => <widget.Component key={widget.id} />)}
        </div>

        <div className="flex justify-center mt-8">
          <button
            type="button"
            onClick={() => setCustomizing(true)}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-secondary transition-colors px-3 py-2 rounded-full"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Customize Home
          </button>
        </div>
      </div>
      {customizing && <CustomizeHomeSheet modules={MODULES} onClose={() => setCustomizing(false)} />}
    </div>
  )
}
