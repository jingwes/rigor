/**
 * Milestone 7: technical-replicate / pseudoreplication detection.
 *
 * Section 13 of the project spec: raw sub-measurements taken from the same
 * experimental unit (e.g. 20 cells from one mouse) are not automatically
 * independent biological replicates. This module only DETECTS the situation
 * and produces an honest, example-grounded `Warning` describing it, using
 * the real counts found in the dataset - it never decides what to do about
 * it (that is `aggregateByExperimentalUnit.ts`'s job) and never guesses at a
 * statistical treatment.
 *
 * Pure, dependency-free TypeScript operating only on a Milestone 3 `Dataset`
 * (format `"nested"`) - no React, no knowledge of `ExperimentDesign`'s
 * `relationship` field (that scoping decision belongs to the caller, e.g.
 * `AnalysisFlow.tsx`). An optional `unitLabel` may be passed in purely to
 * make the generated message read naturally (e.g. "mouse" instead of the
 * generic "experimental unit") - it never changes the detection logic.
 *
 * Only rows without an `"excluded"`-severity `ParsingIssue` are counted,
 * following the same convention `buildStatisticsRequest.ts` established.
 */

import type { Dataset, DatasetRow } from '../models/Dataset'
import type { Warning } from './types'

const DEFAULT_UNIT_LABEL = 'experimental unit'

export interface UnitReplicationCount {
  /** The `experimental_unit` value this count is for. */
  unit: string
  /** The group this unit belongs to. */
  group: string
  /** Usable (non-excluded, numeric) sub-measurement rows for this unit. */
  usableRowCount: number
}

export interface PseudoreplicationSummary {
  /** One entry per distinct experimental unit with at least one usable row. */
  unitCounts: UnitReplicationCount[]
  /** Distinct experimental unit count, per group. */
  unitsByGroup: Record<string, number>
  /** Total distinct experimental units across all groups. */
  totalUnits: number
  /** Total usable raw (sub-measurement) rows across all units. */
  totalUsableRows: number
  /**
   * True when at least one experimental unit has more than one usable
   * sub-measurement - the condition under which raw-row count would
   * overstate the true (biological-replicate) sample size.
   */
  isLikelyPseudoreplication: boolean
  /** Present only when `isLikelyPseudoreplication` is true. */
  warning?: Warning
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

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`
}

function buildPseudoreplicationWarning(
  unitCounts: UnitReplicationCount[],
  unitLabel: string,
): Warning {
  const counts = unitCounts.map((unit) => unit.usableRowCount)
  const totalRaw = counts.reduce((sum, count) => sum + count, 0)
  const totalUnits = unitCounts.length
  const min = Math.min(...counts)
  const max = Math.max(...counts)

  const perUnitDescription =
    min === max
      ? `${max} ${pluralize(max, 'measurement')} from each of ${totalUnits} ` +
        `${pluralize(totalUnits, unitLabel)}`
      : `between ${min} and ${max} measurements from each of ${totalUnits} ` +
        `${pluralize(totalUnits, unitLabel)} (${totalRaw} raw measurements in total)`

  const message =
    `You measured ${perUnitDescription}. Measurements taken from the same ${unitLabel} are not ` +
    `automatically ${totalRaw} independent biological replicates - they tend to be more similar to ` +
    `each other than to measurements from a different ${unitLabel}. Your experimental sample size may ` +
    `be ${totalUnits} ${pluralize(totalUnits, unitLabel)} rather than ${totalRaw} raw measurements.`

  return {
    id: 'pseudoreplication-nested-technical-replicates',
    message,
    severity: 'caution',
  }
}

/**
 * Analyzes a nested-format `Dataset` for likely pseudoreplication: multiple
 * usable sub-measurements clustered within the same experimental unit. Never
 * mutates `dataset` - purely a read/derive.
 */
export function analyzeReplicationStructure(
  dataset: Dataset,
  options: { unitLabel?: string } = {},
): PseudoreplicationSummary {
  const excludedRowIds = excludedRowIdSet(dataset)
  const unitLabel = options.unitLabel?.trim() || DEFAULT_UNIT_LABEL

  const countsByUnit = new Map<string, { group: string; count: number }>()

  for (const row of dataset.rows) {
    if (dataset.format !== 'nested') continue
    if (!isUsableNestedRow(row, excludedRowIds)) continue

    const unit = row.experimentalUnit as string
    const group = row.group as string
    const existing = countsByUnit.get(unit)
    if (existing) {
      existing.count += 1
    } else {
      countsByUnit.set(unit, { group, count: 1 })
    }
  }

  const unitCounts: UnitReplicationCount[] = [...countsByUnit.entries()].map(
    ([unit, { group, count }]) => ({ unit, group, usableRowCount: count }),
  )

  const unitsByGroup: Record<string, number> = {}
  let totalUsableRows = 0
  for (const unitCount of unitCounts) {
    unitsByGroup[unitCount.group] = (unitsByGroup[unitCount.group] ?? 0) + 1
    totalUsableRows += unitCount.usableRowCount
  }

  const isLikelyPseudoreplication = unitCounts.some((unit) => unit.usableRowCount > 1)

  return {
    unitCounts,
    unitsByGroup,
    totalUnits: unitCounts.length,
    totalUsableRows,
    isLikelyPseudoreplication,
    warning: isLikelyPseudoreplication
      ? buildPseudoreplicationWarning(unitCounts, unitLabel)
      : undefined,
  }
}
