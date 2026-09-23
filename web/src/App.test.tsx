import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import App from './App'
import { SITE_NAME } from './lib/site'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App', () => {
  it('renders the home page with the headline estimate', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: SITE_NAME })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: /how are young people/i })).toBeInTheDocument()
    const card = within(screen.getByRole('article'))
    expect(card.getByText('15%')).toBeInTheDocument()
    expect(card.getByText(/1 in 7/)).toBeInTheDocument()
  })

  it('always shows the 988 crisis line', () => {
    renderAt('/')
    expect(screen.getAllByText('988').length).toBeGreaterThan(0)
  })

  it('renders a not-found page for unknown routes', () => {
    renderAt('/nope')
    expect(screen.getByRole('heading', { name: /couldn't find/i })).toBeInTheDocument()
  })
})
