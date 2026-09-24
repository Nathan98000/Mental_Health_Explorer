/** Direct-label helpers for the trend chart (pure; see components/TrendChart.tsx). */

/** Below this container width the chart drops its end labels; the legend alone names the series. */
export const NARROW_WIDTH = 560
/** Fixed right margin for end labels, so the x axis stays put when the split changes. */
export const LABEL_MARGIN_RIGHT = 200
export const NARROW_MARGIN_RIGHT = 16
/** Minimum vertical distance between end-label baselines, in pixels (a 13 px label box is about 16 px tall). */
export const LABEL_GAP = 16
export const LABEL_MAX_CHARS = 24

/** Shorten a series name for its end label; the full name stays in the legend, tooltip and table. */
export function truncateLabel(text: string, max = LABEL_MAX_CHARS): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/**
 * Greedy vertical dodge in pixel space: labels keep their order, are pushed down until each is
 * at least `gap` from the one above, then pulled back up from `max` so they stay in the plot.
 */
export function dodgeLabels(ys: number[], gap = LABEL_GAP, min = -Infinity, max = Infinity): number[] {
  const order = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b])
  const out = [...ys]
  let floor = min
  for (const i of order) {
    out[i] = Math.max(out[i], floor)
    floor = out[i] + gap
  }
  let ceiling = max
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k]
    out[i] = Math.min(out[i], ceiling)
    ceiling = out[i] - gap
  }
  return out
}
