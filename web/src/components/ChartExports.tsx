import { useState } from 'react'
import { downloadPng, downloadSvg, downloadText, type ExportLegendItem } from '../lib/exports'
import { useChartTheme } from '../lib/theme'

type Props = {
  /** The chart's SVG element, when rendered. */
  getSvg: () => SVGSVGElement | null
  csv: string
  /** Base file name without extension. */
  filename: string
  citation: string
  /** What the exported image is framed with; the source line is always added. */
  frame: { title: string; subtitle?: string; legend?: ExportLegendItem[] }
}

/** Download links for a chart (CSV, PNG, SVG) and a copyable citation. */
export function ChartExports({ getSvg, csv, filename, citation, frame }: Props) {
  const theme = useChartTheme()
  const [message, setMessage] = useState<string | null>(null)
  const buttonClass = 'rounded-full border border-line bg-surface px-3 py-1 text-sm font-medium text-ink-2 hover:bg-surface-tint hover:text-ink'
  const exportFrame = { ...frame, ink: theme.ink, muted: theme.muted }

  const withSvg = (action: (svg: SVGSVGElement) => void | Promise<void>) => async () => {
    const svg = getSvg()
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(citation)
      setMessage('Citation copied.')
    } catch {
      setMessage('Copy is not available here; select the citation text to copy it.')
    }
  }

  return (
    <div className="mt-3 text-sm text-ink-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Download:</span>
        <button type="button" className={buttonClass} onClick={() => downloadText(`${filename}.csv`, csv, 'text/csv')}>CSV</button>
        <button type="button" className={buttonClass} onClick={withSvg((svg) => downloadPng(svg, `${filename}.png`, theme.surface, exportFrame))}>PNG</button>
        <button type="button" className={buttonClass} onClick={withSvg((svg) => downloadSvg(svg, `${filename}.svg`, theme.surface, exportFrame))}>SVG</button>
        <button type="button" className={buttonClass} onClick={copy}>Copy citation</button>
      </div>
      <p className="m-0 mt-2 wrap-anywhere text-xs leading-relaxed text-muted">{citation}</p>
      <p className="m-0 mt-1 min-h-5 text-xs" role="status">{message}</p>
    </div>
  )
}
