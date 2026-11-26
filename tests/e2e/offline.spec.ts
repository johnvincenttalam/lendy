import { test, expect } from '@playwright/test'

// Runs against the production build (the "offline" project): pages load on
// demand, so the service worker must have precached every page's code.
test('every page opens offline after one online visit to Home', async ({ page, context }) => {
  await page.goto('/#/')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  // Let the worker finish installing, then load a page it controls.
  await page.waitForTimeout(1500)
  await page.reload()
  await context.setOffline(true)
  for (const [hash, heading] of [['planner', 'Planner'], ['ollie', 'Ollie'], ['more', 'More'], ['bills', 'Bills'], ['savings', 'Savings'], ['what-if', 'What-if'], ['analytics', 'Analytics'], ['settings', 'Settings']] as const) {
    await page.goto(`/#/${hash}`)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
})
