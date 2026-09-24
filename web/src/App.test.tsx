import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import App from './App'
import { clearCache } from './lib/data'
import { HEADLINES } from './lib/headlines'
import { SITE_NAME } from './lib/site'
import { flatShard, mockData, readCatalog, teenMdeShard } from './test/fixtures'

const catalog = readCatalog()

function allShards() {
  const files: Record<string, unknown> = { 'catalog.json': catalog }
  for (const cohort of ['teen', 'young_adult'] as const) {
    for (const id of HEADLINES[cohort]) files[`estimates/${cohort}/${id}.json`] = cohort === 'teen' && id === 'mde_py' ? teenMdeShard() : flatShard(cohort, id)
  }
  return files
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  clearCache()
})

describe('App', () => {
  it('renders the overview with a headline tile for each teen measure', async () => {
    const requested: string[] = []
    mockData(allShards(), (url) => requested.push(url))
    renderAt('/')
    expect(screen.getByRole('link', { name: SITE_NAME })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: /how are young people/i })).toBeInTheDocument()
    const mde = (await screen.findByRole('link', { name: 'Major depressive episode in the past year' })).closest('li')!
    expect(mde).toHaveTextContent('15%')
    expect(mde).toHaveTextContent('of teens ages 12–17 in 2024')
    expect(within(mde).getByText('Fell since 2021')).toHaveAttribute('data-change', 'fell')
    expect(within(mde).getByRole('link', { name: 'Major depressive episode in the past year' })).toHaveAttribute('href', '/explore/teen/mde_py')
    expect(within(mde).getByRole('img').getAttribute('aria-label')).toMatch(/^2021: 21%, 2022: 19%, 2023: 18%, 2024: 15%$/)
    const same = screen.getByRole('link', { name: 'Alcohol use in the past month' }).closest('li')!
    expect(within(same).getByText('About the same as 2021')).toHaveAttribute('data-change', 'same')
    const shardsRequested = requested.filter((u) => u.includes('/estimates/')).sort()
    expect(shardsRequested).toEqual(HEADLINES.teen.map((id) => `${import.meta.env.BASE_URL}data/estimates/teen/${id}.json`).sort())
    expect(document.title).toBe(SITE_NAME)
  })

  it('switches cohorts from the URL', async () => {
    mockData(allShards())
    renderAt('/?cohort=young_adult')
    expect(await screen.findByRole('link', { name: 'Serious psychological distress in the past year' })).toHaveAttribute('href', '/explore/young_adult/spd_py')
    expect(screen.getAllByText('of young adults ages 18–25 in 2024').length).toBe(6)
    expect(screen.getByRole('link', { name: 'Young adults ages 18–25' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows an error state when the data files cannot be loaded', async () => {
    mockData({ 'catalog.json': catalog })
    renderAt('/')
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i)
  })

  it('shows the early-preview note without the prototype wording', async () => {
    mockData({})
    renderAt('/')
    const note = await screen.findByRole('note')
    expect(note).toHaveTextContent(
      "Early preview. This site is still being built. Numbers are computed from the survey and checked against SAMHSA's reference tables; a final review happens before launch.",
    )
    expect(note.textContent).not.toMatch(/prototype/i)
  })

  it('always shows the 988 crisis line', () => {
    mockData({})
    renderAt('/')
    expect(screen.getAllByText('988').length).toBeGreaterThan(0)
  })

  it('links to every live page from the header', () => {
    mockData({})
    renderAt('/')
    const nav = within(screen.getByRole('navigation', { name: 'Main' }))
    expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    expect(nav.getByRole('link', { name: 'Explore' })).toHaveAttribute('href', '/explore/teen/mde_py')
    expect(nav.getByRole('link', { name: 'Trends' })).toHaveAttribute('href', '/trends/teen/mde_py')
    expect(nav.getByRole('link', { name: 'Methods' })).toHaveAttribute('href', '/methods')
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('renders a not-found page for unknown routes', async () => {
    mockData({})
    renderAt('/nope')
    expect(await screen.findByRole('heading', { name: /couldn't find/i })).toBeInTheDocument()
  })
})
