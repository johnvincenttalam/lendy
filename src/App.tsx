import { HashRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import LoanDetailsPage from './pages/LoanDetailsPage'
import PaySchedule from './pages/PaySchedule'
import StrategiesPage from './pages/StrategiesPage'
import ToastContainer from './components/Toast'
import ConfettiContainer from './components/Confetti'
import InstallPrompt from './components/InstallPrompt'
import PinScreen from './features/lock/PinScreen'
import { useNotificationCheck } from './features/notifications/useNotificationCheck'

export default function App() {
  useNotificationCheck()
  return (
    <>
      <PinScreen />
      <HashRouter>
        <ConfettiContainer />
        <ToastContainer />
        <InstallPrompt />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/loan/:id" element={<LoanDetailsPage />} />
          <Route path="/schedule" element={<PaySchedule />} />
        <Route path="/strategies" element={<StrategiesPage />} />
        </Routes>
      </HashRouter>
    </>
  )
}
