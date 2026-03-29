import { Bell, BellOff } from 'lucide-react'
import { useNotificationStore } from './notificationStore'
import { showToast } from '../../components/Toast'

export default function NotificationSettings() {
  const { enabled, reminderDays, setEnabled, setReminderDays } = useNotificationStore()

  const handleToggle = async () => {
    if (!enabled) {
      if (!('Notification' in window)) {
        showToast('Notifications not supported in this browser')
        return
      }
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        showToast('Notifications blocked by browser')
        return
      }
      setEnabled(true)
      showToast('Reminders enabled')
    } else {
      setEnabled(false)
      showToast('Reminders disabled')
    }
  }

  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
        Payment Reminders
      </label>
      <div className="flex items-center gap-2">
        <button
          onClick={handleToggle}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
            enabled
              ? 'bg-brand/10 text-brand'
              : 'bg-subtle text-secondary hover:opacity-80'
          }`}
        >
          {enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          {enabled ? 'Reminders On' : 'Enable Reminders'}
        </button>
        {enabled && (
          <div className="flex items-center gap-1.5">
            <select
              value={reminderDays}
              onChange={(e) => setReminderDays(Number(e.target.value))}
              className="py-2.5 px-3 rounded-xl bg-subtle border border-themed text-[13px] font-semibold text-primary appearance-none cursor-pointer"
            >
              {[1, 2, 3, 5, 7].map((d) => (
                <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'} before</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
