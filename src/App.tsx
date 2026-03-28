import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import LoanDetailsPage from './pages/LoanDetailsPage'
import ToastContainer from './components/Toast'
import ConfettiContainer from './components/Confetti'
import InstallPrompt from './components/InstallPrompt'

export default function App() {
  return (
    <BrowserRouter>
      <ConfettiContainer />
      <ToastContainer />
      <InstallPrompt />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/loan/:id" element={<LoanDetailsPage />} />
      </Routes>
    </BrowserRouter>
  )
}
