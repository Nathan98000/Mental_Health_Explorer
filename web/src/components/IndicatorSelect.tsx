import { indicatorsByTopic, type Catalog } from '../lib/catalog'
import type { Cohort } from '../lib/data'

type Props = { catalog: Catalog; cohort: Cohort; value: string; onChange: (indicator: string) => void; id: string }

/** Native select of the cohort's launch indicators, grouped by topic; the title carries the full text of the choice. */
export function IndicatorSelect({ catalog, cohort, value, onChange, id }: Props) {
  const topics = indicatorsByTopic(catalog, cohort)
  const selected = topics.flatMap((t) => t.indicators).find((i) => i.id === value)
  return (
    <select id={id} value={value} title={selected?.label} onChange={(e) => onChange(e.target.value)} className="w-full max-w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink">
      {topics.map(({ topic, indicators }) => (
        <optgroup key={topic.id} label={topic.label}>
          {indicators.map((i) => (
            <option key={i.id} value={i.id}>{i.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
