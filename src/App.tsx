import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import LoanDetailsPage from './pages/LoanDetailsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import CalendarPage from './pages/CalendarPage'
import BillsPage from './pages/BillsPage'
import BillDetailsPage from './pages/BillDetailsPage'
import MoneyPage from './pages/MoneyPage'
import SavingsPage from './pages/SavingsPage'
import SavingsGoalDetailsPage from './pages/SavingsGoalDetailsPage'
import MorePage from './pages/MorePage'
import WhatsNewPage from './pages/WhatsNewPage'
import ToastContainer from './components/Toast'
import ConfettiContainer from './components/Confetti'
import InstallPrompt from './components/InstallPrompt'
import BottomNav from './components/BottomNav'
import PinScreen from './features/lock/PinScreen'
import LoanForm from './features/loans/LoanForm'
import BillForm from './features/bills/BillForm'
import SavingsGoalForm from './features/savings/SavingsGoalForm'
import { useLoanStore } from './features/loans/loanStore'
import { useBillStore } from './features/bills/billStore'
import { useSavingsStore } from './features/savings/savingsStore'
import { useNotificationCheck } from './features/notifications/useNotificationCheck'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function AppContent() {
  const [showForm, setShowForm] = useState(false)
  const location = useLocation()
  const addLoan = useLoanStore((s) => s.addLoan)
  const addBill = useBillStore((s) => s.addBill)
  const addGoal = useSavingsStore((s) => s.addGoal)

  const handleAdd = () => {
    setShowForm(true)
  }

  // Close any open form sheet the moment the route changes, so it never
  // silently morphs into a different form (e.g. "New Bill" -> "New Loan").
  // Adjusted during render (not an effect) so it applies before paint and
  // never fires on the initial mount, following React's "adjusting state
  // when a prop changes" pattern.
  const [prevPathname, setPrevPathname] = useState(location.pathname)
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname)
    setShowForm(false)
  }

  const addTarget: 'loan' | 'bill' | 'goal' =
    location.pathname === '/bills' ? 'bill' : location.pathname === '/savings' ? 'goal' : 'loan'

  return (
    <>
      <ScrollToTop />
      <ConfettiContainer />
      <ToastContainer />
      <InstallPrompt />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/loan/:id" element={<LoanDetailsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/bills" element={<BillsPage />} />
        <Route path="/bills/:id" element={<BillDetailsPage />} />
        <Route path="/savings" element={<SavingsPage />} />
        <Route path="/savings/:id" element={<SavingsGoalDetailsPage />} />
        <Route path="/money" element={<MoneyPage />} />
        <Route path="/more" element={<MorePage />} />
        <Route path="/whats-new" element={<WhatsNewPage />} />
      </Routes>
      <BottomNav onAdd={handleAdd} />
      {showForm && addTarget === 'loan' && (
        <LoanForm
          onSubmit={(data) => {
            addLoan(data)
            setShowForm(false)
          }}
          onClose={() => setShowForm(false)}
        />
      )}
      {showForm && addTarget === 'bill' && (
        <BillForm
          onSubmit={(data) => {
            addBill(data)
            setShowForm(false)
          }}
          onClose={() => setShowForm(false)}
        />
      )}
      {showForm && addTarget === 'goal' && (
        <SavingsGoalForm
          onSubmit={(data) => {
            addGoal(data)
            setShowForm(false)
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </>
  )
}

export default function App() {
  useNotificationCheck()
  return (
    <>
      <PinScreen />
      <HashRouter>
        <AppContent />
      </HashRouter>
    </>
  )
}
