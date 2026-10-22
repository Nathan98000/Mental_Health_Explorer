// Writes a static copy of the app shell for every deep link, so GitHub Pages answers them with
// 200 (not the 404.html fallback) and each carries its own <title>, description and Open Graph
// tags. Runs after `vite build`; reads the committed catalog (../../data/catalog.json).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dist = resolve(here, '../dist')
const catalog = JSON.parse(readFileSync(resolve(here, '../../data/catalog.json'), 'utf8'))
const shell = readFileSync(join(dist, 'index.html'), 'utf8')

const SITE_NAME = 'Mental Health Explorer'
const SITE_URL = 'https://nathan98000.github.io/Mental_Health_Explorer'
const SITE_DESCRIPTION = 'Explore national survey data on depression, suicidal thoughts, substance use and getting help among U.S. teens and young adults.'

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const clip = (text, max = 160) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`)

if (!/<title>[^<]*<\/title>/.test(shell) || !/<meta name="description" content="[^"]*"\s*\/?>/.test(shell)) {
  throw new Error('prerender-routes: dist/index.html has no <title> or description to replace')
}

/** Write dist/<path>/index.html: the shell with this route's title, description and Open Graph tags. */
function page(path, title, description) {
  const fullTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME
  const url = `${SITE_URL}${path}`
  const meta = [
    ['og:title', fullTitle],
    ['og:description', description],
    ['og:type', 'website'],
    ['og:url', url],
    ['og:site_name', SITE_NAME],
  ]
    .map(([property, content]) => `    <meta property="${property}" content="${escapeHtml(content)}" />`)
    .join('\n')
  const html = shell
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(fullTitle)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace('</head>', `${meta}\n    <link rel="canonical" href="${url}" />\n  </head>`)
  const dir = join(dist, ...path.split('/').filter(Boolean))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), html)
}

const cohorts = Object.fromEntries(catalog.cohorts.map((c) => [c.id, c]))
let count = 0
page('/explore/', 'Explore', SITE_DESCRIPTION)
page('/trends/', 'Trends', 'How depression, suicidal thoughts, substance use and getting help changed among U.S. teens and young adults from 2021 to 2024.')
page('/methods/', 'Methods and data dictionary', 'Where the numbers come from, how they are computed, how sure we can be, and what every measure means.')
count += 3
for (const indicator of catalog.indicators) {
  const cohort = cohorts[indicator.cohort]
  const years = [...indicator.years].sort((a, b) => a - b)
  const span = years.length > 1 ? `${years[0]} to ${years[years.length - 1]}` : String(years[0])
  page(`/explore/${indicator.cohort}/${indicator.id}`, `${indicator.label} · ${cohort.label}`, clip(`${cohort.label} ages ${cohort.ages}: ${indicator.definition}`))
  page(`/trends/${indicator.cohort}/${indicator.id}`, `Trends: ${indicator.label} · ${cohort.label}`, clip(`How the share of U.S. ${cohort.phrase} who ${indicator.phrase} changed from ${span}, with confidence intervals and year-to-year comparisons.`))
  count += 2
}
console.log(`prerender-routes: wrote ${count} pages under ${dist}`)
