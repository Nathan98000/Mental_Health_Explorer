/**
 * Chart exports: CSV of the rows behind a view, SVG and PNG of a chart framed with a title,
 * subtitle, legend and source line (every var(--token) resolved to a color first), and a citation.
 */
import { SITE_NAME } from './site'

export type CsvRow = {
  cohort: string
  indicator: string
  yearSet: string
  weight: string
  population: string
  p: number | null
  lo: number | null
  hi: number | null
  n: number
  suppressed: boolean
}

export const CSV_COLUMNS = ['cohort', 'indicator', 'year_set', 'weight', 'population', 'p', 'lo', 'hi', 'n', 'suppressed'] as const

function csvField(value: string | number | boolean | null): string {
  if (value === null) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: CsvRow[]): string {
  const lines = rows.map((r) => [r.cohort, r.indicator, r.yearSet, r.weight, r.population, r.p, r.lo, r.hi, r.n, r.suppressed].map(csvField).join(','))
  return [CSV_COLUMNS.join(','), ...lines].join('\n') + '\n'
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(filename: string, text: string, type: string): void {
  downloadBlob(filename, new Blob([text], { type }))
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const EXPORT_FONT = 'Inter Variable, Inter, system-ui, sans-serif'
/** The source line under every exported image. */
export const EXPORT_SOURCE = `Source: SAMHSA NSDUH 2021–2024 public use file · ${SITE_NAME}`

/** Light-mode values of the tokens SVGs use, for when a computed style is unavailable (tests, detached documents). */
export const TOKEN_FALLBACKS: Record<string, string> = {
  '--page': '#fff8ee',
  '--surface': '#fffdf8',
  '--surface-tint': '#ffefe0',
  '--surface-cool': '#eef0ff',
  '--ink': '#1e2240',
  '--ink-2': '#4b4f6b',
  '--muted': '#6b6f86',
  '--line': '#ede6da',
  '--grid': '#ede6da',
  '--primary': '#c2410c',
  '--primary-ink': '#b83d0b',
  '--accent': '#0e6e6d',
  '--sun': '#ffc857',
  '--series-1': '#2a78d6',
  '--series-2': '#eb6834',
  '--series-3': '#15915f',
  '--series-4': '#b57a00',
  '--series-5': '#d9598c',
}

export type CssVarLookup = (name: string) => string | undefined

/** Look a token up on the document root, falling back to its light-mode value. */
export function rootCssVarLookup(): CssVarLookup {
  const css = typeof document !== 'undefined' && typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement) : null
  return (name) => css?.getPropertyValue(name).trim() || TOKEN_FALLBACKS[name]
}

const CSS_VAR = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g

/** Replace every var(--token[, fallback]) with its value: SVG attributes only carry var() while the page's stylesheet is around. */
export function resolveCssVars(text: string, lookup: CssVarLookup): string {
  let out = text
  for (let pass = 0; pass < 4 && out.includes('var('); pass++) {
    out = out.replace(CSS_VAR, (_, name: string, fallback?: string) => lookup(name) ?? fallback?.trim() ?? '#000000')
  }
  return out
}

export type ExportLegendItem = { label: string; color: string; dashed?: boolean }

export type ExportFrame = {
  title: string
  /** Population and years, e.g. "teens ages 12–17 · 2021–2024". */
  subtitle?: string
  /** Given when there are several series. */
  legend?: ExportLegendItem[]
  source?: string
  /** Text colors; the light theme by default. */
  ink?: string
  muted?: string
}

function svgEl(name: string, attrs: Record<string, string | number>, text?: string): SVGElement {
  const node = document.createElementNS(SVG_NS, name)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value))
  if (text !== undefined) node.textContent = text
  return node
}

function chartSize(svg: SVGSVGElement): { width: number; height: number } {
  return { width: Number(svg.getAttribute('width')) || svg.clientWidth || 640, height: Number(svg.getAttribute('height')) || svg.clientHeight || 300 }
}

const PAD = 20
const CHAR_WIDTH = 6.5

/** A stand-alone copy of the chart (var() resolved, explicit size), framed with a title, subtitle, legend and source line. */
export function framedSvg(svg: SVGSVGElement, background: string, frame?: ExportFrame, lookup: CssVarLookup = rootCssVarLookup()): { markup: string; width: number; height: number } {
  const { width, height } = chartSize(svg)
  const chart = svg.cloneNode(true) as SVGSVGElement
  for (const node of [chart, ...chart.querySelectorAll('*')]) {
    for (const attr of [...node.attributes]) if (attr.value.includes('var(')) node.setAttribute(attr.name, resolveCssVars(attr.value, lookup))
  }
  chart.removeAttribute('class')
  chart.setAttribute('width', String(width))
  chart.setAttribute('height', String(height))
  chart.setAttribute('style', `background:${background};${resolveCssVars(svg.getAttribute('style') ?? '', lookup)}`)

  const root = svgEl('svg', { xmlns: SVG_NS, 'xmlns:xlink': 'http://www.w3.org/1999/xlink', width, style: `background:${background};font-family:${EXPORT_FONT}` }) as SVGSVGElement
  const backdrop = svgEl('rect', { width: '100%', height: '100%', fill: background })
  root.append(backdrop)
  let chartTop = 0
  let total = height
  if (frame) {
    const ink = frame.ink ?? TOKEN_FALLBACKS['--ink']
    const muted = frame.muted ?? TOKEN_FALLBACKS['--muted']
    let y = PAD + 18
    root.append(svgEl('text', { x: PAD, y, fill: ink, 'font-size': 18, 'font-weight': 700, 'data-export-title': '' }, frame.title))
    if (frame.subtitle) {
      y += 20
      root.append(svgEl('text', { x: PAD, y, fill: muted, 'font-size': 13, 'data-export-subtitle': '' }, frame.subtitle))
    }
    if (frame.legend?.length) {
      y += 24
      let x = PAD
      for (const item of frame.legend) {
        const itemWidth = 24 + item.label.length * CHAR_WIDTH + 18
        if (x > PAD && x + itemWidth > width - PAD) {
          x = PAD
          y += 18
        }
        const swatch = svgEl('line', { x1: x, y1: y - 4, x2: x + 18, y2: y - 4, stroke: item.color, 'stroke-width': 2.5 })
        if (item.dashed) swatch.setAttribute('stroke-dasharray', '5 4')
        root.append(swatch)
        root.append(svgEl('text', { x: x + 24, y, fill: ink, 'font-size': 12, 'data-export-legend': '' }, item.label))
        x += itemWidth
      }
    }
    chartTop = y + 12
    chart.setAttribute('x', '0')
    chart.setAttribute('y', String(chartTop))
    total = chartTop + height + 22 + PAD
    root.append(chart)
    root.append(svgEl('text', { x: PAD, y: chartTop + height + 22, fill: muted, 'font-size': 11, 'data-export-source': '' }, frame.source ?? EXPORT_SOURCE))
  } else {
    root.append(chart)
  }
  root.setAttribute('height', String(total))
  root.setAttribute('viewBox', `0 0 ${width} ${total}`)
  return { markup: new XMLSerializer().serializeToString(root), width, height: total }
}

/** Stand-alone SVG markup for a chart: namespaces, an explicit size, an opaque background and, with a frame, the title, legend and source line. */
export function serializeSvg(svg: SVGSVGElement, background: string, frame?: ExportFrame, lookup?: CssVarLookup): string {
  return framedSvg(svg, background, frame, lookup).markup
}

export function downloadSvg(svg: SVGSVGElement, filename: string, background: string, frame: ExportFrame): void {
  downloadText(filename, serializeSvg(svg, background, frame), 'image/svg+xml')
}

export function downloadPng(svg: SVGSVGElement, filename: string, background: string, frame: ExportFrame, scale = 2): Promise<void> {
  return new Promise((resolve, reject) => {
    const { markup, width, height } = framedSvg(svg, background, frame)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width * scale
      canvas.height = height * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas is not available'))
      ctx.scale(scale, scale)
      ctx.drawImage(image, 0, 0, width, height)
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Could not render the PNG'))
        downloadBlob(filename, blob)
        resolve()
      }, 'image/png')
    }
    image.onerror = () => reject(new Error('Could not render the chart'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  })
}

/** A citation for a chart or page, with the data source and access date. */
export function citation({ title, url, accessed = new Date() }: { title: string; url: string; accessed?: Date }): string {
  const date = accessed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return `${SITE_NAME}. “${title}.” Estimates computed from SAMHSA, National Survey on Drug Use and Health 2021–2024 public use file. ${url}. Accessed ${date}.`
}

export function safeFilename(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chart'
}
