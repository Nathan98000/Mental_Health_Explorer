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
  await expect(tile.locator('[data-change="fell"]')).toContainText('Down from')
  await expect(page).toHaveTitle('Mental Health Explorer')
})

test('the overview puts a number on the first screen and has no decorative circles', async ({ page }, testInfo) => {
  await page.goto('')
  await settled(page)
  if (testInfo.project.name.startsWith('mobile')) {
    const top = await page.getByTestId('tile-value').first().evaluate((el) => el.getBoundingClientRect().top)
    expect(top).toBeLessThan(page.viewportSize()!.height)
  }
  await page.setViewportSize({ width: 768, height: 1024 })
  await expect(page.getByTestId('hero').locator('svg circle')).toHaveCount(0)
})

test('the explorer shows the value from the committed shard and survives a reload', async ({ page }) => {
  const shard = JSON.parse(readFileSync(resolve('../data/estimates/teen/mde_py.json'), 'utf8')) as {
    cells: { year_set: string[]; group: (string | null)[]; level: (string | null)[]; group2: (string | null)[]; p: (number | null)[] }
  }
  const c = shard.cells
  const i = c.year_set.findIndex((y, k) => y === '2024' && c.group[k] === 'sex' && c.level[k] === 'female' && c.group2[k] === null)
  expect(i).toBeGreaterThanOrEqual(0)
  // The site's one rounding rule (lib/format.ts formatShare): whole percents from 9.95% up, one decimal below.
  const v = (c.p[i] as number) * 100
  const expected = `${v.toFixed(v >= 9.95 ? 0 : 1)}%`

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

test('trends answer first: the headline, then the chart on the first screen, then one Change column', async ({ page }, testInfo) => {
  await page.goto('trends/teen/suicide_thoughts?split=sex')
  await settled(page)
  await expect(page.getByTestId('trend-headline')).toContainText('fell in every group shown')
  const top = await page.locator('figure').first().evaluate((el) => el.getBoundingClientRect().top)
  expect(top).toBeLessThan(page.viewportSize()!.height)
  await expect(page.getByRole('columnheader', { name: 'Statistically significant?' })).toHaveCount(0)
  await expect(page.getByRole('row', { name: /^Female/ })).toContainText('Fell')
  if (testInfo.project.name.startsWith('mobile')) {
    const region = page.getByRole('region', { name: /compared with .*, as a table$/ })
    const fits = await region.evaluate((el) => el.scrollWidth <= el.clientWidth)
    expect(fits).toBe(true)
  }
})

test('a trend with no significant change says so and draws every line solid', async ({ page }) => {
  await page.goto('trends/young_adult/ami_py')
  await settled(page)
  await expect(page.getByTestId('trend-headline')).toContainText('was about the same')
  await expect(page.locator('figure svg [stroke-dasharray="6 4"]')).toHaveCount(0)
})

test('a suppressed estimate says "Not reported" and why, and only offers what can be shown', async ({ page }, testInfo) => {
  await page.goto('explore/teen/suicide_plan?group=race_ethnicity&level=nhopi')
  await settled(page)
  await expect(page.getByTestId('estimate-value')).toHaveText('Not reported')
  await expect(page.getByText('Everyone surveyed in this group gave the same answer').first()).toBeVisible()
  // The card's next steps: the pooled estimate is suppressed too, so only "Try everyone".
  const card = page.getByRole('article', { name: 'Estimate' })
  await expect(card.getByRole('link', { name: 'Try all years combined' })).toHaveCount(0)
  await expect(card.getByRole('link', { name: 'Try everyone' })).toBeVisible()
  if (testInfo.project.name.startsWith('mobile')) {
    await page.locator('[data-suppressed="true"]').first().tap()
    await expect(page.getByRole('tooltip')).toBeVisible()
  }
})

test('the estimate card says who the number is out of', async ({ page }) => {
  await page.goto('explore/teen/mde_any_treatment')
  await settled(page)
  await expect(page.getByTestId('estimate-of')).toContainText('who had a major depressive episode in the past year')
})

test('the group comparison names significant differences', async ({ page }) => {
  await page.goto('explore/teen/mde_any_treatment?year=all')
  await settled(page)
  await expect(page.getByRole('row', { name: /^No health insurance/ })).toContainText('Lower')
})

test('on phones the group comparison is readable and fits, and the filters are wide', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'phone layout')
  await page.goto('explore/teen/mde_py?group=sex&level=female')
  await settled(page)
  const size = await page.locator('[data-group-label]').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(size).toBeGreaterThanOrEqual(14)
  await expectNoHorizontalScroll(page)
  await page.goto('explore/teen/mde_py')
  await settled(page)
  await openFilters(page)
  const width = await page.getByLabel('Population').evaluate((el) => el.getBoundingClientRect().width)
  expect(width).toBeGreaterThanOrEqual(300)
})

test('a downloaded chart carries its notes, the 988 note and the page address', async ({ page }) => {
  await page.goto('trends/young_adult/suicide_thoughts')
  await settled(page)
  await page.getByText('More formats').click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download chart (SVG)' }).click()])
  const markup = readFileSync(await download.path(), 'utf8')
  const texts = [...markup.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1])
  expect(texts.join(' ')).toContain('988lifeline.org')
  expect(texts.join(' ')).toContain('confidence interval')
  expect(texts.join('')).toContain('/trends/young_adult/suicide_thoughts')
})

test('Methods puts key terms and how to cite near the top', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'desktop layout')
  await page.goto('methods')
  await settled(page)
  await expect(page.locator('#key-terms')).toHaveCount(1)
  const top = await page.locator('#how-to-cite').evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
  expect(top).toBeLessThan(2500)
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
