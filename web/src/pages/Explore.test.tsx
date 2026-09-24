import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import App from '../App'
import { clearCache } from '../lib/data'
import { exploreSummary } from '../lib/summary'
import { resolveExplore } from '../lib/routes'
import { SUPPRESSED_TAKEAWAY } from '../lib/takeaways'
import { mockData, readCatalog, teenMdeShard } from '../test/fixtures'

const catalog = readCatalog()
const shard = teenMdeShard()

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockData({ 'catalog.json': catalog, 'estimates/teen/mde_py.json': shard })
})

afterEach(() => {
  vi.unstubAllGlobals()
  clearCache()
})

describe('exploreSummary', () => {
  it('describes a suppressed cell with the suppression note only', () => {
    const { state } = resolveExplore(catalog, 'teen', 'mde_py', new URLSearchParams('year=2024&group=race_ethnicity&level=nhopi'))
    const summary = exploreSummary(catalog, shard, state)
    expect(summary.cell?.suppressed).toBe(true)
    expect(summary.sentences).toEqual([SUPPRESSED_TAKEAWAY])
  })
  it('gives the three takeaway sentences for a level', () => {
    const { state } = resolveExplore(catalog, 'teen', 'mde_py', new URLSearchParams('year=2024&group=sex&level=female'))
    expect(exploreSummary(catalog, shard, state).sentences).toEqual([
      'About 1 in 5 female teens ages 12–17 had a major depressive episode in the past year (22%, 2024).',
      "That's down from 30% in 2021.",
      "That's higher than all teens (15%).",
    ])
  })
  it('has no change sentence for the first year or a pooled set', () => {
    const first = resolveExplore(catalog, 'teen', 'mde_py', new URLSearchParams('year=2021')).state
    expect(exploreSummary(catalog, shard, first).sentences).toHaveLength(1)
    const pooled = resolveExplore(catalog, 'teen', 'mde_py', new URLSearchParams('year=all')).state
    expect(exploreSummary(catalog, shard, pooled).sentences).toEqual(['About 1 in 6 teens ages 12–17 had a major depressive episode in the past year (18%, 2021–2024 combined).'])
  })
})

describe('Explore page', () => {
  it('shows a dash with the reason for a suppressed estimate', async () => {
    renderAt('/explore/teen/mde_py?year=2024&group=race_ethnicity&level=nhopi')
    const card = within(await screen.findByRole('article', { name: 'Estimate' }))
    const value = card.getByTestId('estimate-value')
    expect(value).toHaveTextContent('—')
    expect(within(value).getByRole('tooltip')).toHaveTextContent('Not reported: fewer than 50 respondents.')
    expect(card.getByText(SUPPRESSED_TAKEAWAY)).toBeInTheDocument()
    expect(card.queryByText(/about 1 in/)).not.toBeInTheDocument()
    expect((screen.getByLabelText('Population') as HTMLSelectElement).value).toBe('race_ethnicity:nhopi')
  })
  it('shows the value, ratio, details and takeaway for a level', async () => {
    renderAt('/explore/teen/mde_py?year=2024&group=sex&level=female')
    const card = within(await screen.findByRole('article', { name: 'Estimate' }))
    expect(card.getByTestId('estimate-value')).toHaveTextContent('22%')
    expect(card.getByText('about 1 in 5 of female teens ages 12–17')).toBeInTheDocument()
    expect(card.getByText("That's higher than all teens (15%).")).toBeInTheDocument()
    expect(card.getByText('20.2% to 23.4%')).toBeInTheDocument()
    expect(card.getByText('5,251')).toBeInTheDocument()
    expect(card.getByText('about 2.7 million')).toBeInTheDocument()
    expect(document.title).toBe('Major depressive episode in the past year · Teens · Mental Health Explorer')
  })
  it('redirects an unknown indicator to the default one', async () => {
    renderAt('/explore/teen/not_a_measure?year=2024')
    expect(await screen.findByRole('heading', { level: 1, name: 'Major depressive episode in the past year' })).toBeInTheDocument()
    expect((screen.getByLabelText('Years') as HTMLSelectElement).value).toBe('2024')
    expect(await screen.findByTestId('estimate-value')).toHaveTextContent('15%')
  })
})
