import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { SURVEY_YEARS } from '../lib/catalog'
import { resolveTrends } from '../lib/routes'
import { trendData } from '../lib/trends'
import { makeShard, readCatalog } from '../test/fixtures'
import { dodgeLabels, truncateLabel } from '../lib/labels'
import { TrendChart, type TrendRow } from './TrendChart'

const catalog = readCatalog()

/** Like teen vaping: not asked in 2021, and one later point suppressed. */
function vapeShard() {
  return makeShard('teen', 'nicotine_vape_py', [2022, 2023, 2024], [
    { yearSet: '2022', p: 0.139 },
    { yearSet: '2023', p: null, reason: 'estimate is too imprecise' },
    { yearSet: '2024', p: 0.12 },
  ])
}

describe('trendData', () => {
  it('marks uncollected years and suppressed points as gaps and explains them', () => {
    const { state } = resolveTrends(catalog, 'teen', 'nicotine_vape_py', new URLSearchParams(''))
    const data = trendData(catalog, vapeShard(), state)
    expect(data.series).toEqual(['All teens'])
    expect(data.rows.map((r) => [r.year, r.status, r.p])).toEqual([
      [2021, 'not_collected', null],
      [2022, 'ok', 0.139],
      [2023, 'suppressed', null],
      [2024, 'ok', 0.12],
    ])
    expect(data.notes).toContain('Not available in 2021.')
    expect(data.notes).toContain('All teens: not shown for 2023 because there were not enough responses to report it reliably.')
    expect(data.notes).toContain('Nicotine vaping questions were added in 2022.')
    expect(data.annotations).toEqual([])
    expect(data.csv.map((r) => r.years)).toEqual(['2022', '2023', '2024'])
    expect(data.csv[1]).toMatchObject({ suppressed: true, p: null, weight: 'ANALWT2_C1', population: 'teens ages 12–17' })
  })
  it('turns a caveat that names a collected year into a chart annotation', () => {
    const { state } = resolveTrends(catalog, 'teen', 'suicide_thoughts', new URLSearchParams('split=sex'))
    const shard = makeShard('teen', 'suicide_thoughts', [2021, 2022, 2023, 2024], [
      ...['male', 'female'].flatMap((level) => [2021, 2022, 2023, 2024].map((y) => ({ yearSet: String(y), group: 'sex', level, p: level === 'male' ? 0.08 : 0.17 }))),
    ])
    const data = trendData(catalog, shard, state)
    expect(data.series).toEqual(['Male', 'Female'])
    expect(data.annotations).toHaveLength(1)
    expect(data.annotations[0].year).toBe(2022)
    expect(data.notes).toHaveLength(1)
    expect(data.notes[0]).toMatch(/not sure/)
  })
})

const rows: TrendRow[] = [
  { year: 2021, series: 'All teens', p: null, lo: null, hi: null, status: 'not_collected' },
  { year: 2022, series: 'All teens', p: 0.139, lo: 0.13, hi: 0.148, status: 'ok' },
  { year: 2023, series: 'All teens', p: null, lo: null, hi: null, status: 'suppressed', reason: 'estimate is too imprecise' },
  { year: 2024, series: 'All teens', p: 0.12, lo: 0.112, hi: 0.128, status: 'ok' },
]

describe('TrendChart', () => {
  it('renders an accessible chart with a gap where a point is missing', () => {
    render(<TrendChart title="Vaping" rows={rows} series={['All teens']} years={SURVEY_YEARS} notes={['Not available in 2021.']} />)
    const svg = screen.getByRole('img', { name: 'Vaping' })
    expect(svg).toBeInTheDocument()
    // The line is drawn as two separate segments around the suppressed 2023 point.
    const lines = [...svg.querySelectorAll('path[stroke]')].map((p) => p.getAttribute('d') ?? '')
    const linePath = lines.find((d) => d.includes('L') || (d.match(/M/g) ?? []).length > 1) ?? lines[0]
    expect(linePath).toBeDefined()
    expect((linePath.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Not available in 2021.')).toBeInTheDocument()
  })
  it('draws a survey change as a thin solid rule between the year before and the year it names', () => {
    const rows = seriesRows('All teens', [0.1, 0.11, 0.115, 0.12])
    render(<TrendChart title="Changed" rows={rows} series={['All teens']} years={SURVEY_YEARS} annotations={[{ year: 2022, label: 'Questions moved in 2022.' }]} />)
    const svg = screen.getByRole('img', { name: 'Changed' })
    const rule = svg.querySelector('[data-survey-change="2022"]')
    expect(rule).not.toBeNull()
    expect(rule).not.toHaveAttribute('stroke-dasharray')
    expect(svg.textContent).toContain('Survey change')
    expect(screen.getByText(/Questions moved in 2022\./)).toHaveTextContent(/^Survey change/)
  })
  it('shows the gaps in the table view', async () => {
    render(<TrendChart title="Vaping" rows={rows} series={['All teens']} years={SURVEY_YEARS} />)
    await userEvent.click(screen.getByRole('button', { name: 'Show table' }))
    const table = within(screen.getByRole('table'))
    expect(table.getByRole('row', { name: /2021/ })).toHaveTextContent('Not available')
    expect(table.getByRole('row', { name: /2022/ })).toHaveTextContent('13.9% (13.0% to 14.8%)')
    const suppressed = table.getByRole('row', { name: /2023/ })
    expect(suppressed).toHaveTextContent('—')
    expect(within(suppressed).getByRole('tooltip')).toHaveTextContent('Not reported: estimate is too imprecise.')
  })
})

function seriesRows(name: string, values: (number | null)[]): TrendRow[] {
  return SURVEY_YEARS.map((year, i) => {
    const p = values[i]
    return p === null ? { year, series: name, p: null, lo: null, hi: null, status: 'not_collected' } : { year, series: name, p, lo: p - 0.01, hi: p + 0.01, status: 'ok' }
  })
}

const LONG = 'Native Hawaiian or Pacific Islander (non-Hispanic)'

describe('end labels', () => {
  it('truncates long names and dodges labels apart with a minimum gap', () => {
    expect(truncateLabel('Female')).toBe('Female')
    expect(truncateLabel(LONG)).toBe('Native Hawaiian or Paci…')
    expect(truncateLabel(LONG)).toHaveLength(24)
    expect(dodgeLabels([100, 104, 200])).toEqual([100, 116, 200])
    expect(dodgeLabels([104, 100, 200])).toEqual([116, 100, 200])
    // Labels at the bottom are pulled back up so they stay inside the plot.
    expect(dodgeLabels([290, 296], 14, 0, 300)).toEqual([286, 300])
    expect(dodgeLabels([296, 296, 296], 14, 0, 300)).toEqual([272, 286, 300])
    expect(dodgeLabels([], 14)).toEqual([])
  })
  it('labels only series with a point in the final year, once each, with a leader where a label moved', () => {
    const rows = [...seriesRows('Male', [0.1, 0.11, 0.115, 0.12]), ...seriesRows('Female', [0.2, 0.19, 0.15, 0.122]), ...seriesRows(LONG, [0.3, 0.31, 0.32, null])]
    render(<TrendChart title="Split" rows={rows} series={['Male', 'Female', LONG]} years={SURVEY_YEARS} />)
    const svg = screen.getByRole('img', { name: 'Split' })
    const labels = [...svg.querySelectorAll('[data-end-label]')]
    expect(labels.map((l) => l.textContent)).toEqual(['Male 12.0%', 'Female 12.2%'])
    const ys = labels.map((l) => Number(l.getAttribute('y')))
    expect(Math.abs(ys[0] - ys[1])).toBeGreaterThanOrEqual(16)
    expect(labels.every((l) => l.getAttribute('style')?.includes('text-anchor: start'))).toBe(true)
    expect(svg.querySelectorAll('[data-leader]').length).toBeGreaterThanOrEqual(1)
    // The full name stays in the legend.
    expect(within(screen.getByRole('list', { name: 'Legend' })).getByText(LONG)).toBeInTheDocument()
  })
  it('shows the value alone for a single series and nothing when the final year is missing', () => {
    render(<TrendChart title="Vaping" rows={rows} series={['All teens']} years={SURVEY_YEARS} />)
    expect([...screen.getByRole('img', { name: 'Vaping' }).querySelectorAll('[data-end-label]')].map((l) => l.textContent)).toEqual(['12.0%'])
    const noFinal = seriesRows('All teens', [0.1, 0.11, 0.12, null])
    render(<TrendChart title="Short" rows={noFinal} series={['All teens']} years={SURVEY_YEARS} />)
    expect(screen.getByRole('img', { name: 'Short' }).querySelectorAll('[data-end-label]')).toHaveLength(0)
  })
  it('drops end labels on narrow containers', () => {
    class NarrowObserver {
      cb: (entries: { contentRect: { width: number } }[]) => void
      constructor(cb: (entries: { contentRect: { width: number } }[]) => void) {
        this.cb = cb
      }
      observe() {
        this.cb([{ contentRect: { width: 400 } }])
      }
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', NarrowObserver)
    try {
      render(<TrendChart title="Narrow" rows={rows} series={['All teens']} years={SURVEY_YEARS} />)
      expect(screen.getByRole('img', { name: 'Narrow' }).querySelectorAll('[data-end-label]')).toHaveLength(0)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('comparison styling', () => {
  it('marks the compared years and dashes series whose change is not significant', () => {
    const rows = [...seriesRows('Male', [0.1, 0.11, 0.115, 0.12]), ...seriesRows('Female', [0.2, 0.19, 0.15, 0.122])]
    render(<TrendChart title="Compared" rows={rows} series={['Male', 'Female']} years={SURVEY_YEARS} caption="Share." comparison={{ yearA: 2021, yearB: 2024, significant: ['Female'] }} />)
    const svg = screen.getByRole('img', { name: 'Compared' })
    expect([...svg.querySelectorAll('[data-compared-year]')].map((l) => l.getAttribute('data-compared-year'))).toEqual(['2021', '2024'])
    expect(svg.querySelector('[stroke-dasharray="6 4"]')).not.toBeNull()
    expect(screen.getByText(/Dashed lines: the change from 2021 to 2024 is not statistically significant/)).toBeInTheDocument()
    const legend = within(screen.getByRole('list', { name: 'Legend' }))
    expect(legend.getByText('Male').querySelector('line')).toHaveAttribute('stroke-dasharray', '4 3')
    expect(legend.getByText('Female').querySelector('line')).not.toHaveAttribute('stroke-dasharray')
  })
})

describe('legend and intervals', () => {
  it('leaves series with no drawn points out of the legend and hides it in the table view', async () => {
    const rows = [...seriesRows('Male', [0.1, 0.11, 0.115, 0.12]), ...seriesRows('Female', [0.2, 0.19, 0.15, 0.122]), ...seriesRows('Neither', [null, null, null, null])]
    render(<TrendChart title="Legend" rows={rows} series={['Male', 'Female', 'Neither']} years={SURVEY_YEARS} caption="Share." />)
    const legend = within(screen.getByRole('list', { name: 'Legend' }))
    expect(legend.getByText('Male')).toBeInTheDocument()
    expect(legend.queryByText('Neither')).not.toBeInTheDocument()
    // Three series: per-point rules instead of bands.
    expect(screen.getByText(/Vertical bars at each point show 95% confidence intervals/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show table' }))
    expect(screen.queryByRole('list', { name: 'Legend' })).not.toBeInTheDocument()
    expect(screen.queryByText(/confidence intervals/)).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
  it('keeps shaded bands for one or two series and takes explicit colors', () => {
    render(<TrendChart title="Bands" rows={rows} series={['All teens']} years={SURVEY_YEARS} colors={['#c2410c']} />)
    expect(screen.getByText(/Shaded bands show 95% confidence intervals/)).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Legend' })).getByText('All teens').querySelector('line')).toHaveAttribute('stroke', '#c2410c')
  })
})
