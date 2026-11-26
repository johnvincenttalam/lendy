import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Synthetic records only — never real data. Each test gets a fresh browser context.
const loans = [
  { id: 'L1', name: 'Test Phone', color: '#3B82F6', totalAmount: 6000, monthlyPayment: 1000, interestRate: 0, durationMonths: 6, startDate: '2026-11-01', monthsPaid: 0, totalPaid: 0, totalInterestPaid: 0, createdAt: '2026-11-01T00:00:00.000Z' },
  { id: 'L2', name: 'Test Laptop', color: '#10B981', totalAmount: 12000, monthlyPayment: 2000, interestRate: 0, durationMonths: 6, startDate: '2026-11-01', monthsPaid: 0, totalPaid: 0, totalInterestPaid: 0, createdAt: '2026-11-01T00:00:00.000Z' },
]
const SEEDED = JSON.stringify(loans)
const MOVE_TOAST = 'Moved your data to sturdier storage. Your old copy is kept.'

/** Puts data in the old keys before the app's first load only; a reload doesn't re-seed. */
async function seedOldStorage(page: Page) {
  await page.addInitScript((value) => {
    if (sessionStorage.getItem('e2e-seeded')) return
    sessionStorage.setItem('e2e-seeded', '1')
    localStorage.setItem('loan-tracker-loans', value)
    localStorage.setItem('loan-tracker-income', '30000')
  }, SEEDED)
}

/** Counts the rows in one table of Ollie's database, with the browser's own API. */
function countRows(page: Page, table: string) {
  return page.evaluate((name) => new Promise<number>((resolve, reject) => {
    const req = indexedDB.open('ollie')
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const count = req.result.transaction(name, 'readonly').objectStore(name).count()
      count.onsuccess = () => { resolve(count.result); req.result.close() }
      count.onerror = () => reject(count.error)
    }
  }), table)
}

test('a fresh visit lands on the database', async ({ page }) => {
  await page.goto('/#/')
  await expect(page.getByRole('navigation', { name: 'Main' }).locator('visible=true')).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('loan-tracker-storage'))).toBe('indexeddb')
  const names = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))
  expect(names).toContain('ollie')
})

test('existing data moves and stays visible', async ({ page }) => {
  await seedOldStorage(page)
  await page.goto('/#/')
  await expect(page.getByText('Test Phone').first()).toBeVisible()
  await expect(page.getByText('Test Laptop').first()).toBeVisible()
  await expect(page.getByText(MOVE_TOAST)).toBeVisible()
  expect(await countRows(page, 'loans')).toBe(2)
  expect(await page.evaluate(() => localStorage.getItem('loan-tracker-loans'))).toBe(SEEDED)
  expect(await page.evaluate(() => localStorage.getItem('loan-tracker-income'))).toBe('30000')
})

test('a payment marked after the move survives a reload', async ({ page }) => {
  await seedOldStorage(page)
  await page.goto('/#/loan/L1')
  await page.getByRole('button', { name: 'Mark as Paid' }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('1/6').first()).toBeVisible()
  await expect.poll(() => countRows(page, 'payments')).toBe(1)
  await page.reload()
  await expect(page.getByText('1/6').first()).toBeVisible()
  await expect(page.getByText(MOVE_TOAST)).toHaveCount(0)
})

test('Settings shows the Storage card', async ({ page }) => {
  await page.goto('/#/settings')
  const card = page.getByRole('region', { name: 'Storage' })
  await expect(card.getByText('This browser\'s database', { exact: false })).toBeVisible()
  await expect(card.getByText('Your data lives only on this device. It isn\'t synced anywhere, so keep a backup.')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Move back to simple storage' })).toBeVisible()
})
