import type { ModuleDef } from '../../core/modules/types'
import DueSoonWidget from './DueSoonWidget'

/** Home's cross-module pieces. */
export const homeModule: ModuleDef = {
  id: 'home',
  widgets: [{ id: 'due-soon', title: 'Due soon', defaultPosition: 10, Component: DueSoonWidget }],
}
