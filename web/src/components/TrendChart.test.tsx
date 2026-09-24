import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { SURVEY_YEARS } from '../lib/catalog'
import { resolveTrends } from '../lib/routes'
import { trendData } from '../lib/trends'
import { makeShard, readCatalog } from '../test/fixtures'
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
    expect(data.notes).toContain('Not asked in 2021.')
    expect(data.notes).toContain('All teens: not shown for 2023 because there were not enough responses to report it reliably.')
    expect(data.notes).toContain('Nicotine vaping questions were added in 2022.')
    expect(data.annotations).toEqual([])
    expect(data.csv.map((r) => r.yearSet)).toEqual(['2022', '2023', '2024'])
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
    render(<TrendChart title="Vaping" rows={rows} series={['All teens']} years={SURVEY_YEARS} notes={['Not asked in 2021.']} />)
    const svg = screen.getByRole('img', { name: 'Vaping' })
    expect(svg).toBeInTheDocument()
    // The line is drawn as two separate segments around the suppressed 2023 point.
    const lines = [...svg.querySelectorAll('path[stroke]')].map((p) => p.getAttribute('d') ?? '')
    const linePath = lines.find((d) => d.includes('L') || (d.match(/M/g) ?? []).length > 1) ?? lines[0]
    expect(linePath).toBeDefined()
    expect((linePath.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Not asked in 2021.')).toBeInTheDocument()
  })
  it('shows the gaps in the table view', async () => {
    render(<TrendChart title="Vaping" rows={rows} series={['All teens']} years={SURVEY_YEARS} />)
    await userEvent.click(screen.getByRole('button', { name: 'Show table' }))
    const table = within(screen.getByRole('table'))
    expect(table.getByRole('row', { name: /2021/ })).toHaveTextContent('Not asked')
    expect(table.getByRole('row', { name: /2022/ })).toHaveTextContent('13.9% (13.0% to 14.8%)')
    const suppressed = table.getByRole('row', { name: /2023/ })
    expect(suppressed).toHaveTextContent('—')
    expect(within(suppressed).getByRole('tooltip')).toHaveTextContent('Not reported: estimate is too imprecise.')
  })
})
