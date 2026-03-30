import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import LoanDetailsPage from './pages/LoanDetailsPage'
import PaySchedule from './pages/PaySchedule'
import StrategiesPage from './pages/StrategiesPage'
import AnalyticsPage from './pages/AnalyticsPage'
import ToastContainer from './components/Toast'
import ConfettiContainer from './components/Confetti'
import InstallPrompt from './components/InstallPrompt'
import PinScreen from './features/lock/PinScreen'
import { useNotificationCheck } from './features/notifications/useNotificationCheck'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  useNotificationCheck()
  return (
    <>
      <PinScreen />
      <HashRouter>
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
        </Routes>
      </HashRouter>
    </>
  )
}
