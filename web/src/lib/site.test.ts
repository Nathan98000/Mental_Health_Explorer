import html from '../../index.html?raw'
import { SITE_NAME } from './site'

describe('site name', () => {
  it('matches the <title> in index.html', () => {
    expect(html).toContain(`<title>${SITE_NAME}</title>`)
  })
})
