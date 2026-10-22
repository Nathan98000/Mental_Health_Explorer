import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import App from '../App'
import { clearCache } from '../lib/data'
import { exploreSummary } from '../lib/summary'
import { resolveExplore } from '../lib/routes'
import { SUPPRESSED_TAKEAWAY } from '../lib/takeaways'
import { flatShard, makeShard, mockData, readCatalog, teenMdeShard } from '../test/fixtures'

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
  it('says "Not reported" with the reason for a suppressed estimate', async () => {
    renderAt('/explore/teen/mde_py?year=2024&group=race_ethnicity&level=nhopi')
    const card = within(await screen.findByRole('article', { name: 'Estimate' }))
    expect(card.getByTestId('estimate-value')).toHaveTextContent('Not reported')
    expect(card.getByTestId('estimate-of')).toHaveTextContent('of non-Hispanic Native Hawaiian or Pacific Islander teens ages 12–17 · 2024')
    expect(card.getByText(SUPPRESSED_TAKEAWAY, { selector: 'p' })).toBeInTheDocument()
    // No interval or population count for a number that isn't reported; the response count stays.
    expect(card.queryByText('95% confidence interval')).not.toBeInTheDocument()
    expect(card.queryByText('Estimated number of people')).not.toBeInTheDocument()
    expect(card.getByText(/^answers from /)).toBeInTheDocument()
    expect(card.queryByText(/about 1 in/)).not.toBeInTheDocument()
    // The pooled estimate is suppressed too, so the card does not offer it.
    expect(card.queryByRole('link', { name: 'Try all years combined' })).not.toBeInTheDocument()
    expect(card.getByRole('link', { name: 'Try everyone' })).toHaveAttribute('href', '/explore/teen/mde_py?year=2024')
    expect((screen.getByLabelText('Population') as HTMLSelectElement).value).toBe('race_ethnicity:nhopi')
    // Every year is suppressed for this level, so there is no mini chart and no image to download.
    expect(screen.queryByRole('img', { name: /^Major depressive episode in the past year: / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download chart (PNG)' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download data (CSV)' })).toBeInTheDocument()
  })
  it('offers all years combined when the pooled estimate is reported', async () => {
    const small = makeShard('teen', 'mde_py', [2021, 2022, 2023, 2024], [
      { yearSet: '2024', group: 'race_ethnicity', level: 'nhopi', p: null },
      { yearSet: 'all', group: 'race_ethnicity', level: 'nhopi', p: 0.15, n: 160 },
    ])
    mockData({ 'catalog.json': catalog, 'estimates/teen/mde_py.json': small })
    renderAt('/explore/teen/mde_py?group=race_ethnicity&level=nhopi')
    const card = within(await screen.findByRole('article', { name: 'Estimate' }))
    expect(card.getByRole('link', { name: 'Try all years combined' })).toHaveAttribute('href', '/explore/teen/mde_py?year=all&group=race_ethnicity&level=nhopi')
  })
  it('words the note for an estimate of 0% or 100%', async () => {
    const same = makeShard('teen', 'mde_py', [2021, 2022, 2023, 2024], [{ yearSet: '2024', group: 'race_ethnicity', level: 'nhopi', p: null, n: 63, reason: 'estimate is 0% or 100%' }])
    mockData({ 'catalog.json': catalog, 'estimates/teen/mde_py.json': same })
    renderAt('/explore/teen/mde_py?group=race_ethnicity&level=nhopi')
    const card = within(await screen.findByRole('article', { name: 'Estimate' }))
    expect(card.getByText("Everyone surveyed in this group gave the same answer, so this can't be estimated reliably.", { selector: 'p' })).toBeInTheDocument()
    expect(card.getByText('answers from 63 teens')).toBeInTheDocument()
  })
  it('words the suppression note for an imprecise estimate', async () => {
    const imprecise = makeShard('teen', 'mde_py', [2021, 2022, 2023, 2024], [{ yearSet: '2024', group: 'sex', level: 'male', p: null, reason: 'estimate is too imprecise' }])
    mockData({ 'catalog.json': catalog, 'estimates/teen/mde_py.json': imprecise })
    renderAt('/explore/teen/mde_py?group=sex&level=male')
    const card = within(await screen.findByRole('article', { name: 'Estimate' }))
    expect(card.getByText('This estimate is too imprecise to report reliably.', { selector: 'p' })).toBeInTheDocument()
  })
  it('shows the value, details and takeaway for a level, with the selected year highlighted', async () => {
    renderAt('/explore/teen/mde_py?year=2024&group=sex&level=female')
    const card = within(await screen.findByRole('article', { name: 'Estimate' }))
    expect(card.getByTestId('estimate-value')).toHaveTextContent('22%')
    expect(card.queryByText(/about 1 in 5 of/)).not.toBeInTheDocument()
    expect(card.getByText("That's higher than all teens (15%).")).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Major depressive episode in the past year: / }).querySelector('[data-highlighted="true"]')).not.toBeNull()
    expect(screen.getByLabelText('Population')).toHaveAttribute('title', 'Female')
    expect(screen.getByLabelText('Measure')).toHaveAttribute('title', 'Major depressive episode in the past year')
    // Every level of the chosen group, with the selected one highlighted and everyone as the reference.
    expect(screen.getByRole('heading', { level: 2, name: 'Compared with other groups · 2024' })).toBeInTheDocument()
    const plot = screen.getByRole('table', { name: 'By sex' })
    expect(plot.querySelector('[data-level="female"][data-selected="true"]')).not.toBeNull()
    expect(plot.querySelector('[data-level="male"]')).not.toBeNull()
    expect(within(plot).getByRole('row', { name: /^All teens/ })).toHaveTextContent('15%')
    expect(within(plot).getByRole('row', { name: /^Female/ })).toHaveTextContent('Higher')
    expect(card.getByText(/^20\.2% to 23\.4%/)).toBeInTheDocument()
    expect(card.getByText('answers from 5,251 teens')).toBeInTheDocument()
    expect(card.getByText('about 2.7 million')).toBeInTheDocument()
    expect(document.title).toBe('Major depressive episode in the past year · Teens · Mental Health Explorer')
  })
  it('says the population count of a pooled estimate is a yearly average', async () => {
    renderAt('/explore/teen/mde_py?year=all')
    const card = within(await screen.findByRole('article', { name: 'Estimate' }))
    expect(card.getByText('about 4.5 million per year, on average')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Major depressive episode in the past year: / }).querySelector('[data-shaded-years="2021 2022 2023 2024"]')).not.toBeNull()
  })
  it('normalizes an unknown indicator to the default one and says so', async () => {
    renderAt('/explore/teen/not_a_measure?year=2024')
    expect(await screen.findByRole('heading', { level: 1, name: 'Major depressive episode in the past year' })).toBeInTheDocument()
    expect((screen.getByLabelText('Years') as HTMLSelectElement).value).toBe('2024')
    expect(await screen.findByTestId('estimate-value')).toHaveTextContent('15%')
    expect(screen.getByText("We couldn't find that measure; showing Major depressive episode in the past year.")).toBeInTheDocument()
    // The citation uses the canonical URL, not the one that was typed.
    expect(screen.getByText(/Estimates computed from SAMHSA/)).toHaveTextContent('/explore/teen/mde_py?year=2024.')
  })
  it('names the restricted denominator everywhere a population is named', async () => {
    const treatment = makeShard('teen', 'mde_any_treatment', [2021, 2022, 2023, 2024], [
      { yearSet: '2021', p: 0.41, lo: 0.37, hi: 0.45, n: 2000 },
      { yearSet: '2024', p: 0.52, lo: 0.48, hi: 0.56, n: 1600 },
    ], [{ yearA: 2021, yearB: 2024, diff: 0.11, p: 0.001 }])
    mockData({ 'catalog.json': catalog, 'estimates/teen/mde_any_treatment.json': treatment })
    renderAt('/explore/teen/mde_any_treatment')
    const card = within(await screen.findByRole('article', { name: 'Estimate' }))
    expect(card.getByText('52% of teens ages 12–17 who had a major depressive episode in the past year got treatment or medication for depression in the past year (2024).')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Everyone (teens ages 12–17 who had a major depressive episode in the past year)' })).toBeInTheDocument()
  })
  it('flags a wide margin of error and gives the range instead of a ratio', async () => {
    const wide = makeShard('teen', 'mde_py', [2021, 2022, 2023, 2024], [{ yearSet: '2024', group: 'race_ethnicity', level: 'aian', p: 0.061, lo: 0.021, hi: 0.152, n: 120 }])
    mockData({ 'catalog.json': catalog, 'estimates/teen/mde_py.json': wide })
    renderAt('/explore/teen/mde_py?group=race_ethnicity&level=aian')
    const card = within(await screen.findByRole('article', { name: 'Estimate' }))
    expect(card.getByTestId('wide-margin')).toHaveTextContent('Wide margin of error')
    expect(card.getByText(/^Between 2\.1% and 15\.2% of non-Hispanic American Indian or Alaska Native teens ages 12–17 /)).toBeInTheDocument()
    expect(card.getByTestId('estimate-value')).toHaveTextContent('2.1%–15.2%')
    expect(card.getByText('best estimate 6.1%')).toBeInTheDocument()
    expect(card.queryByText(/about 1 in/)).not.toBeInTheDocument()
  })
  it('compares every group for everyone: eight tables for teens and nine for young adults', async () => {
    renderAt('/explore/teen/mde_py?year=2024')
    expect(await screen.findByRole('heading', { level: 2, name: 'Compared with other groups · 2024' })).toBeInTheDocument()
    expect(screen.getAllByRole('table')).toHaveLength(8)
    // One scale for every table, and the groups after the first three folded away.
    expect(new Set([...document.querySelectorAll('[data-axis-max]')].map((n) => n.getAttribute('data-axis-max'))).size).toBe(1)
    expect(screen.getByText('More groups (5)', { selector: 'summary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'By sex' })).toBeInTheDocument()
    // Only sex has a significant group test in the fixture: female is higher and male lower.
    const sex = within(screen.getByRole('table', { name: 'By sex' }))
    expect(sex.getByRole('row', { name: /^Female/ })).toHaveTextContent('Higher')
    expect(sex.getByRole('row', { name: /^Male/ })).toHaveTextContent('Lower')
    expect(screen.getAllByText('Higher')).toHaveLength(1)
    expect(screen.getAllByText('Lower')).toHaveLength(1)
  })
  it('compares nine groups for young adults', async () => {
    mockData({ 'catalog.json': catalog, 'estimates/young_adult/mde_py.json': flatShard('young_adult', 'mde_py') })
    renderAt('/explore/young_adult/mde_py')
    expect(await screen.findByRole('heading', { level: 2, name: /^Compared with other groups/ })).toBeInTheDocument()
    expect(screen.getAllByRole('table')).toHaveLength(9)
    expect(new Set([...document.querySelectorAll('[data-axis-max]')].map((n) => n.getAttribute('data-axis-max'))).size).toBe(1)
    expect(screen.queryByText('Higher')).not.toBeInTheDocument()
    expect(screen.queryByText('Lower')).not.toBeInTheDocument()
  })
})
