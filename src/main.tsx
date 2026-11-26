// Must stay first: upgrades saved data before any store reads it.
import './features/backup/runMigrations'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/nunito/wght.css'
import './index.css'
import './features/theme/themeStore'
import App from './App'
import { requestPersistentStorage } from './features/backup/persistStorage'
import { useLoanStore } from './features/loans/loanStore'
import { useBillStore } from './features/bills/billStore'
import { useSavingsStore } from './features/savings/savingsStore'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

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

const hasData = useLoanStore.getState().loans.length > 0
  || useBillStore.getState().bills.length > 0
  || useSavingsStore.getState().goals.length > 0
void requestPersistentStorage(hasData)
