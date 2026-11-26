// Must stay first: upgrades data in the browser's simple storage before anything reads it.
import './features/backup/runMigrations'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/nunito/wght.css'
import './index.css'
import './features/theme/themeStore'
import App from './App'
import { requestPersistentStorage } from './features/backup/persistStorage'
import { setActiveStorage } from './features/storage/activeStorage'
import { bootstrap } from './features/storage/bootstrap'
import { openOllieDb } from './features/storage/db'
import { useStorageStatusStore } from './features/storage/storageStatusStore'
import StorageErrorScreen from './features/storage/StorageErrorScreen'
import RecoveryScreen from './features/storage/RecoveryScreen'
import { hydrateStores } from './utils/storeSnapshot'
import { useLastRestoreStore } from './features/backup/lastRestoreStore'

const root = createRoot(document.getElementById('root')!)

// Data loads once, before the first screen. Until then the page shows its plain background.
async function start() {
  const outcome = await bootstrap({
    storage: localStorage,
    hasIndexedDb: typeof indexedDB !== 'undefined',
    openDb: openOllieDb,
    now: new Date(),
  })

  if (outcome.kind === 'error') {
    root.render(<StorageErrorScreen />)
    return
  }
  if (outcome.kind === 'recovery') {
    root.render(
      <RecoveryScreen
        movedAt={outcome.movedAt}
        onRestoreFile={async (json) => {
          const { restoreIntoEmptyDatabase } = await import('./features/storage/storageActions')
          try {
            const r = await restoreIntoEmptyDatabase(outcome.db, localStorage, json, new Date())
            if (r.ok) return null
            return r.reason === 'newer'
              ? 'This backup is from a newer version of Ollie. Close and reopen the app to update, then try again.'
              : 'That file isn’t an Ollie backup.'
          } catch {
            return 'Couldn’t restore that file. Nothing was changed.'
          }
        }}
        onUseOlderCopy={async () => {
          const { refillFromOlderCopy } = await import('./features/storage/storageActions')
          const r = await refillFromOlderCopy(outcome.db, localStorage, new Date())
          return r.ok ? null : 'Couldn’t bring back the older copy. Try a backup file instead.'
        }}
      />,
    )
    return
  }

  setActiveStorage(outcome.active)
  hydrateStores(outcome.snapshot)
  useStorageStatusStore.getState().update(outcome.status)
  await useLastRestoreStore.getState().refresh()
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  const { loans, bills, savingsGoals } = outcome.snapshot
  void requestPersistentStorage(loans.length > 0 || bills.length > 0 || savingsGoals.length > 0)
}
// Anything unexpected shows the error screen rather than a blank page.
start().catch((err: unknown) => {
  console.error('Starting Ollie failed', err)
  root.render(<StorageErrorScreen />)
})

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
