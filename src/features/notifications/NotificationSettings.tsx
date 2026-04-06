import { useState } from 'react'
import { Bell, BellOff, BellRing, AlertTriangle, Calendar, Clock } from 'lucide-react'
import { useNotificationStore } from './notificationStore'
import { useLoanStore } from '../loans/loanStore'
import { getUpcomingPaymentsPreview } from './useNotificationCheck'
import { formatCurrency } from '../loans/loanUtils'
import { showToast } from '../../components/Toast'

export default function NotificationSettings() {
  const {
    enabled, reminderDays, remindOnDueDate, remindOverdue,
    setEnabled, setReminderDays, setRemindOnDueDate, setRemindOverdue,
  } = useNotificationStore()
  const loans = useLoanStore((s) => s.loans)
  const [showPreview, setShowPreview] = useState(false)

  const handleToggle = async () => {
    if (!enabled) {
      if (!('Notification' in window)) {
        showToast('Notifications not supported in this browser')
        return
      }
      // Check if already denied - user must manually allow in browser settings
      if (Notification.permission === 'denied') {
        showToast('Notifications blocked. Please allow in browser settings.')
        return
      }
      // Request permission if not already granted
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') {
          showToast('Notifications permission denied')
          return
        }
      }
      setEnabled(true)
      showToast('Reminders enabled')
    } else {
      setEnabled(false)
      showToast('Reminders disabled')
    }
  }

  const handleTestNotification = () => {
    if (!('Notification' in window)) {
      showToast('Notifications not supported')
      return
    }
    if (Notification.permission !== 'granted') {
      showToast('Please enable notifications first')
      return
    }
    new Notification('Test Reminder', {
      body: 'Your payment reminders are working!',
      icon: '/lendy/icon-192.png',
    })
    showToast('Test notification sent')
  }

  const upcomingPayments = getUpcomingPaymentsPreview(loans, reminderDays)

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
          Payment Reminders
        </label>

        {/* Main toggle */}
        <button
          onClick={handleToggle}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold transition-all ${
            enabled
              ? 'bg-brand text-white'
              : 'bg-subtle text-secondary hover:opacity-80'
          }`}
        >
          {enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          {enabled ? 'Reminders Enabled' : 'Enable Reminders'}
        </button>
      </div>

      {enabled && (
        <>
          {/* Reminder options */}
          <div className="space-y-2.5">
            {/* Days before */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted" />
                <span className="text-[13px] text-secondary">Remind me</span>
              </div>
              <select
                value={reminderDays}
                onChange={(e) => setReminderDays(Number(e.target.value))}
                className="py-2 px-3 rounded-lg bg-subtle border border-themed text-[13px] font-semibold text-primary cursor-pointer"
              >
                {[1, 2, 3, 5, 7].map((d) => (
                  <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'} before</option>
                ))}
              </select>
            </div>

            {/* On due date toggle */}
            <button
              onClick={() => setRemindOnDueDate(!remindOnDueDate)}
              className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl bg-subtle"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted" />
                <span className="text-[13px] text-secondary">Remind on due date</span>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors ${remindOnDueDate ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform mt-0.5 ${remindOnDueDate ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
              </div>
            </button>

            {/* Overdue toggle */}
            <button
              onClick={() => setRemindOverdue(!remindOverdue)}
              className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl bg-subtle"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-[13px] text-secondary">Remind if overdue</span>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors ${remindOverdue ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform mt-0.5 ${remindOverdue ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </div>

          {/* Test & Preview buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleTestNotification}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-subtle text-secondary text-[12px] font-semibold hover:opacity-80 transition-opacity"
            >
              <BellRing className="w-3.5 h-3.5" />
              Test
            </button>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-subtle text-secondary text-[12px] font-semibold hover:opacity-80 transition-opacity"
            >
              {showPreview ? 'Hide' : 'Preview'} ({upcomingPayments.length})
            </button>
          </div>

          {/* Preview list */}
          {showPreview && upcomingPayments.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Upcoming Reminders</p>
              {upcomingPayments.slice(0, 5).map(({ loan, daysUntil, isOverdue, daysOverdue }) => (
                <div
                  key={loan.id}
                  className={`flex items-center justify-between py-2 px-3 rounded-lg text-[12px] ${
                    isOverdue ? 'bg-red-500/10' : 'bg-subtle'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: loan.color || '#E8541E' }}
                    >
                      {loan.name.charAt(0)}
                    </div>
                    <span className="text-secondary truncate">{loan.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-muted">{formatCurrency(loan.monthlyPayment)}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isOverdue
                        ? 'bg-red-500/20 text-red-500'
                        : daysUntil === 0
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-brand/10 text-brand'
                    }`}>
                      {isOverdue ? `${daysOverdue}d overdue` : daysUntil === 0 ? 'Today' : `${daysUntil}d`}
                    </span>
                  </div>
                </div>
              ))}
              {upcomingPayments.length > 5 && (
                <p className="text-[11px] text-muted text-center pt-1">
                  +{upcomingPayments.length - 5} more
                </p>
              )}
            </div>
          )}

          {showPreview && upcomingPayments.length === 0 && (
            <p className="text-[12px] text-muted text-center py-3">
              No upcoming payments in the next {reminderDays} days
            </p>
          )}
        </>
      )}
    </div>
  )
}
