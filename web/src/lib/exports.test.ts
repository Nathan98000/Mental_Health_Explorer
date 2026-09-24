import { EXPORT_SOURCE, resolveCssVars, serializeSvg, toCsv } from './exports'

const SVG_NS = 'http://www.w3.org/2000/svg'
const tokens: Record<string, string> = { '--primary': '#c2410c', '--line': '#ede6da', '--ink': '#1e2240' }
const lookup = (name: string) => tokens[name]

/** A sparkline-like chart whose colors are all CSS variables. */
function chart(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement
  svg.setAttribute('width', '240')
  svg.setAttribute('height', '72')
  svg.setAttribute('class', 'shrink-0')
  const line = document.createElementNS(SVG_NS, 'line')
  line.setAttribute('stroke', 'var(--line)')
  line.setAttribute('style', 'fill: none; stroke-width: var(--w, 2px)')
  const dot = document.createElementNS(SVG_NS, 'circle')
  dot.setAttribute('fill', 'var(--primary, red)')
  const text = document.createElementNS(SVG_NS, 'text')
  text.setAttribute('fill', 'var(--missing, var(--ink))')
  text.textContent = '15%'
  svg.append(line, dot, text)
  return svg
}

describe('resolveCssVars', () => {
  it('replaces tokens, uses fallbacks for unknown ones and handles nesting', () => {
    expect(resolveCssVars('fill: var(--primary)', lookup)).toBe('fill: #c2410c')
    expect(resolveCssVars('var(--nope, #123456)', lookup)).toBe('#123456')
    expect(resolveCssVars('var(--nope, var(--ink))', lookup)).toBe('#1e2240')
    expect(resolveCssVars('var(--nope)', lookup)).toBe('#000000')
  })
})

describe('serializeSvg', () => {
  it('leaves no var() in attributes or inline styles', () => {
    const out = serializeSvg(chart(), '#fffdf8', undefined, lookup)
    expect(out).not.toContain('var(')
    expect(out).toContain('stroke="#ede6da"')
    expect(out).toContain('fill="#c2410c"')
    expect(out).toContain('fill="#1e2240"')
    expect(out).toContain('stroke-width: 2px')
    expect(out).toContain('background:#fffdf8')
  })
  it('frames the chart with a title, subtitle, legend and the source line', () => {
    const out = serializeSvg(
      chart(),
      '#fffdf8',
      { title: 'Major depressive episode in the past year', subtitle: 'teens ages 12–17 · 2021–2024', legend: [{ label: 'Male', color: '#2a78d6' }, { label: 'Female', color: '#eb6834', dashed: true }] },
      lookup,
    )
    expect(out).not.toContain('var(')
    expect(out).toContain('>Major depressive episode in the past year</text>')
    expect(out).toContain('>teens ages 12–17 · 2021–2024</text>')
    expect(out).toContain('>Male</text>')
    expect(out).toContain('>Female</text>')
    expect(out).toContain('stroke-dasharray="5 4"')
    expect(out).toContain(EXPORT_SOURCE)
    // The chart keeps its own size and sits below the header.
    expect(out).toMatch(/<svg[^>]*width="240"[^>]*height="72"[^>]*y="\d+"/)
    expect(Number(/<svg[^>]*\sheight="(\d+)"/.exec(out)?.[1])).toBeGreaterThan(72)
  })
})

describe('toCsv', () => {
  it('quotes fields with commas and leaves nulls empty', () => {
    const csv = toCsv([{ cohort: 'teen', indicator: 'mde_py', yearSet: '2024', weight: 'ANALWT2_C1', population: 'teens, ages 12–17', p: 0.148, lo: null, hi: null, n: 10917, suppressed: false }])
    expect(csv.split('\n')[0]).toBe('cohort,indicator,year_set,weight,population,p,lo,hi,n,suppressed')
    expect(csv.split('\n')[1]).toBe('teen,mde_py,2024,ANALWT2_C1,"teens, ages 12–17",0.148,,,10917,false')
  })
})
