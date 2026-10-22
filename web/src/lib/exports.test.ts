import { CRISIS_TEXT } from '../components/CrisisNote'
import { EXPORT_SOURCE, resolveCssVars, serializeSvg, toCsv, wrapText } from './exports'

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
      { title: 'Major depressive episode in the past year', subtitle: 'Teens ages 12–17 · 2021–2024', legend: [{ label: 'Male', color: '#2a78d6' }, { label: 'Female', color: '#eb6834' }] },
      lookup,
    )
    expect(out).not.toContain('var(')
    // A 240-px chart wraps the title; its lines read back as the whole title.
    expect(exportText(out, 'title')).toBe('Major depressive episode in the past year')
    expect(out).toContain('>Teens ages 12–17 · 2021–2024</text>')
    expect(out).toContain('>Male</text>')
    expect(out).toContain('>Female</text>')
    expect(out).not.toContain('stroke-dasharray')
    expect(exportText(out, 'source')).toContain(EXPORT_SOURCE)
    expect(exportText(out, 'source')).toMatch(/ · Early preview$/)
    // The chart keeps its own size and sits below the header.
    expect(out).toMatch(/<svg[^>]*width="240"[^>]*height="72"[^>]*y="\d+"/)
    expect(Number(/<svg[^>]*\sheight="(\d+)"/.exec(out)?.[1])).toBeGreaterThan(72)
  })
})

describe('export header', () => {
  it('wraps a long title on a narrow chart', () => {
    const narrow = chart()
    narrow.setAttribute('width', '300')
    const title = 'Major depressive episode in the past year, by family income.'
    expect(title).toHaveLength(60)
    const out = serializeSvg(narrow, '#fffdf8', { title }, lookup)
    expect(out.match(/data-export-title=""/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })
  it("draws a legend item's dot shape on its swatch line", () => {
    const out = serializeSvg(chart(), '#fffdf8', { title: 'T', legend: [{ label: 'A', color: '#2a78d6', symbol: 'triangle' }, { label: 'B', color: '#eb6834' }] }, lookup)
    expect(out).toMatch(/<polygon[^>]*fill="#2a78d6"/)
    expect(out.match(/<polygon/g)).toHaveLength(1)
  })
})

/** The text of an export's title, notes or source line, its wrapped lines joined back together. */
function exportText(markup: string, kind: 'title' | 'note' | 'source'): string {
  return [...markup.matchAll(new RegExp(`<text[^>]*data-export-${kind}="[^"]*"[^>]*>([^<]*)</text>`, 'g'))].map((m) => m[1].replace(/&amp;/g, '&')).join(' ')
}

describe('export notes', () => {
  const notes = ['Shaded bands show 95% confidence intervals.', 'Larger dots mark 2021 and 2024.', 'Survey change: Beginning in 2022, the questions were asked of every teen.']
  it('draws every note and the page URL under the chart', () => {
    const out = serializeSvg(chart(), '#fffdf8', { title: 'T', notes, url: 'https://example.org/trends/teen/mde_py' }, lookup)
    for (const note of notes) expect(exportText(out, 'note')).toContain(note)
    expect(exportText(out, 'source').replace(/ /g, '')).toContain('https://example.org/trends/teen/mde_py')
    expect(out).not.toContain(CRISIS_TEXT.slice(0, 30))
  })
  it('ends with the 988 note only for suicide measures', () => {
    const out = serializeSvg(chart(), '#fffdf8', { title: 'T', notes, crisis: true }, lookup)
    expect(exportText(out, 'note')).toMatch(/988lifeline\.org to reach the 988 Suicide & Crisis Lifeline, any time\.$/)
  })
  it('wraps at spaces and breaks a long URL after a slash', () => {
    expect(wrapText('one two three four', 9)).toEqual(['one two', 'three', 'four'])
    expect(wrapText('see https://example.org/trends/teen', 20)).toEqual(['see', 'https://example.org/', 'trends/teen'])
  })
})

describe('toCsv', () => {
  it('writes plain headers, percentages to one decimal, quoted commas and empty nulls', () => {
    const csv = toCsv([
      { cohort: 'teen', measure: 'mde_py', measureLabel: 'Major depressive episode in the past year', years: '2024', population: 'teens, ages 12–17', p: 0.14837, lo: 0.13754, hi: 0.15991, n: 10917, suppressed: false, weight: 'ANALWT2_C1' },
      { cohort: 'teen', measure: 'mde_py', measureLabel: 'Major depressive episode in the past year', years: '2021–2024', population: 'teens ages 12–17', p: null, lo: null, hi: null, n: 40, suppressed: true, weight: 'ANALWT2_C4' },
    ])
    expect(csv.startsWith('\ufeff')).toBe(true)
    const [header, first, second] = csv.slice(1).split('\n')
    expect(header).toBe('cohort,measure,measure_label,years,population,estimate_pct,ci_low_pct,ci_high_pct,responses,suppressed,weight_variable')
    expect(first).toBe('teen,mde_py,Major depressive episode in the past year,2024,"teens, ages 12–17",14.8,13.8,16.0,10917,false,ANALWT2_C1')
    expect(second).toBe('teen,mde_py,Major depressive episode in the past year,2021–2024,teens ages 12–17,,,,40,true,ANALWT2_C4')
  })
})
