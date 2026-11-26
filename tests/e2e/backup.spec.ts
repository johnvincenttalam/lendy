import { test, expect } from '@playwright/test'
import type { Browser, Page, TestInfo } from '@playwright/test'

// Synthetic records only. Each test gets a fresh browser context.

/** The visible Add button: the round [+] on phones, the sidebar button on desktop. */
const addButton = (page: Page) => page.getByRole('button', { name: 'Add', exact: true }).locator('visible=true').first()

async function addLoan(page: Page, name: string) {
  await page.goto('/#/')
  await addButton(page).click()
  await page.getByRole('dialog', { name: 'Add' }).getByRole('button', { name: /Loan/ }).click()
  await page.getByLabel('Loan Name').fill(name)
  await page.getByLabel('Amount (₱)').fill('6000')
  await page.getByLabel('Interest (%/mo)').fill('0')
  await page.getByLabel('Tenure (months)').fill('6')
  await page.getByRole('button', { name: 'Add Loan' }).click()
  await expect(page.getByRole('region', { name: 'Your loans' }).getByText(name)).toBeVisible()
}

/** Saves a backup from Settings and returns the file's path. */
async function exportBackup(page: Page, testInfo: TestInfo): Promise<string> {
  await page.goto('/#/settings')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Backup', exact: true }).click()
  const path = testInfo.outputPath('backup.json')
  await (await download).saveAs(path)
  return path
}

async function openRestore(page: Page, path: string) {
  await page.goto('/#/settings')
  await page.locator('input[type="file"][accept=".json"]').setInputFiles(path)
  const preview = page.getByRole('dialog', { name: 'Restore backup' })
  await expect(preview).toBeVisible()
  return preview
}

// Each test drives one or two browsers through adding, exporting and restoring.
test.describe.configure({ timeout: 90_000 })

test.beforeEach(async ({ page }) => {
  // Use the download path: headless browsers can't share files.
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true })
  })
})

/** Another phone: a fresh browser with its own storage. */
async function otherPhone(browser: Browser, testInfo: TestInfo): Promise<Page> {
  const project = testInfo.project.use
  const context = await browser.newContext({ viewport: project.viewport, isMobile: project.isMobile, hasTouch: project.hasTouch, baseURL: project.baseURL, timezoneId: project.timezoneId })
  await context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true })
  })
  return context.newPage()
}

test("restoring a file shows a preview, and merge keeps what's here",async ({ page, browser }, testInfo) => {
  await addLoan(page, 'Test Phone')
  const file = await exportBackup(page, testInfo)

  const other = await otherPhone(browser, testInfo)
  await addLoan(other, 'Test Laptop')
  const preview = await openRestore(other, file)
  await expect(preview.getByText(/Made by Ollie/)).toBeVisible()
  await preview.getByRole('button', { name: 'Merge', exact: true }).click()

  await other.goto('/#/')
  const loans = other.getByRole('region', { name: 'Your loans' })
  await expect(loans.getByText('Test Phone')).toBeVisible()
  await expect(loans.getByText('Test Laptop')).toBeVisible()
  await other.context().close()
})

test('replace makes this phone match the file', async ({ page, browser }, testInfo) => {
  await addLoan(page, 'Test Phone')
  const file = await exportBackup(page, testInfo)

  const other = await otherPhone(browser, testInfo)
  await addLoan(other, 'Test Laptop')
  const preview = await openRestore(other, file)
  await preview.getByRole('radio', { name: /Replace/ }).check()
  await expect(preview.getByText('(removes 1 loan)', { exact: false })).toBeVisible()
  await preview.getByRole('button', { name: 'Replace', exact: true }).click()

  await other.goto('/#/')
  const loans = other.getByRole('region', { name: 'Your loans' })
  await expect(loans.getByText('Test Phone')).toBeVisible()
  await expect(loans.getByText('Test Laptop')).toHaveCount(0)
  await other.context().close()
})

test('a file this phone just made has nothing new', async ({ page }, testInfo) => {
  await addLoan(page, 'Test Phone')
  const file = await exportBackup(page, testInfo)
  const preview = await openRestore(page, file)
  await expect(preview.getByText('Nothing new in this file.')).toBeVisible()
  await expect(preview.getByRole('button', { name: 'Merge', exact: true })).toHaveCount(0)
  await preview.getByRole('button', { name: 'Close', exact: true }).last().click()
  await expect(preview).toHaveCount(0)
})
