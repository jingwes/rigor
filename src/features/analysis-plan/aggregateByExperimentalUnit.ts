/**
 * Milestone 7: the ONE resolution Rigor V1 offers for likely pseudoreplication
 * (Section 13 of the spec) - average each experimental unit's usable
 * sub-measurements into a single value, then treat those per-unit means as
 * independent-groups values for inference.
 *
 * This is a derived VIEW, not a mutation: it never touches `dataset.rows` or
 * `dataset.issues` in any way. The original nested `Dataset`, with every raw
 * sub-measurement, is untouched by this module and remains exportable - see
 * `AnalysisFlow.tsx`, which always saves the original `dataset` (not this
 * derived output) into the project file.
 *
 * Only rows without an `"excluded"`-severity `ParsingIssue` are aggregated,
 * following the same convention `buildStatisticsRequest.ts` established.
 *
 * Pure, dependency-free TypeScript - no React, no Pyodide.
 */

import type { Dataset, DatasetRow } from '../../models/Dataset'

export interface UnitAggregate {
  /** The `experimental_unit` value this aggregate summarizes. */
  unit: string
  /** The group this unit belongs to. */
  group: string
  /** Mean of this unit's usable sub-measurements. */
  aggregatedValue: number
  /** How many raw sub-measurement rows contributed to `aggregatedValue`. */
  rawValueCount: number
}

/**
 * A minimal, structured record of the aggregation decision made for a given
 * analysis - the Milestone 7 "audit record" the spec calls for: enough for
 * the report/methods text to state honestly what was done and to how many
 * raw observations, without building a full audit-history system (that is
 * Milestone 11's job).
 */
export interface NestedAggregationResult {
  /** V1 only ever offers one method: the per-unit mean. */
  method: 'mean'
  units: UnitAggregate[]
}

function excludedRowIdSet(dataset: Dataset): Set<string> {
  const excluded = new Set<string>()
  for (const issue of dataset.issues) {
    if (issue.severity === 'excluded' && issue.rowId) {
      excluded.add(issue.rowId)
    }
  }
  return excluded
}

function isUsableNestedRow(row: DatasetRow, excludedRowIds: Set<string>): boolean {
  return (
    row.value !== undefined &&
    row.experimentalUnit !== undefined &&
    row.group !== undefined &&
    !excludedRowIds.has(row.rowId)
  )
}

/**
 * Computes the mean value per experimental unit from a nested `Dataset`'s
 * usable rows. Units are returned in the order they first appear in
 * `dataset.rows`, for stable/reproducible output. Does NOT mutate or filter
 * `dataset.rows` - it only reads from it.
 */
export function aggregateByExperimentalUnit(dataset: Dataset): UnitAggregate[] {
  const excludedRowIds = excludedRowIdSet(dataset)

  const unitOrder: string[] = []
  const sums = new Map<string, { group: string; total: number; count: number }>()

  for (const row of dataset.rows) {
    if (dataset.format !== 'nested') continue
    if (!isUsableNestedRow(row, excludedRowIds)) continue

    const unit = row.experimentalUnit as string
    const group = row.group as string
    const value = row.value as number

    let entry = sums.get(unit)
    if (!entry) {
      entry = { group, total: 0, count: 0 }
      sums.set(unit, entry)
      unitOrder.push(unit)
    }
    entry.total += value
    entry.count += 1
  }

  return unitOrder.map((unit) => {
    const entry = sums.get(unit)
    /* istanbul ignore next -- entry always exists for every id in unitOrder */
    if (!entry) throw new Error(`aggregateByExperimentalUnit: missing entry for unit '${unit}'`)
    return {
      unit,
      group: entry.group,
      aggregatedValue: entry.total / entry.count,
      rawValueCount: entry.count,
    }
  })
}

/** Wraps aggregated units into the Milestone 7 audit record. */
export function summarizeAggregation(units: UnitAggregate[]): NestedAggregationResult {
  return { method: 'mean', units }
}

/**
 * Human-readable "N biological replicates (from M raw measurements)"
 * description used anywhere Rigor displays a sample size after aggregation
 * (Section 13, point 6 of the spec: never collapse the two counts into one
 * ambiguous number).
 */
export function describeAggregationSampleSize(
  aggregation: NestedAggregationResult,
  unitLabel: string,
): string {
  const label = unitLabel.trim() || 'experimental unit'
  const unitCount = aggregation.units.length
  const rawCount = aggregation.units.reduce((sum, unit) => sum + unit.rawValueCount, 0)
  const replicateWord = unitCount === 1 ? 'replicate' : 'replicates'
  const measurementWord = rawCount === 1 ? 'measurement' : 'measurements'
  const unitWord = unitCount === 1 ? label : `${label}s`

  return (
    `${unitCount} biological ${replicateWord} (${unitCount} ${unitWord}), from ${rawCount} raw ` +
    `${measurementWord}. Each ${label}'s raw measurements were averaged into a single value before ` +
    'analysis; the raw measurements themselves are unchanged and remain in your dataset. This ' +
    'averaging approach is a simplification, not necessarily the statistically ideal treatment - ' +
    'more complex nested designs may require mixed-effects models, which this version does not yet ' +
    'support.'
  )
}
