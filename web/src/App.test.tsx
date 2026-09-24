import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import App from './App'
import type { EstimateShard } from './lib/data'
import { SITE_NAME } from './lib/site'

type Row = { year: number; p: number; lo: number; hi: number; n: number }

/** A minimal shard in the committed column-wise format: overall single-year cells only. */
function shard(indicator: string, rows: Row[]): EstimateShard {
  const years = rows.map((r) => r.year)
  return {
    cohort: 'teen',
    indicator,
    years,
    year_sets: Object.fromEntries(years.map((y) => [String(y), { years: [y], weight: 'ANALWT2_C1' }])),
    crosses: years.map(String),
    cells: {
      year_set: years.map(String),
      group: rows.map(() => null),
      level: rows.map(() => null),
      group2: rows.map(() => null),
      level2: rows.map(() => null),
      p: rows.map((r) => r.p),
      lo: rows.map((r) => r.lo),
      hi: rows.map((r) => r.hi),
      se: rows.map(() => 0.006),
      n: rows.map((r) => r.n),
      pop: rows.map((r) => Math.round(r.p * 25_000) * 1000),
      suppressed: rows.map(() => false),
      reason: rows.map(() => null),
    },
    trend_tests: { group: [null], level: [null], year_a: [2021], year_b: [2024], diff: [-0.057], se: [0.0088], p_value: [0] },
    group_tests: [],
  }
}

const shards: Record<string, EstimateShard> = {
  mde_py: shard('mde_py', [
    { year: 2021, p: 0.20537, lo: 0.19196, hi: 0.21948, n: 10317 },
    { year: 2024, p: 0.14837, lo: 0.13754, hi: 0.15991, n: 10917 },
  ]),
  mde_severe: shard('mde_severe', [
    { year: 2021, p: 0.15229, lo: 0.13908, hi: 0.16657, n: 10317 },
    { year: 2024, p: 0.10975, lo: 0.10012, hi: 0.12024, n: 10917 },
  ]),
}

function mockFetch(handler: (url: string) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => handler(String(input))))
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
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
})

describe('App', () => {
  it('renders the home page with the headline estimate from the data files', async () => {
    const requested: string[] = []
    mockFetch(async (url) => {
      requested.push(url)
      const id = url.match(/estimates\/teen\/(\w+)\.json$/)?.[1]
      return id && shards[id] ? jsonResponse(shards[id]) : jsonResponse({ error: 'not found' }, 404)
    })
    renderAt('/')
    expect(screen.getByRole('link', { name: SITE_NAME })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: /how are young people/i })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
    const card = within(await screen.findByRole('article'))
    expect(card.getByText('15%')).toBeInTheDocument()
    expect(card.getByText(/1 in 7/)).toBeInTheDocument()
    expect(card.getByText(/down from 21% \(about 1 in 5\) in 2021/)).toBeInTheDocument()
    expect(requested.sort()).toEqual([
      `${import.meta.env.BASE_URL}data/estimates/teen/mde_py.json`,
      `${import.meta.env.BASE_URL}data/estimates/teen/mde_severe.json`,
    ])
  })

  it('shows an error state when the data files cannot be loaded', async () => {
    mockFetch(async () => jsonResponse({ error: 'nope' }, 500))
    renderAt('/')
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i)
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('shows the early-preview note without the prototype wording', () => {
    mockFetch(() => new Promise(() => {}))
    renderAt('/')
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent(
      "Early preview. This site is still being built. Numbers are computed from the survey and checked against SAMHSA's reference tables; a final review happens before launch.",
    )
    expect(note.textContent).not.toMatch(/prototype/i)
  })

  it('always shows the 988 crisis line', () => {
    mockFetch(() => new Promise(() => {}))
    renderAt('/')
    expect(screen.getAllByText('988').length).toBeGreaterThan(0)
  })

  it('renders a not-found page for unknown routes', () => {
    mockFetch(() => new Promise(() => {}))
    renderAt('/nope')
    expect(screen.getByRole('heading', { name: /couldn't find/i })).toBeInTheDocument()
  })
})
