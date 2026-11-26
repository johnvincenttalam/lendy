import type { ModuleDef } from '../core/modules/types'
import { homeModule } from '../features/home/module'
import { loansModule } from '../features/loans/module'
import { financeModule } from '../features/finance/module'
import { billsModule } from '../features/bills/module'
import { savingsModule } from '../features/savings/module'
import { whatIfModule } from '../features/planner/module'
import { analyticsModule } from '../features/analytics/module'

/**
 * Every module, in the order their entries appear in menus. The nav, More,
 * the [+] menu, Home, the Planner and the reminders bell are all built from this list.
 */
export const MODULES: ModuleDef[] = [
  homeModule,
  loansModule,
  financeModule,
  billsModule,
  savingsModule,
  whatIfModule,
  analyticsModule,
]
