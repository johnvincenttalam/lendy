import { Calculator } from 'lucide-react'
import type { ModuleDef } from '../../core/modules/types'

/** The loan what-if calculator (the code still lives in features/planner). */
export const whatIfModule: ModuleDef = {
  id: 'whatIf',
  nav: [{ path: '/what-if', label: 'What-if', description: 'Try a new loan and see when payments go down', icon: Calculator, group: 'money' }],
}
