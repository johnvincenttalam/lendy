import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import ToastContainer from '../components/Toast'
import ConfettiContainer from '../components/Confetti'
import InstallPrompt from '../components/InstallPrompt'
import BottomNav from '../components/BottomNav'
import { useLoanStore } from '../features/loans/loanStore'
import { usePrivateFolderStore } from '../features/privateFolder/privateFolderStore'
import { isPrivatePath } from '../features/privateFolder/privateFolderUtils'
import { useSettingsStore } from '../core/settings/settingsStore'
import { useStorageStatusStore } from '../features/storage/storageStatusStore'
import SaveFailedBanner from '../features/storage/SaveFailedBanner'
import { showToast } from '../components/toastEvents'
import Sidebar from './Sidebar'
import QuickAddSheet from './QuickAddSheet'
import PageFallback from './PageFallback'
import PageErrorBoundary from './PageErrorBoundary'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

/** The frame around every page: navigation for the screen size, quick-add, and app-wide pieces. */
export default function AppShell() {
  const location = useLocation()
  const [adding, setAdding] = useState(false)
  const collapsed = useSettingsStore((s) => s.sidebarCollapsed)
  const loans = useLoanStore((s) => s.loans)
  const lockPrivate = usePrivateFolderStore((s) => s.lock)
  const privateUnlocked = usePrivateFolderStore((s) => s.unlocked)
  const justMoved = useStorageStatusStore((s) => s.justMoved)

  // Said once, after the toast area is listening (child effects run first).
  useEffect(() => {
    // Read live, not from the closure: StrictMode runs effects twice in development.
    if (!justMoved || !useStorageStatusStore.getState().justMoved) return
    useStorageStatusStore.getState().update({ justMoved: false })
    showToast('Moved your data to sturdier storage. Your old copy is kept.')
  }, [justMoved])

  // The private folder stays open only while you're inside it (the folder or
  // one of its loans). Leaving it, or putting the app in the background,
  // locks it again so it's never left open when the phone is handed over.
  const onPrivatePath = isPrivatePath(location.pathname, loans)
  // Also catches an unlock that happens elsewhere (setting the folder up from
  // Settings or a loan menu, checking the PIN in Settings).
  useEffect(() => {
    if (privateUnlocked && !onPrivatePath) lockPrivate()
  }, [privateUnlocked, onPrivatePath, lockPrivate])
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') lockPrivate() }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [lockPrivate])

  // Close the add sheet the moment the route changes, so it never silently
  // morphs into a different form. Adjusted during render (not an effect) so
  // it applies before paint, following React's "adjusting state when a prop
  // changes" pattern.
  const [prevPathname, setPrevPathname] = useState(location.pathname)
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname)
    setAdding(false)
  }

  return (
    <>
      <ScrollToTop />
      <ConfettiContainer />
      <ToastContainer />
      <InstallPrompt />
      <Sidebar onAdd={() => setAdding(true)} />
      <main className={collapsed ? 'lg:pl-[72px]' : 'lg:pl-60'}>
        <SaveFailedBanner />
        <PageErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </PageErrorBoundary>
      </main>
      <BottomNav onAdd={() => setAdding(true)} />
      {adding && <QuickAddSheet pathname={location.pathname} privateContext={onPrivatePath} onClose={() => setAdding(false)} />}
    </>
  )
}
