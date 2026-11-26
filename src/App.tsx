import { lazy } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import PinScreen from './features/lock/PinScreen'
import { useNotificationCheck } from './features/notifications/useNotificationCheck'
import AppShell from './app/AppShell'
import DeadlinesProvider from './app/DeadlinesProvider'

// Home loads with the app; every other page loads the first time it's opened.
const LoanDetailsPage = lazy(() => import('./pages/LoanDetailsPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const PlannerPage = lazy(() => import('./pages/PlannerPage'))
const BillsPage = lazy(() => import('./pages/BillsPage'))
const BillDetailsPage = lazy(() => import('./pages/BillDetailsPage'))
const SavingsPage = lazy(() => import('./pages/SavingsPage'))
const SavingsGoalDetailsPage = lazy(() => import('./pages/SavingsGoalDetailsPage'))
const MorePage = lazy(() => import('./pages/MorePage'))
const WhatsNewPage = lazy(() => import('./pages/WhatsNewPage'))
const PrivateFolderPage = lazy(() => import('./pages/PrivateFolderPage'))
const WhatIfPage = lazy(() => import('./pages/WhatIfPage'))

export default function App() {
  useNotificationCheck()
  return (
    <>
      <PinScreen />
      <HashRouter>
        <DeadlinesProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/planner" element={<PlannerPage />} />
              <Route path="/ollie" element={<Navigate to="/" replace />} />
              <Route path="/more" element={<MorePage />} />
              <Route path="/what-if" element={<WhatIfPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/bills" element={<BillsPage />} />
              <Route path="/bills/:id" element={<BillDetailsPage />} />
              <Route path="/savings" element={<SavingsPage />} />
              <Route path="/savings/:id" element={<SavingsGoalDetailsPage />} />
              <Route path="/loan/:id" element={<LoanDetailsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/whats-new" element={<WhatsNewPage />} />
              <Route path="/private" element={<PrivateFolderPage />} />
              {/* The calendar now lives in the Planner. */}
              <Route path="/calendar" element={<Navigate to="/planner?view=calendar" replace />} />
              {/* Removed pages (like the old Money page) and mistyped links go Home instead of a blank screen. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </DeadlinesProvider>
      </HashRouter>
    </>
  )
}
