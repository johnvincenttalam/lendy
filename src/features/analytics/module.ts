import { BarChart3 } from 'lucide-react'
import type { ModuleDef } from '../../core/modules/types'

export const analyticsModule: ModuleDef = {
  id: 'analytics',
  nav: [{ path: '/analytics', label: 'Analytics', description: 'Payoff timeline, interest and trends', icon: BarChart3, group: 'money' }],
}
