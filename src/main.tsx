// Must stay first: upgrades saved data before any store reads it.
import './features/backup/runMigrations'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/nunito/wght.css'
import './index.css'
import './features/theme/themeStore'
import App from './App'
import { requestPersistentStorage } from './features/backup/persistStorage'
import { getActiveStorage } from './features/storage/activeStorage'
import { persist } from './features/storage/persist'
import { backfillPayments } from './features/loans/paymentBackfill'
import { hydrateStores } from './utils/storeSnapshot'
import { useLastRestoreStore } from './features/backup/lastRestoreStore'

const root = createRoot(document.getElementById('root')!)

// Data loads once, before the first screen.
async function start() {
  const snapshot = await getActiveStorage().backend.readAll()
  const payments = backfillPayments(snapshot.loans, snapshot.payments)
  if (payments.length > snapshot.payments.length) void persist({ payments: { next: payments, prev: snapshot.payments } })
  hydrateStores({ ...snapshot, payments })
  await useLastRestoreStore.getState().refresh()
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  const hasData = snapshot.loans.length > 0 || snapshot.bills.length > 0 || snapshot.savingsGoals.length > 0
  void requestPersistentStorage(hasData)
}
void start()

// A tab left open across an update asks for page files the new version
// replaced. Reload once to pick up the new version; the page error boundary
// covers the case where that can't help (offline).
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'ollie-preload-reload'
  try {
    const last = Number(sessionStorage.getItem(KEY))
    if (Date.now() - last < 10_000) return
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
