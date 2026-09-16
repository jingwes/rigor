/**
 * Milestone 6: converts a validated Milestone 3 `Dataset` (plus the
 * `ExperimentDesign` it belongs to) into the exact typed payload the
 * Milestone 4 statistics worker expects for one of the two analyses this
 * version of Rigor supports: `welch-two-sample-t-test` (independent-groups
 * data) or `paired-t-test` (paired data).
 *
 * Pure, dependency-free TypeScript - no React, no Pyodide, no knowledge of
 * `workerClient.ts`. Independently testable in isolation.
 *
 * --- The `a`/`b` <-> named-group mapping -----------------------------------
 * `WelchTwoSampleTTestPayload`/`PairedTTestPayload` only know about "group a"
 * and "group b" - they have no idea what a student called their groups. This
 * module fixes that mapping by POSITION in `design.groups.names`:
 *
 *   design.groups.names[0]  -> "a"
 *   design.groups.names[1]  -> "b"
 *
 * The returned `groupALabel`/`groupBLabel` carry those two names back out,
 * so a caller can correctly attribute "group A is which named group" when
 * displaying `meanDifference = mean(a) - mean(b)` (etc.) to a student.
 *
 * --- Exclusion handling ------------------------------------------------------
 * A row is only ever included in the numeric arrays sent to the worker when
 * it has NO `"excluded"`-severity `ParsingIssue` attached to its `rowId`.
 * Rows with only `"warning"`-severity issues (kept-but-flagged, per
 * Milestone 3) ARE included - excluding them here would silently throw away
 * data Milestone 3 deliberately chose to keep.
 */

import type { Dataset, DatasetRow } from '../../models/Dataset'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type {
  PairedTTestPayload,
  WelchTwoSampleTTestPayload,
} from '../../statistics/types'
import type { UnitAggregate } from './aggregateByExperimentalUnit'

const MIN_USABLE_VALUES_PER_ARM = 2

export type SupportedStatisticsAnalysisType =
  | 'welch-two-sample-t-test'
  | 'paired-t-test'

export type BuildStatisticsRequestResult =
  | {
      status: 'ready'
      request:
        | {
            analysisType: 'welch-two-sample-t-test'
            payload: WelchTwoSampleTTestPayload
          }
        | { analysisType: 'paired-t-test'; payload: PairedTTestPayload }
      /** The design's group name mapped to the payload's `a` array. */
      groupALabel: string
      /** The design's group name mapped to the payload's `b` array. */
      groupBLabel: string
    }
  | { status: 'insufficient-data'; message: string }

function excludedRowIdSet(dataset: Dataset): Set<string> {
  const excluded = new Set<string>()
  for (const issue of dataset.issues) {
    if (issue.severity === 'excluded' && issue.rowId) {
      excluded.add(issue.rowId)
    }
  }
  return excluded
}

function isUsableRow(row: DatasetRow, excludedRowIds: Set<string>): boolean {
  return row.value !== undefined && !excludedRowIds.has(row.rowId)
}

function buildIndependentGroupsRequest(
  design: ExperimentDesign,
  dataset: Dataset,
): BuildStatisticsRequestResult {
  const [groupALabel, groupBLabel] = design.groups.names

  if (!groupALabel || !groupBLabel) {
    return {
      status: 'insufficient-data',
      message:
        'This analysis needs exactly two named groups from your experiment design, but two ' +
        "names weren't available.",
    }
  }

  const excludedRowIds = excludedRowIdSet(dataset)
  const a: number[] = []
  const b: number[] = []

  for (const row of dataset.rows) {
    if (dataset.format !== 'independent-groups') continue
    if (!isUsableRow(row, excludedRowIds)) continue
    if (row.group === groupALabel) a.push(row.value as number)
    else if (row.group === groupBLabel) b.push(row.value as number)
    // Rows whose `group` doesn't match either declared name are not
    // silently guessed into one arm or the other - they're simply not
    // counted (the data-import preview already flags this mismatch as a
    // warning; see `checkGroupNameConsistency`).
  }

  if (a.length < MIN_USABLE_VALUES_PER_ARM || b.length < MIN_USABLE_VALUES_PER_ARM) {
    return {
      status: 'insufficient-data',
      message:
        `Not enough valid data to run this analysis yet: '${groupALabel}' has ${a.length} usable ` +
        `value(s) and '${groupBLabel}' has ${b.length}, but each group needs at least ` +
        `${MIN_USABLE_VALUES_PER_ARM}. Excluded or missing values don't count - check the data ` +
        'preview above for what was flagged.',
    }
  }

  return {
    status: 'ready',
    request: { analysisType: 'welch-two-sample-t-test', payload: { a, b } },
    groupALabel,
    groupBLabel,
  }
}

function buildPairedRequest(
  design: ExperimentDesign,
  dataset: Dataset,
): BuildStatisticsRequestResult {
  const [groupALabel, groupBLabel] = design.groups.names

  if (!groupALabel || !groupBLabel) {
    return {
      status: 'insufficient-data',
      message:
        'This analysis needs exactly two named conditions from your experiment design, but two ' +
        "names weren't available.",
    }
  }

  const excludedRowIds = excludedRowIdSet(dataset)

  // Pivot rows by subjectId -> { conditionLabel -> value }, preserving the
  // order subjects first appear in `dataset.rows` so the two output arrays
  // stay in a stable, reproducible subject order.
  const subjectOrder: string[] = []
  const valuesBySubject = new Map<string, Map<string, number>>()

  for (const row of dataset.rows) {
    if (dataset.format !== 'paired') continue
    if (!isUsableRow(row, excludedRowIds)) continue
    if (!row.subjectId || !row.condition) continue

    let conditions = valuesBySubject.get(row.subjectId)
    if (!conditions) {
      conditions = new Map()
      valuesBySubject.set(row.subjectId, conditions)
      subjectOrder.push(row.subjectId)
    }
    conditions.set(row.condition, row.value as number)
  }

  const a: number[] = []
  const b: number[] = []

  for (const subjectId of subjectOrder) {
    const conditions = valuesBySubject.get(subjectId)
    const aValue = conditions?.get(groupALabel)
    const bValue = conditions?.get(groupBLabel)
    // Only subjects with BOTH conditions present (and not excluded) form a
    // usable pair - a subject missing one side contributes nothing rather
    // than being padded/guessed.
    if (aValue !== undefined && bValue !== undefined) {
      a.push(aValue)
      b.push(bValue)
    }
  }

  if (a.length < MIN_USABLE_VALUES_PER_ARM) {
    return {
      status: 'insufficient-data',
      message:
        `Not enough valid paired data to run this analysis yet: only ${a.length} subject(s) have ` +
        `usable measurements for both '${groupALabel}' and '${groupBLabel}', but at least ` +
        `${MIN_USABLE_VALUES_PER_ARM} complete pairs are needed. Excluded or missing values ` +
        "don't count - check the data preview above for what was flagged.",
    }
  }

  return {
    status: 'ready',
    request: { analysisType: 'paired-t-test', payload: { a, b } },
    groupALabel,
    groupBLabel,
  }
}

/**
 * Milestone 7: builds a `welch-two-sample-t-test` request from per-unit
 * AGGREGATED values (one mean value per experimental unit - see
 * `aggregateByExperimentalUnit.ts`) rather than from raw dataset rows. This
 * is the resolution to likely pseudoreplication in a nested dataset: once a
 * student has confirmed the "aggregate within experimental unit" step, each
 * unit's mean is treated as a single independent-groups observation, matched
 * to the unit's group by the same `design.groups.names` position mapping
 * `buildIndependentGroupsRequest` uses.
 *
 * `aggregates` is expected to already be filtered to usable rows (see
 * `aggregateByExperimentalUnit`) - this function does not re-derive
 * exclusion, it only maps units to the two named groups.
 */
export function buildStatisticsRequestFromAggregatedUnits(
  design: ExperimentDesign,
  aggregates: UnitAggregate[],
): BuildStatisticsRequestResult {
  const [groupALabel, groupBLabel] = design.groups.names

  if (!groupALabel || !groupBLabel) {
    return {
      status: 'insufficient-data',
      message:
        'This analysis needs exactly two named groups from your experiment design, but two ' +
        "names weren't available.",
    }
  }

  const a: number[] = []
  const b: number[] = []

  for (const unit of aggregates) {
    if (unit.group === groupALabel) a.push(unit.aggregatedValue)
    else if (unit.group === groupBLabel) b.push(unit.aggregatedValue)
    // As with the raw-row path, a unit whose group doesn't match either
    // declared name is not silently guessed into an arm - it's just not
    // counted.
  }

  if (a.length < MIN_USABLE_VALUES_PER_ARM || b.length < MIN_USABLE_VALUES_PER_ARM) {
    return {
      status: 'insufficient-data',
      message:
        `Not enough usable experimental units to run this analysis after averaging technical ` +
        `replicates: '${groupALabel}' has ${a.length} unit(s) and '${groupBLabel}' has ${b.length}, ` +
        `but each group needs at least ${MIN_USABLE_VALUES_PER_ARM}. Excluded or missing values ` +
        "don't count - check the data preview above for what was flagged.",
    }
  }

  return {
    status: 'ready',
    request: { analysisType: 'welch-two-sample-t-test', payload: { a, b } },
    groupALabel,
    groupBLabel,
  }
}

/**
 * Builds the statistics-worker request for one of the two analyses this
 * version of Rigor computes, from a design + its validated dataset. Callers
 * are expected to have already confirmed (via `recommendAnalysis(design)`)
 * that `analysisType` is the recommended, `status: 'supported'` analysis for
 * this design - this function does not re-derive that decision, it only
 * extracts the right numbers for whichever analysis it's told to build.
 */
export function buildStatisticsRequest(
  design: ExperimentDesign,
  dataset: Dataset,
  analysisType: SupportedStatisticsAnalysisType,
): BuildStatisticsRequestResult {
  if (analysisType === 'welch-two-sample-t-test') {
    return buildIndependentGroupsRequest(design, dataset)
  }
  return buildPairedRequest(design, dataset)
}
