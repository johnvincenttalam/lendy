import { useEffect } from 'react'
import { Lock } from 'lucide-react'
import { useLockStore } from './lockStore'
import PinPad from './PinPad'

export default function PinScreen() {
  const { locked, verifyPin, lock } = useLockStore()

  // Re-lock when app goes to background
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') lock()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [lock])

  if (!locked) return null

  return (
    <div className="fixed inset-0 z-[200] bg-page flex flex-col items-center justify-center">
      <PinPad
        title="Welcome back"
        subtitle="Enter your 4-digit PIN to unlock Ollie"
        icon={
          <div className="relative">
            <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="Ollie" className="w-20 h-20 rounded-3xl" />
            <span className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-card border-4 border-[var(--color-page)] flex items-center justify-center">
              <Lock className="w-3.5 h-3.5 text-brand" strokeWidth={2.5} />
            </span>
          </div>
        }
        onComplete={verifyPin}
      />
    </div>
  )
}
