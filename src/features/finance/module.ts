import type { ModuleDef } from '../../core/modules/types'
import HealthWidget from '../home/HealthWidget'

export const financeModule: ModuleDef = {
  id: 'finance',
  widgets: [{ id: 'health', title: 'Financial health', defaultPosition: 30, Component: HealthWidget }],
}
