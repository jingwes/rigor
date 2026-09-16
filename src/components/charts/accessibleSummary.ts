/**
 * Milestone 5: screen-reader-accessible text summaries for charts.
 *
 * These are generated from the exact same data/props driving the visual
 * chart, so the text can never drift out of sync with what's rendered.
 * Plain TypeScript - no DOM/React dependency - so it's easy to unit test in
 * isolation.
 */

import { computeInterval, mean, type IntervalType } from './statsMath'

export interface SummaryGroup {
  label: string
  values: number[]
}

const INTERVAL_DESCRIPTIONS: Record<IntervalType, string> = {
  sd: 'standard deviation',
  sem: 'standard error of the mean',
  ci95: '95% confidence interval',
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : 'n/a'
}

/**
 * "Dot plot comparing Control (n=10, mean=5.20) and Treatment (n=12,
 * mean=7.10). Error bars show standard deviation. Individual observations
 * are also shown."
 */
export function describeDotPlot(
  groups: SummaryGroup[],
  intervalType: IntervalType,
): string {
  const groupDescriptions = groups.map((group) => {
    const groupMean = group.values.length > 0 ? mean(group.values) : NaN
    return `${group.label} (n=${group.values.length}, mean=${formatNumber(groupMean)})`
  })

  const comparisonWord = groups.length === 2 ? 'comparing' : 'of'
  const joined =
    groupDescriptions.length <= 1
      ? groupDescriptions.join('')
      : groupDescriptions.slice(0, -1).join(', ') +
        ' and ' +
        groupDescriptions[groupDescriptions.length - 1]

  return (
    `Dot plot ${comparisonWord} ${joined}. ` +
    `Error bars show ${INTERVAL_DESCRIPTIONS[intervalType]}. ` +
    'Individual observations are shown as points; the error bar is an ' +
    'overlay and does not replace them.'
  )
}

export interface SummaryPair {
  id: string
  before: number
  after: number
}

/**
 * "Paired dot plot of Before and After for 8 matched pairs. Mean Before =
 * 5.20, mean After = 7.10. A line connects each matched pair."
 */
export function describePairedDotPlot(
  pairs: SummaryPair[],
  beforeLabel: string,
  afterLabel: string,
): string {
  const beforeMean = pairs.length > 0 ? mean(pairs.map((p) => p.before)) : NaN
  const afterMean = pairs.length > 0 ? mean(pairs.map((p) => p.after)) : NaN

  return (
    `Paired dot plot of ${beforeLabel} and ${afterLabel} for ${pairs.length} ` +
    `matched pair${pairs.length === 1 ? '' : 's'}. Mean ${beforeLabel} = ` +
    `${formatNumber(beforeMean)}, mean ${afterLabel} = ${formatNumber(afterMean)}. ` +
    'A line connects each matched pair so individual within-pair change is ' +
    'visible.'
  )
}

/** Re-exported so callers/tests that only need interval math don't have to
 * import from two places. */
export { computeInterval }

/**
 * Milestone 9: screen-reader-accessible text summary for
 * `CategoricalBarChart`, generated from the exact same
 * groups/categories/counts data driving the visual chart.
 *
 * "Bar chart of recovery status by group. Control (n=30): improved 20
 * (66.7%), not improved 10 (33.3%). Treatment (n=30): improved 10 (33.3%),
 * not improved 20 (66.7%)."
 */
export function describeCategoricalBarChart(
  groupLabels: string[],
  categoryLabels: string[],
  counts: number[][],
  outcomeName?: string,
): string {
  const subject = outcomeName?.trim() ? outcomeName.trim() : 'the outcome'

  const groupDescriptions = groupLabels.map((groupLabel, groupIndex) => {
    const rowCounts = counts[groupIndex] ?? []
    const total = rowCounts.reduce((sum, count) => sum + count, 0)
    const categoryDescriptions = categoryLabels
      .map((categoryLabel, categoryIndex) => {
        const count = rowCounts[categoryIndex] ?? 0
        const percent = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
        return `${categoryLabel} ${count} (${percent}%)`
      })
      .join(', ')
    return `${groupLabel} (n=${total}): ${categoryDescriptions}`
  })

  return (
    `Bar chart of ${subject} by group. ` +
    `${groupDescriptions.join('. ')}. ` +
    'Raw counts are always shown alongside percentages.'
  )
}
