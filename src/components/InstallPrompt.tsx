import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if already dismissed recently
    const lastDismissed = localStorage.getItem('pwa-install-dismissed')
    if (lastDismissed) {
      const diff = Date.now() - Number(lastDismissed)
      if (diff < 3 * 24 * 60 * 60 * 1000) {
        setDismissed(true)
        return
      }
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!deferredPrompt || dismissed) return null

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  function handleDismiss() {
    setDismissed(true)
    localStorage.setItem('pwa-install-dismissed', String(Date.now()))
  }

  return (
    <div className="fixed bottom-6 left-0 right-0 z-[90] flex justify-center px-3 animate-slide-up">
      <div className="max-w-2xl w-full bg-card border border-themed rounded-2xl p-4 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-[13px] bg-brand flex items-center justify-center shrink-0"
        >
          <img src={`${import.meta.env.BASE_URL}lendy.png`} alt="Lendy" className="w-6 h-6 rounded-md" />
        </div>
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
        <button
          onClick={handleDismiss}
          className="shrink-0 w-7 h-7 flex items-center justify-center hover:opacity-60 transition-opacity"
        >
          <X className="w-3.5 h-3.5 text-muted" />
        </button>
      </div>
    </div>
  )
}
