/** Dot shapes that tell series apart without color, on the chart, in its legend and in exported images. */
export const SYMBOLS = ['circle', 'square', 'triangle', 'diamond', 'star'] as const
export type SymbolName = (typeof SYMBOLS)[number]

export type SymbolShape = { tag: 'circle' | 'rect' | 'polygon'; attrs: Record<string, number | string> }

/** Polygon corners as offsets from the centre, for a swatch about 10 px across. */
const POLYGONS: Record<'triangle' | 'diamond' | 'star', [number, number][]> = {
  triangle: [[0, -4.5], [4.5, 3.5], [-4.5, 3.5]],
  diamond: [[0, -5], [5, 0], [0, 5], [-5, 0]],
  star: [[0, -5.2], [1.4, -1.7], [5.2, -1.5], [2.2, 0.9], [3.2, 4.6], [0, 2.5], [-3.2, 4.6], [-2.2, 0.9], [-5.2, -1.5], [-1.4, -1.7]],
}

/** The legend swatch shape for a symbol, centred at (cx, cy); the caller adds the fill. */
export function symbolShape(symbol: SymbolName, cx: number, cy: number): SymbolShape {
  if (symbol === 'circle') return { tag: 'circle', attrs: { cx, cy, r: 4 } }
  if (symbol === 'square') return { tag: 'rect', attrs: { x: cx - 3.5, y: cy - 3.5, width: 7, height: 7 } }
  return { tag: 'polygon', attrs: { points: POLYGONS[symbol].map(([dx, dy]) => `${cx + dx},${cy + dy}`).join(' ') } }
}
