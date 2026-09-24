/** Chart exports: CSV of the rows behind a view, SVG and PNG of the chart, and a citation. */
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

/** Stand-alone SVG markup for a chart: namespaces, an explicit size and an opaque background. */
export function serializeSvg(svg: SVGSVGElement, background: string): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const width = svg.getAttribute('width') ?? String(svg.clientWidth || 640)
  const height = svg.getAttribute('height') ?? String(svg.clientHeight || 300)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  clone.setAttribute('width', width)
  clone.setAttribute('height', height)
  clone.setAttribute('style', `background:${background};${svg.getAttribute('style') ?? ''}`)
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('width', '100%')
  rect.setAttribute('height', '100%')
  rect.setAttribute('fill', background)
  clone.insertBefore(rect, clone.firstChild)
  return new XMLSerializer().serializeToString(clone)
}

export function downloadSvg(svg: SVGSVGElement, filename: string, background: string): void {
  downloadText(filename, serializeSvg(svg, background), 'image/svg+xml')
}

export function downloadPng(svg: SVGSVGElement, filename: string, background: string, scale = 2): Promise<void> {
  return new Promise((resolve, reject) => {
    const markup = serializeSvg(svg, background)
    const width = Number(svg.getAttribute('width') ?? svg.clientWidth ?? 640)
    const height = Number(svg.getAttribute('height') ?? svg.clientHeight ?? 300)
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
