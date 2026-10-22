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

/** Every element in main with its own text (svg text included) is at least 12 px, the type scale's minimum. */
async function expectMinimumTextSize(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('main *')]
      .filter((el) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()))
      .map((el) => ({ size: parseFloat(getComputedStyle(el).fontSize), text: `${el.tagName.toLowerCase()}: ${el.textContent?.trim().slice(0, 40)}` }))
      .filter((d) => d.size < 12)
      .map((d) => `${d.text} (${d.size}px)`),
  )
  expect(small).toEqual([])
}

/** Every visible link, button and summary in main is at least 24 × 24 px (WCAG 2.2, 2.5.8), except links set inline in running text. */
async function expectTargetSize(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('main a, main button, main summary')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') return false
        const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline' && !!el.parentElement?.closest('p, li, dd, aside')
        return !inline && (r.width < 24 || r.height < 24)
      })
      .map((el) => {
        const r = el.getBoundingClientRect()
        return `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`
      }),
  )
  expect(small).toEqual([])
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0)
}

/** Every visible select shows its whole choice: the selected option's text, measured in the select's own font, fits beside the arrow. */
async function expectSelectsFit(page: Page) {
  const clipped = await page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D
    return [...document.querySelectorAll('select')]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => {
        const style = getComputedStyle(el)
        ctx.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
        const text = el.selectedOptions[0]?.text ?? ''
        const room = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 20
        return { text, width: Math.ceil(ctx.measureText(text).width), room: Math.floor(room) }
      })
      .filter((d) => d.width > d.room)
      .map((d) => `${d.text}: ${d.width}px in ${d.room}px`)
  })
  expect(clipped).toEqual([])
}

/** Heights of the visible body rows in the group comparison. */
async function comparisonRowHeights(page: Page, selector = 'section[aria-labelledby="compare-groups"] tbody tr'): Promise<number[]> {
  return page.locator(selector).evaluateAll((rows) => rows.map((r) => r.getBoundingClientRect().height).filter((h) => h > 0))
}

test.beforeAll(() => mkdirSync(SCREENSHOT_DIR, { recursive: true }))

for (const route of ROUTES) {
  test(`${route.name}: loads, passes axe and fits the viewport`, async ({ page }, testInfo) => {
    await page.goto(route.path)
    await settled(page)
    await expectNoAxeViolations(page)
    await expectNoHorizontalScroll(page)
    await expectMinimumTextSize(page)
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
  await expect(page.getByTestId('overview-summary')).toContainText(/^Of these six measures, /)
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
  // Health insurance is past the first three groups, under "More groups".
  await page.getByText(/^More groups \(\d+\)$/).click()
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

test('Methods puts key terms and how to cite near the top, folds the long parts and stays short', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'desktop layout')
  await page.goto('methods')
  await settled(page)
  await expect(page.locator('#key-terms')).toHaveCount(1)
  await expect(page.locator('#how-to-cite')).toHaveCount(1)
  const top = await page.locator('#how-to-cite').evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
  expect(top).toBeLessThan(2500)
  expect(await page.evaluate(() => document.body.scrollHeight)).toBeLessThan(7000)
  const teens = page.locator('details[data-cohort="teen"]')
  await expect(teens.locator('tbody tr').first()).toBeHidden()
  await teens.locator('summary').click()
  await expect(teens.locator('tbody tr').first()).toBeVisible()
})

test('the explorer shows the number high on the page and a labelled chart over time', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'desktop layout')
  await page.goto('explore/teen/mde_py')
  await settled(page)
  const top = await page.getByTestId('estimate-value').evaluate((el) => el.getBoundingClientRect().top)
  expect(top).toBeLessThan(520)
  await expect(page.getByTestId('data-date')).toContainText('Data generated')
  const overTime = page.getByRole('region', { name: 'Over time' }).getByRole('img')
  await expect(overTime).toContainText('2021')
  await expect(overTime).toContainText('2024')
})

test('navigation keeps the measure', async ({ page }) => {
  await page.goto('explore/teen/suicide_plan')
  await settled(page)
  // On phones the menu is closed, so the links are hidden but present.
  const nav = page.getByRole('navigation', { name: 'Main', includeHidden: true })
  expect(await nav.getByRole('link', { name: 'Trends', includeHidden: true }).getAttribute('href')).toMatch(/\/trends\/teen\/suicide_plan$/)
  await page.goto('explore/teen/mde_py?group=race_ethnicity&level=white')
  await settled(page)
  const cross = page.getByRole('link', { name: 'See how this changed over time' })
  expect(await cross.getAttribute('href')).not.toContain('split')
})

test('a URL notice comes before the page title', async ({ page }) => {
  await page.goto('explore/teen/nope')
  await settled(page)
  const notice = page.getByTestId('notices')
  await expect(notice).toContainText("We couldn't find that measure")
  const before = await notice.evaluate((el) => !!(el.compareDocumentPosition(document.querySelector('h1') as Node) & Node.DOCUMENT_POSITION_FOLLOWING))
  expect(before).toBe(true)
})

test('on phones the age-group toggle stays on one line', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'phone labels')
  await page.goto('')
  await settled(page)
  const toggle = page.getByRole('navigation', { name: 'Cohort' }).first()
  expect(await toggle.evaluate((el) => (el as HTMLElement).innerText)).toContain('Teens 12–17')
  const height = await toggle.evaluate((el) => el.getBoundingClientRect().height)
  expect(height).toBeLessThan(48)
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

test('the group comparison is compact: one heading per table and short rows', async ({ page }, testInfo) => {
  await page.goto('explore/teen/mde_py')
  await settled(page)
  await expect(page.getByRole('heading', { level: 3, name: 'By sex' })).toBeVisible()
  if (!testInfo.project.name.startsWith('mobile')) {
    const heights = await comparisonRowHeights(page)
    expect(heights.length).toBeGreaterThan(0)
    expect(Math.max(...heights)).toBeLessThanOrEqual(72)
  }
})

test('on phones the group tables put the bar under the label and fit', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'phone layout')
  await page.goto('explore/teen/mde_py')
  await settled(page)
  const share = await page.locator('[data-group-label]').first().evaluate((el) => el.getBoundingClientRect().width / (el.closest('table') as HTMLElement).getBoundingClientRect().width)
  expect(share).toBeGreaterThanOrEqual(0.45)
  const heights = await comparisonRowHeights(page, 'table[data-group="race_ethnicity"] tr')
  expect(heights.length).toBeGreaterThan(0)
  expect(Math.max(...heights)).toBeLessThanOrEqual(96)
  await expectNoHorizontalScroll(page)
})

test('the filters show the whole choice on wide screens', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'desktop layout')
  for (const path of ['explore/teen/mde_py', 'explore/teen/suicide_plan?group=race_ethnicity&level=aian', 'trends/teen/mde_py?split=family_income']) {
    await page.goto(path)
    await settled(page)
    await expectSelectsFit(page)
  }
  const top = await page.locator('figure svg[role="img"]').first().evaluate((el) => el.getBoundingClientRect().top)
  expect(top).toBeLessThan(720)
})

test('the "Not reported" note stays on a phone screen', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'phone layout')
  await page.goto('explore/teen/suicide_plan?group=race_ethnicity&level=nhopi')
  await settled(page)
  // The card shows no interval for a suppressed estimate, so the dash is the one in the selected group's row, at the right of the screen.
  await page.locator('[data-level="nhopi"] [data-suppressed="true"]').first().tap()
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toBeVisible()
  const box = await tooltip.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { left: r.left, right: r.right, width: window.innerWidth }
  })
  expect(box.left).toBeGreaterThanOrEqual(0)
  expect(box.right).toBeLessThanOrEqual(box.width)
  await expectNoHorizontalScroll(page)
})

test('a chart downloaded on a phone is drawn at desktop width with end labels', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'), 'phone download')
  await page.goto('trends/teen/mde_py?split=family_income')
  await settled(page)
  await page.getByText('More formats').click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download chart (SVG)' }).click()])
  const markup = readFileSync(await download.path(), 'utf8')
  expect(Number(/^<svg[^>]*\swidth="(\d+)"/.exec(markup)?.[1])).toBeGreaterThanOrEqual(640)
  const texts = [...markup.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1])
  expect(texts.join(' ')).toMatch(/\$75,000 or more \d/)
})

test('a wide interval reads with one decimal at both ends', async ({ page }) => {
  await page.goto('explore/teen/suicide_plan?group=race_ethnicity&level=aian')
  await settled(page)
  await expect(page.getByTestId('estimate-value')).toHaveText('2.2%–14.6%')
  await expect(page.getByRole('article', { name: 'Estimate' })).toContainText('Between 2.2% and 14.6%')
})

for (const route of ROUTES) {
  test(`${route.name}: every target is at least 24 px`, async ({ page }) => {
    await page.goto(route.path)
    await settled(page)
    await expectTargetSize(page)
  })
}

test('the explorer puts Over time beside the answer', async ({ page }, testInfo) => {
  await page.goto('explore/teen/mde_py')
  await settled(page)
  const top = await page.locator('#over-time').evaluate((el) => el.getBoundingClientRect().top)
  expect(top).toBeLessThan(testInfo.project.name.startsWith('mobile') ? 1400 : 700)
})

test('Methods sets "In short" apart with a background', async ({ page }) => {
  await page.goto('methods')
  await settled(page)
  const background = await page.getByRole('note', { name: 'In short' }).evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(background).not.toBe('rgba(0, 0, 0, 0)')
  expect(background).not.toBe('transparent')
})
