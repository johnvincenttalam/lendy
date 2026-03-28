import { useEffect, useState } from 'react'

const COLORS = ['#F3622D', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4']
const PARTICLE_COUNT = 60

type Particle = {
  id: number
  x: number
  color: string
  delay: number
  duration: number
  drift: number
  size: number
}

let listeners: (() => void)[] = []

export function triggerConfetti() {
  listeners.forEach((fn) => fn())
}

export default function ConfettiContainer() {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    const handler = () => {
      const newParticles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 100,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 0.5,
        duration: 1.5 + Math.random() * 1.5,
        drift: (Math.random() - 0.5) * 80,
        size: 4 + Math.random() * 6,
      }))
      setParticles(newParticles)
      setTimeout(() => setParticles([]), 3500)
    }
    listeners.push(handler)
    return () => {
      listeners = listeners.filter((fn) => fn !== handler)
    }
  }, [])

  if (particles.length === 0) return null

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: '-10px',
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
            '--drift': `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
