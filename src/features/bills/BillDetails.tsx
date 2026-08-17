import { useState, useMemo } from 'react'
import {
  ArrowLeft, Trash2, Calendar, DollarSign, Tag, Pencil, Undo2, Archive, ArchiveRestore,
  AlertTriangle, MoreVertical, CheckCircle,
} from 'lucide-react'
import { DEFAULT_COLOR } from '../loans/loanTypes'
import type { Bill } from './billTypes'
import { isBillOverdue, billDaysOverdue } from './billUtils'
import { useBillStore } from './billStore'
import BillForm from './BillForm'
import { showToast } from '../../components/Toast'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import CurrencyAmount from '../../components/CurrencyAmount'

type Props = {
  bill: Bill
  onMarkPaid: () => void
  onDelete: () => void
  onBack: () => void
}

export default function BillDetails({ bill, onMarkPaid, onDelete, onBack }: Props) {
  const [showConfirm, setShowConfirm] = useState<'pay' | 'undo' | 'archive' | 'delete' | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  useBodyScrollLock(showConfirm !== null || showEdit)
  const updateBill = useBillStore((s) => s.updateBill)
  const undoBillPayment = useBillStore((s) => s.undoBillPayment)
  const archiveBill = useBillStore((s) => s.archiveBill)
  const unarchiveBill = useBillStore((s) => s.unarchiveBill)
  const billPayments = useBillStore((s) => s.billPayments)
  const payments = useMemo(
    () => billPayments.filter((p) => p.billId === bill.id).sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()),
    [billPayments, bill.id],
  )
  const color = bill.color || DEFAULT_COLOR
  const overdue = isBillOverdue(bill)
  const overdueDays = billDaysOverdue(bill)
  const dueDate = new Date(bill.nextDueDate)

  return (
    <div className="min-h-screen bg-page transition-colors duration-300">
      {/* Header */}
      <div className="bg-header backdrop-blur-header border-b border-themed sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2 px-4 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button onClick={onBack} className="w-9 h-9 flex-shrink-0 flex items-center justify-center hover:opacity-60 transition-opacity">
              <ArrowLeft className="w-[18px] h-[18px] text-secondary" />
            </button>
            <div
              className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-[12px] font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {bill.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-primary text-[16px] tracking-tight truncate">{bill.name}</h1>
              <span className="text-[10px] font-semibold text-muted bg-subtle px-1.5 py-[1px] rounded-md">{bill.category}</span>
            </div>
          </div>
          <div className="flex items-center flex-shrink-0 relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="w-9 h-9 flex items-center justify-center hover:opacity-60 transition-opacity"
              title="More actions"
              aria-haspopup="menu"
              aria-expanded={showMenu}
            >
              <MoreVertical className="w-[18px] h-[18px] text-secondary" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <div role="menu" className="absolute right-0 top-11 bg-card border border-themed rounded-xl z-40 py-1 min-w-[180px] shadow-lg animate-scale-in">
                  <button
                    role="menuitem"
                    onClick={() => { setShowMenu(false); setShowEdit(true) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-secondary hover:bg-subtle transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  {payments.length > 0 && !bill.archived && (
                    <button
                      role="menuitem"
                      onClick={() => { setShowMenu(false); setShowConfirm('undo') }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-secondary hover:bg-subtle transition-colors"
                    >
                      <Undo2 className="w-4 h-4" />
                      Undo last payment
                    </button>
                  )}
                  <button
                    role="menuitem"
                    onClick={() => { setShowMenu(false); setShowConfirm('archive') }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-secondary hover:bg-subtle transition-colors"
                  >
                    {bill.archived ? (
                      <>
                        <ArchiveRestore className="w-4 h-4 text-amber-500" />
                        Restore bill
                      </>
                    ) : (
                      <>
                        <Archive className="w-4 h-4" />
                        Archive bill
                      </>
                    )}
                  </button>
                  <div className="my-1 border-t border-themed" />
                  <button
                    role="menuitem"
                    onClick={() => { setShowMenu(false); setShowConfirm('delete') }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-red-500 dark:text-red-400 hover:bg-subtle transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete bill
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-8 space-y-4">
        {/* Hero */}
        <div className="bg-card rounded-2xl border border-themed transition-colors overflow-hidden">
          {bill.archived && (
            <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold uppercase tracking-wider text-center py-2 border-b border-amber-500/20">
              Archived
            </div>
          )}
          {overdue && (
            <div className="bg-red-500/10 text-red-500 text-[12px] font-semibold text-center py-2.5 border-b border-red-500/20 flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>
                Overdue by {overdueDays} {overdueDays === 1 ? 'day' : 'days'}
                <span className="text-red-400 font-normal"> (due {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</span>
              </span>
            </div>
          )}
          {!overdue && !bill.archived && (
            <div className="bg-subtle text-secondary text-[12px] font-medium text-center py-2.5 border-b border-divider flex items-center justify-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted" />
              <span>Due {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          )}
          <div className="px-4 pt-6 pb-6 text-center">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-1.5">Amount</p>
            <p className="text-[36px] font-bold font-mono text-primary tracking-tighter leading-none"><CurrencyAmount value={bill.amount} /></p>
          </div>
        </div>

        {bill.notes && (
          <div className="bg-card rounded-2xl border border-themed p-4 transition-colors">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-1.5">Notes</p>
            <p className="text-[13px] text-secondary whitespace-pre-wrap break-words leading-relaxed">{bill.notes}</p>
          </div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <InfoCard icon={<DollarSign className="w-3.5 h-3.5" />} label="Amount" value={<CurrencyAmount value={bill.amount} />} />
          <InfoCard icon={<Tag className="w-3.5 h-3.5" />} label="Category" value={bill.category} />
        </div>

        {/* Payment history */}
        <div className="bg-card rounded-2xl border border-themed transition-colors overflow-hidden">
          <div className="px-4 pt-4 pb-2.5">
            <h3 className="font-bold text-primary text-[15px] tracking-tight">Payment History</h3>
          </div>
          {payments.length === 0 ? (
            <p className="px-4 pb-4 text-[13px] text-muted">No payments recorded yet</p>
          ) : (
            <div>
              {payments.map((p) => (
                <div key={p.id} className="px-4 py-3.5 flex items-center gap-3 border-t border-divider">
                  <CheckCircle className="w-[18px] h-[18px] text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-bold text-primary">
                      {new Date(p.paidAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <p className="text-[11px] text-muted">
                      For cycle due {new Date(p.dueDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-[14px] font-bold text-primary"><CurrencyAmount value={p.amount} /></span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-24" />
      </div>

      {/* Sticky CTA */}
      {!bill.archived && (
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-page via-page to-transparent pt-6 pb-6 px-4">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setShowConfirm('pay')}
              className="w-full text-white font-bold py-4 rounded-2xl active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 text-[15px] tracking-tight hover:opacity-90"
              style={{ backgroundColor: color }}
            >
              Mark as Paid
            </button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEdit && (
        <BillForm
          initial={bill}
          onSubmit={(data) => {
            updateBill(bill.id, data)
            setShowEdit(false)
            showToast(`"${data.name}" updated`)
          }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-overlay z-50 flex items-center justify-center p-5 animate-fade-in">
          <div className="bg-card rounded-2xl p-6 max-w-[320px] w-full border border-themed transition-colors animate-scale-in">
            <h3 className="font-bold text-primary text-[18px] tracking-tight mb-2">
              {showConfirm === 'pay' ? 'Confirm Payment' : showConfirm === 'undo' ? 'Undo Payment' : showConfirm === 'archive' ? (bill.archived ? 'Restore Bill' : 'Archive Bill') : 'Delete Bill'}
            </h3>
            {showConfirm === 'pay' ? (
              <p className="text-[13px] text-secondary mb-6">
                Mark <CurrencyAmount value={bill.amount} /> as paid for this cycle?
              </p>
            ) : showConfirm === 'undo' ? (
              <p className="text-[13px] text-secondary mb-6">Undo the last recorded payment for this bill?</p>
            ) : showConfirm === 'archive' ? (
              <p className="text-[13px] text-secondary mb-6">
                {bill.archived
                  ? `Restore "${bill.name}"? It will appear in your active bills again.`
                  : `Archive "${bill.name}"? It will be hidden from your bills list but can be restored later.`}
              </p>
            ) : (
              <p className="text-[13px] text-secondary mb-6">Delete "{bill.name}"? This cannot be undone.</p>
            )}
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 py-3 rounded-xl bg-subtle text-secondary font-semibold text-[14px] hover:opacity-80 transition-opacity"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showConfirm === 'pay') onMarkPaid()
                  else if (showConfirm === 'undo') {
                    undoBillPayment(bill.id)
                    showToast('Payment reverted')
                  } else if (showConfirm === 'archive') {
                    if (bill.archived) unarchiveBill(bill.id)
                    else {
                      archiveBill(bill.id)
                      onBack()
                    }
                  } else onDelete()
                  setShowConfirm(null)
                }}
                className="flex-1 py-3 rounded-xl font-semibold text-[14px] text-white hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: showConfirm === 'pay' ? color : showConfirm === 'undo' ? '#F59E0B' : showConfirm === 'archive' ? '#6366F1' : '#EF4444',
                }}
              >
                {showConfirm === 'pay' ? 'Confirm' : showConfirm === 'undo' ? 'Undo' : showConfirm === 'archive' ? (bill.archived ? 'Restore' : 'Archive') : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl p-3.5 border border-themed transition-colors">
      <div className="flex items-center gap-1 text-muted mb-1.5">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">{label}</span>
      </div>
      <p className="font-bold text-[13px] tracking-tight text-primary">{value}</p>
    </div>
  )
}
