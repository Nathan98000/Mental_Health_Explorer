import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Screenshots go outside the repo when E2E_SCREENSHOT_DIR is set (the phase 3 review folder).
const SCREENSHOT_DIR = process.env.E2E_SCREENSHOT_DIR ?? resolve('test-results/screenshots')

const ROUTES = [
  { name: 'overview', path: '' },
  { name: 'overview-young-adult', path: '?cohort=young_adult' },
  { name: 'explore-teen-mde-female', path: 'explore/teen/mde_py?year=2024&group=sex&level=female' },
  { name: 'explore-young-adult-spd', path: 'explore/young_adult/spd_py' },
  { name: 'trends-teen-suicide-by-sex', path: 'trends/teen/suicide_thoughts?split=sex' },
  { name: 'trends-teen-vaping', path: 'trends/teen/nicotine_vape_py' },
  { name: 'methods', path: 'methods' },
]

/** On phones the filters sit in a collapsed <details>; open it so the controls can be used. */
async function openFilters(page: Page) {
  const summary = page.getByTestId('filters-summary')
  if (await summary.isVisible()) await summary.click()
}

/** Wait until every loading message has gone and the page has content. */
async function settled(page: Page) {
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: /loading/i })).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.waitForLoadState('networkidle')
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join('; ')})`)).toEqual([])
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0)
}

test.beforeAll(() => mkdirSync(SCREENSHOT_DIR, { recursive: true }))

for (const route of ROUTES) {
  test(`${route.name}: loads, passes axe and fits the viewport`, async ({ page }, testInfo) => {
    await page.goto(route.path)
    await settled(page)
    await expectNoAxeViolations(page)
    await expectNoHorizontalScroll(page)
    if (testInfo.project.name.startsWith('mobile')) {
      await page.setViewportSize({ width: 360, height: 780 })
      await expectNoHorizontalScroll(page)
      await page.setViewportSize({ width: 390, height: 844 })
    }
    await page.screenshot({ path: resolve(SCREENSHOT_DIR, `${route.name}--${testInfo.project.name}.png`), fullPage: true })
  })
}

test('the overview shows the teen depression headline with a "fell" marker', async ({ page }) => {
  await page.goto('')
  await settled(page)
  const tile = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Major depressive episode in the past year' }) })
  await expect(tile).toContainText('15%')
  await expect(tile.locator('[data-change="fell"]')).toContainText('Fell since 2021')
  await expect(page).toHaveTitle('Mental Health Explorer')
})

test('the explorer shows the value from the committed shard and survives a reload', async ({ page }) => {
  const shard = JSON.parse(readFileSync(resolve('../data/estimates/teen/mde_py.json'), 'utf8')) as {
    cells: { year_set: string[]; group: (string | null)[]; level: (string | null)[]; group2: (string | null)[]; p: (number | null)[] }
  }
  const c = shard.cells
  const i = c.year_set.findIndex((y, k) => y === '2024' && c.group[k] === 'sex' && c.level[k] === 'female' && c.group2[k] === null)
  expect(i).toBeGreaterThanOrEqual(0)
  const expected = `${((c.p[i] as number) * 100).toFixed(0)}%`

  await page.goto('explore/teen/mde_py?year=2024&group=sex&level=female')
  await settled(page)
  await expect(page.getByTestId('estimate-value')).toHaveText(expected)
  await expect(page.getByLabel('Population')).toHaveValue('sex:female')
  await expect(page).toHaveTitle(/Major depressive episode in the past year/)

  await page.reload()
  await settled(page)
  await expect(page.getByTestId('estimate-value')).toHaveText(expected)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Major depressive episode in the past year')
})

test('picking a population updates the URL and the takeaway', async ({ page }) => {
  await page.goto('explore/teen/mde_py')
  await settled(page)
  await openFilters(page)
  await page.getByLabel('Population').selectOption('sex:female')
  await expect(page).toHaveURL(/group=sex&level=female/)
  await settled(page)
  await expect(page.getByRole('article', { name: 'Estimate' })).toContainText('female teens ages 12–17')
})

test('an unknown indicator redirects to the default one', async ({ page }) => {
  await page.goto('explore/teen/not_a_measure')
  await expect(page).toHaveURL(/\/explore\/teen\/mde_py$/)
  await settled(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Major depressive episode in the past year')
})

test('the vaping trend explains the 2021 gap and offers a table view', async ({ page }) => {
  await page.goto('trends/teen/nicotine_vape_py')
  await settled(page)
  await expect(page.getByText('Not available in 2021.')).toBeVisible()
  await expect(page.getByRole('img', { name: /Nicotine vaping in the past year/ })).toBeVisible()
  await page.getByRole('button', { name: 'Show table' }).click()
  await expect(page.getByRole('row', { name: /^2021/ })).toContainText('Not available')
})

test('the suicide trend carries the 988 note above the chart', async ({ page }) => {
  await page.goto('trends/teen/suicide_thoughts?split=sex')
  await settled(page)
  await expect(page.getByRole('complementary', { name: 'Support' })).toContainText('988')
  await expect(page.getByRole('listitem').filter({ hasText: 'Beginning in 2022' })).toBeVisible()
})

test('the mobile menu is a disclosure', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'desktop shows the nav inline')
  await page.goto('')
  const button = page.getByRole('button', { name: 'Menu' })
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden()
  await button.click()
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Methods' }).click()
  await expect(page).toHaveURL(/\/methods$/)
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden()
})
