import { useState, useEffect } from 'react'
import { X, Share } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa-install-dismissed'
const DISMISS_DURATION_MS = 3 * 24 * 60 * 60 * 1000

function wasRecentlyDismissed() {
  const last = localStorage.getItem(DISMISS_KEY)
  if (!last) return false
  return Date.now() - Number(last) < DISMISS_DURATION_MS
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => wasRecentlyDismissed())
  const [showIOSHint, setShowIOSHint] = useState(() => !wasRecentlyDismissed() && isIOS() && !isStandalone())

  useEffect(() => {
    if (dismissed) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [dismissed])

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
  }

  function handleDismiss() {
    setDismissed(true)
    setDeferredPrompt(null)
    setShowIOSHint(false)
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  }

  if (dismissed) return null

  if (deferredPrompt) {
    return (
      <PromptShell onDismiss={handleDismiss}>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-primary">Install Lendy</p>
          <p className="text-[12px] text-muted">Add to home screen for quick access</p>
        </div>
        <button
          onClick={handleInstall}
          className="shrink-0 bg-brand text-white text-[13px] font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity active:scale-95"
        >
          Install
        </button>
      </PromptShell>
    )
  }

  if (showIOSHint) {
    return (
      <PromptShell onDismiss={handleDismiss}>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-primary">Install Lendy</p>
          <p className="text-[12px] text-muted flex items-center gap-1 flex-wrap">
            Tap
            <Share className="w-3.5 h-3.5 inline" />
            then <span className="font-semibold">Add to Home Screen</span>
          </p>
        </div>
      </PromptShell>
    )
  }

  return null
}

function PromptShell({ children, onDismiss }: { children: React.ReactNode; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-6 left-0 right-0 z-[90] flex justify-center px-3 animate-slide-up">
      <div className="max-w-2xl w-full bg-card border border-themed rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-[13px] bg-brand flex items-center justify-center shrink-0">
          <img src={`${import.meta.env.BASE_URL}lendy.png`} alt="Lendy" className="w-6 h-6 rounded-md" />
        </div>
        {children}
        <button
          onClick={onDismiss}
          className="shrink-0 w-7 h-7 flex items-center justify-center hover:opacity-60 transition-opacity"
        >
          <X className="w-3.5 h-3.5 text-muted" />
        </button>
      </div>
    </div>
  )
}
