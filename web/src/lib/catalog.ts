/**
 * The web catalog (data/catalog.json, written by python -m pipeline.export_catalog): launch
 * indicators, groups with population phrases, topics and cohorts. Pure helpers only; loading
 * lives in data.ts.
 */
import type { Cohort } from './data'

export type CohortInfo = { id: Cohort; label: string; phrase: string; people: string; ages: string }
export type Topic = { id: string; label: string }
export type Level = { id: string; label: string; phrase: string | null }
export type Group = { id: string; label: string; cohorts: Cohort[]; crosses_only: boolean; phrase: string | null; levels: Level[] }
export type Indicator = {
  id: string
  cohort: Cohort
  topic: string
  label: string
  phrase: string
  /** Denominator clause when the measure is asked only of some of the cohort, e.g. "who had a major depressive episode in the past year"; null for everyone. */
  universe_phrase: string | null
  definition: string
  source: string
  years: number[]
  caveats: string[]
  status: 'launch'
}
export type Catalog = { cohorts: CohortInfo[]; topics: Topic[]; groups: Group[]; indicators: Indicator[] }

export const COHORTS: readonly Cohort[] = ['teen', 'young_adult']
/** Every year in the combined public use file. */
export const SURVEY_YEARS: readonly number[] = [2021, 2022, 2023, 2024]
/** Year sets besides single years: all collected years pooled, and the latest two. */
export const POOLED_YEAR_SETS = ['all', 'recent2'] as const

export function isCohort(value: unknown): value is Cohort {
  return value === 'teen' || value === 'young_adult'
}

export function cohortInfo(catalog: Catalog, cohort: Cohort): CohortInfo {
  const info = catalog.cohorts.find((c) => c.id === cohort)
  if (!info) throw new Error(`Unknown cohort ${cohort}`)
  return info
}

export function indicatorsFor(catalog: Catalog, cohort: Cohort): Indicator[] {
  return catalog.indicators.filter((i) => i.cohort === cohort)
}

export function findIndicator(catalog: Catalog, cohort: Cohort, id: string | null | undefined): Indicator | undefined {
  return id ? catalog.indicators.find((i) => i.cohort === cohort && i.id === id) : undefined
}

export function topicLabel(catalog: Catalog, id: string): string {
  return catalog.topics.find((t) => t.id === id)?.label ?? id
}

/** Topics in display order, each with the cohort's launch indicators in catalog order; empty topics are left out. */
export function indicatorsByTopic(catalog: Catalog, cohort: Cohort): { topic: Topic; indicators: Indicator[] }[] {
  const mine = indicatorsFor(catalog, cohort)
  return catalog.topics
    .map((topic) => ({ topic, indicators: mine.filter((i) => i.topic === topic.id) }))
    .filter((t) => t.indicators.length > 0)
}

function ageRange(label: string): [number, number] | null {
  const m = /^(\d+)–(\d+)$/.exec(label)
  return m ? [Number(m[1]), Number(m[2])] : null
}

/** A group's levels for one cohort: age bands outside the cohort's ages are left out. */
export function levelsFor(catalog: Catalog, cohort: Cohort, group: Group): Level[] {
  const cohortAges = ageRange(cohortInfo(catalog, cohort).ages)
  if (!cohortAges || !group.levels.every((l) => ageRange(l.label))) return group.levels
  return group.levels.filter((l) => {
    const [lo, hi] = ageRange(l.label) as [number, number]
    return lo >= cohortAges[0] && hi <= cohortAges[1]
  })
}

/** Standalone breakdown groups for a cohort (groups that exist only in two-way crosses are left out). */
export function groupsFor(catalog: Catalog, cohort: Cohort): Group[] {
  return catalog.groups.filter((g) => g.cohorts.includes(cohort) && !g.crosses_only)
}

export function findGroup(catalog: Catalog, cohort: Cohort, id: string | null | undefined): Group | undefined {
  return id ? groupsFor(catalog, cohort).find((g) => g.id === id) : undefined
}

export function findLevel(catalog: Catalog, cohort: Cohort, group: Group, id: string | null | undefined): Level | undefined {
  return id ? levelsFor(catalog, cohort, group).find((l) => l.id === id) : undefined
}

/** Fill a phrase template: {cohort} "teens ages 12–17", {people} "teens", {level} the level label. */
export function fillTemplate(template: string, values: { cohort: string; people: string; level: string }): string {
  return template.replace(/\{(cohort|people|level)\}/g, (_, key: keyof typeof values) => values[key])
}

/** Population wording for takeaways: everyone in the cohort, or one group level. */
export function populationPhrase(catalog: Catalog, cohort: Cohort, group?: Group | null, level?: Level | null): string {
  const info = cohortInfo(catalog, cohort)
  if (!group || !level) return info.phrase
  const template = level.phrase ?? group.phrase ?? '{cohort} ({level})'
  return fillTemplate(template, { cohort: info.phrase, people: info.people, level: level.label })
}

/** Append an indicator's denominator clause to a population phrase: "female teens ages 12–17" + "who had a major depressive episode in the past year". */
export function withUniverse(population: string, indicator: Pick<Indicator, 'universe_phrase'> | null | undefined): string {
  return indicator?.universe_phrase ? `${population} ${indicator.universe_phrase}` : population
}

/**
 * Year sets an indicator can have: each collected year, then "all years combined" when there is more
 * than one, then "latest two years combined" when that pools different years from "all".
 */
export function yearSetsFor(indicator: Pick<Indicator, 'years'>): string[] {
  const singles = [...indicator.years].sort((a, b) => a - b).map(String)
  if (indicator.years.length > 2) return [...singles, ...POOLED_YEAR_SETS]
  return indicator.years.length === 2 ? [...singles, 'all'] : singles
}

export function latestYear(indicator: Pick<Indicator, 'years'>): number {
  return Math.max(...indicator.years)
}

export function firstYear(indicator: Pick<Indicator, 'years'>): number {
  return Math.min(...indicator.years)
}

/** The years a year set pools, e.g. "2021–2024" or "2024". */
export function yearSetSpan(yearSet: string, years: number[]): string {
  const sorted = [...years].sort((a, b) => a - b)
  if (yearSet === 'all') return sorted.length > 1 ? `${sorted[0]}–${sorted[sorted.length - 1]}` : String(sorted[0])
  if (yearSet === 'recent2') return sorted.length > 1 ? `${sorted[sorted.length - 2]}–${sorted[sorted.length - 1]}` : String(sorted[0])
  return yearSet
}

/** Picker label for a year set. */
export function yearSetLabel(yearSet: string, years: number[]): string {
  if (yearSet === 'all') return `All years combined (${yearSetSpan('all', years)})`
  if (yearSet === 'recent2') return `Latest two years combined (${yearSetSpan('recent2', years)})`
  return yearSet
}

/** Short wording for a takeaway, e.g. "2024" or "2021–2024 combined". */
export function yearSetWhen(yearSet: string, years: number[]): string {
  return yearSet === 'all' || yearSet === 'recent2' ? `${yearSetSpan(yearSet, years)} combined` : yearSet
}

/** Suicide measures get a 988 note beside every chart and are never ranked. */
export function isSuicideMeasure(indicator: string): boolean {
  return indicator.startsWith('suicide_')
}
