// Lighthouse (mobile) on the preview build, using the local Chrome. Local only; not run in CI.
// Usage: npm run build && npm run lighthouse   -> prints a table and writes ../validation/site.json
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const web = resolve(here, '..')
const PORT = 4173
const BASE = `http://localhost:${PORT}/Mental_Health_Explorer/`
const PAGES = ['', 'explore/teen/mde_py']
const OUT = resolve(web, '../validation/site.json')

async function reachable(url) {
  try {
    return (await fetch(url)).ok
  } catch {
    return false
  }
}

async function startPreview() {
  if (await reachable(BASE)) return null
  const child = spawn('npm', ['run', 'preview', '--', '--port', String(PORT), '--strictPort'], { cwd: web, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    if (await reachable(BASE)) return child
    await new Promise((r) => setTimeout(r, 500))
  }
  child.kill()
  throw new Error('vite preview did not start')
}

function run(cmd, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], ...options })
    child.on('exit', (code) => (code === 0 ? resolvePromise() : reject(new Error(`${cmd} exited with ${code}`))))
  })
}

async function audit(url, file) {
  const args = [
    url,
    '--output=json',
    `--output-path=${file}`,
    '--only-categories=performance,accessibility',
    '--form-factor=mobile',
    '--quiet',
    '--chrome-flags=--headless=new --no-sandbox',
  ]
  await run(resolve(web, 'node_modules/.bin/lighthouse'), args, { cwd: web })
  const report = JSON.parse(readFileSync(file, 'utf8'))
  const score = (id) => Math.round(report.categories[id].score * 100)
  const metric = (id) => report.audits[id]?.numericValue ?? null
  return {
    url: report.finalDisplayedUrl ?? url,
    performance: score('performance'),
    accessibility: score('accessibility'),
    lcp_ms: Math.round(metric('largest-contentful-paint')),
    tbt_ms: Math.round(metric('total-blocking-time')),
    cls: Number(metric('cumulative-layout-shift').toFixed(3)),
    lighthouse: report.lighthouseVersion,
  }
}

const preview = await startPreview()
try {
  const dir = mkdtempSync(join(tmpdir(), 'lighthouse-'))
  const pages = []
  for (const page of PAGES) pages.push(await audit(`${BASE}${page}`, join(dir, `${page.replace(/\W+/g, '_') || 'home'}.json`)))
  const result = { generated: new Date().toISOString().slice(0, 10), form_factor: 'mobile', lighthouse: pages[0].lighthouse, pages: pages.map((p) => ({ ...p, lighthouse: undefined })) }
  writeFileSync(OUT, JSON.stringify(result, null, 1) + '\n')
  console.log('\n| Page | Performance | Accessibility | LCP | TBT | CLS |\n| --- | ---: | ---: | ---: | ---: | ---: |')
  for (const p of result.pages) console.log(`| ${p.url.replace(BASE, '/')} | ${p.performance} | ${p.accessibility} | ${(p.lcp_ms / 1000).toFixed(1)} s | ${p.tbt_ms} ms | ${p.cls} |`)
  console.log(`\nWrote ${OUT}`)
} finally {
  preview?.kill()
}
