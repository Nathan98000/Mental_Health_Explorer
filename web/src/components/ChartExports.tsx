import { useEffect, useState } from 'react'
import { downloadPng, downloadSvg, downloadText, type ExportFrame } from '../lib/exports'
import { useChartTheme } from '../lib/theme'

type Props = {
  /** The chart's SVG element, when rendered; without it there is no image to download and the PNG/SVG buttons are left out. */
  getSvg?: () => SVGSVGElement | null
  csv: string
  /** Base file name without extension. */
  filename: string
  citation: string
  /** What the exported image is framed with: title, subtitle, legend, notes, the 988 note and the page URL; the source line is always added. */
  frame: Omit<ExportFrame, 'ink' | 'muted' | 'source'>
}

/** Download buttons for a chart (data as CSV, the chart as PNG, SVG under "More formats") and a copyable citation. */
export function ChartExports({ getSvg, csv, filename, citation, frame }: Props) {
  const theme = useChartTheme()
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  const buttonClass = 'rounded-full border border-line bg-surface px-3 py-1 text-sm font-medium text-ink-2 hover:bg-surface-tint hover:text-ink'
  const exportFrame = { ...frame, ink: theme.ink, muted: theme.muted }

  const withSvg = (action: (svg: SVGSVGElement) => void | Promise<void>) => async () => {
    const svg = getSvg?.()
    if (!svg) {
      setMessage('Show the chart first to download an image.')
      return
    }
    try {
      await action(svg)
      setMessage(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The download failed.')
    }
  }

  // Offered only where the browser can hand the page to another app (mostly phones).
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const share = async () => {
    try {
      await navigator.share({ title: frame.title, url: frame.url ?? window.location.href })
      setMessage(null)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('Sharing is not available here; copy the address instead.')
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(citation)
      setCopied(true)
      setMessage(null)
    } catch {
      setMessage('Copy is not available here; select the citation text to copy it.')
    }
  }

  return (
    <div className="mt-3 text-sm text-ink-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass} onClick={() => downloadText(`${filename}.csv`, csv, 'text/csv;charset=utf-8')}>Download data (CSV)</button>
        {getSvg ? (
          <button type="button" className={buttonClass} onClick={withSvg((svg) => downloadPng(svg, `${filename}.png`, theme.surface, exportFrame))}>Download chart (PNG)</button>
        ) : null}
        <button type="button" className={buttonClass} onClick={copy} aria-live="polite">{copied ? 'Copied' : 'Copy citation'}</button>
        {canShare ? <button type="button" className={buttonClass} onClick={share}>Share</button> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
        {getSvg ? (
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-ink-2">More formats</summary>
            <button type="button" className={`${buttonClass} mt-2`} onClick={withSvg((svg) => downloadSvg(svg, `${filename}.svg`, theme.surface, exportFrame))}>Download chart (SVG)</button>
          </details>
        ) : null}
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-ink-2">Cite this</summary>
          <p className="m-0 mt-1 wrap-anywhere text-xs leading-relaxed text-muted">{citation}</p>
        </details>
      </div>
      <p className="m-0 mt-1 min-h-5 text-xs" role="status">{message}</p>
    </div>
  )
}
