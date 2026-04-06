import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import LoanDetailsPage from './pages/LoanDetailsPage'
import PaySchedule from './pages/PaySchedule'
import StrategiesPage from './pages/StrategiesPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import CalendarPage from './pages/CalendarPage'
import ToastContainer from './components/Toast'
import ConfettiContainer from './components/Confetti'
import InstallPrompt from './components/InstallPrompt'
import BottomNav from './components/BottomNav'
import PinScreen from './features/lock/PinScreen'
import LoanForm from './features/loans/LoanForm'
import { useLoanStore } from './features/loans/loanStore'
import { useNotificationCheck } from './features/notifications/useNotificationCheck'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function AppContent() {
  const [showForm, setShowForm] = useState(false)
  const addLoan = useLoanStore((s) => s.addLoan)
  const navigate = useNavigate()
  const location = useLocation()

  const handleAdd = () => {
    if (location.pathname !== '/') {
      navigate('/')
    }
    setShowForm(true)
  }

  return (
    <>
      <ScrollToTop />
      <ConfettiContainer />
      <ToastContainer />
      <InstallPrompt />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/loan/:id" element={<LoanDetailsPage />} />
        <Route path="/schedule" element={<PaySchedule />} />
        <Route path="/strategies" element={<StrategiesPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <BottomNav onAdd={handleAdd} />
      {showForm && (
        <LoanForm
          onSubmit={(data) => {
            addLoan(data)
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
