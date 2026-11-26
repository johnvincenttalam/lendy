import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024

/** The visible Add button: the round [+] on phones, the sidebar button on desktop. */
const addButton = (page: Page) => page.getByRole('button', { name: 'Add', exact: true }).locator('visible=true').first()

test('shows the right navigation for the screen size', async ({ page }) => {
  await page.goto('/#/')
  const nav = page.getByRole('navigation', { name: 'Main' }).locator('visible=true')
  await expect(nav).toHaveCount(1)
  for (const label of ['Home', 'Planner', 'Ollie']) {
    await expect(nav.getByRole('button', { name: label, exact: true })).toBeVisible()
  }
  if (isPhone(page)) {
    await expect(nav.getByRole('button', { name: 'More', exact: true })).toBeVisible()
    await expect(page.locator('aside')).toBeHidden()
  } else {
    await expect(page.locator('aside')).toBeVisible()
    await expect(nav.getByRole('button', { name: 'What-if', exact: true })).toBeVisible()
  }
  await expect(addButton(page)).toBeVisible()
})

test('adds a loan from the Add menu; it shows on Home and in the Planner', async ({ page }) => {
  await page.goto('/#/')
  await addButton(page).click()
  const menu = page.getByRole('dialog', { name: 'Add' })
  await expect(menu).toBeVisible()
  await menu.getByRole('button', { name: /Loan/ }).click()

  await page.getByLabel('Loan Name').fill('Test Phone')
  await page.getByLabel('Amount (₱)').fill('6000')
  await page.getByLabel('Interest (%/mo)').fill('0')
  await page.getByLabel('Tenure (months)').fill('6')
  await page.getByRole('button', { name: 'Add Loan' }).click()

  await expect(page.getByRole('region', { name: 'Your loans' }).getByText('Test Phone')).toBeVisible()

  // Starting today, its first payment is due today.
  await page.goto('/#/planner')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Test Phone/ })).toBeVisible()
})

test('[+] on the Bills page opens the bill form directly', async ({ page }) => {
  await page.goto('/#/bills')
  await addButton(page).click()
  await expect(page.getByRole('heading', { name: 'New Bill' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Add' })).toHaveCount(0)
})

test('Escape closes the Add menu', async ({ page }) => {
  await page.goto('/#/')
  await addButton(page).click()
  await expect(page.getByRole('dialog', { name: 'Add' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Add' })).toHaveCount(0)
})

test('Customize Home hides a section, remembers it, and resets', async ({ page }) => {
  // A savings goal gives Home a Financial health section to hide.
  await page.goto('/#/savings')
  await addButton(page).click()
  await page.getByRole('textbox').first().fill('Test Trip')
  await page.getByRole('spinbutton').first().fill('10000')
  await page.getByRole('button', { name: 'Add Goal' }).click()

  await page.goto('/#/')
  await expect(page.getByText('Financial Health', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Customize Home' }).click()
  await page.getByRole('switch', { name: 'Show Financial health' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText('Financial Health', { exact: true })).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('region', { name: 'Savings' })).toBeVisible()
  await expect(page.getByText('Financial Health', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Customize Home' }).click()
  await page.getByRole('button', { name: 'Reset to default' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText('Financial Health', { exact: true })).toBeVisible()
})

test('old links land in the right place', async ({ page }) => {
  await page.goto('/#/calendar')
  await expect(page).toHaveURL(/#\/planner\?view=calendar/)
  await expect(page.getByRole('tab', { name: 'Calendar' })).toHaveAttribute('aria-selected', 'true')

  await page.goto('/#/planner')
  await expect(page.getByRole('tab', { name: 'Agenda' })).toHaveAttribute('aria-selected', 'true')

  await page.goto('/#/what-if')
  await expect(page.getByRole('heading', { level: 1, name: 'What-if' })).toBeVisible()
})
