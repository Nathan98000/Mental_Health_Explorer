import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { ChartExports } from './ChartExports'

const props = { csv: 'a\n', filename: 'chart', citation: 'Cite me.', frame: { title: 'Major depressive episode in the past year', url: 'https://example.org/explore/teen/mde_py' } }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ChartExports', () => {
  it('names each download by what it holds and keeps SVG under More formats', () => {
    render(<ChartExports {...props} getSvg={() => null} />)
    expect(screen.getByRole('button', { name: 'Download data (CSV)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download chart (PNG)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download chart (SVG)' }).closest('details')).toHaveTextContent(/^More formats/)
  })
  it('offers Share only where the browser can share', async () => {
    render(<ChartExports {...props} />)
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
  })
  it('shares the page with its title when navigator.share exists', async () => {
    const share = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, share })
    render(<ChartExports {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Share' }))
    expect(share).toHaveBeenCalledWith({ title: props.frame.title, url: props.frame.url })
  })
})
