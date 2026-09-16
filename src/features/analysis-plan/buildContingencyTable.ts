/**
 * Milestone 9: builds a groups x outcome-categories contingency table from a
 * validated Milestone 3 `Dataset` and the `ExperimentDesign` it belongs to.
 *
 * Pure, dependency-free TypeScript - no React, no Pyodide. Only the
 * independent-groups dataset format is supported here (binary/categorical
 * outcomes with pairing/nesting are out of scope for this milestone).
 *
 * --- Rows/columns ------------------------------------------------------------
 * Rows are the design's named groups, in `design.groups.names` order (the
 * same convention `buildStatisticsRequest.ts` uses). Columns are the
 * distinct outcome-category labels actually observed in usable data, in the
 * order they were first encountered while scanning rows - there is no
 * predefined "expected" set of categories to fall back on, since a
 * categorical/binary outcome's values are free-text labels, not numbers
 * (see `models/Dataset.ts`: `DatasetRow.value` stays `undefined` for these
 * rows, and the category label lives in `raw.value`/`raw.Value`).
 *
 * --- Exclusion handling --------------------------------------------------
 * A row is only ever counted when it has NO `"excluded"`-severity
 * `ParsingIssue` attached to its `rowId` - the same convention
 * `buildStatisticsRequest.ts` uses. Rows with only `"warning"`-severity
 * issues ARE counted.
 *
 * --- Insufficient data -----------------------------------------------------
 * This refuses to build a degenerate table (fewer than 2 declared groups,
 * fewer than 2 observed outcome categories, or any declared group ending up
 * with zero usable observations) rather than silently producing a table
 * that would make chi-square/Fisher's exact undefined.
 */

import type { Dataset, DatasetRow } from '../../models/Dataset'
import type { ExperimentDesign } from '../../models/ExperimentDesign'

const MIN_GROUPS = 2
const MIN_CATEGORIES = 2

export interface ContingencyTable {
  /** Group names, in `design.groups.names` order - the table's row labels. */
  rowLabels: string[]
  /** Outcome category labels, in first-observed order - the table's column labels. */
  colLabels: string[]
  /** `counts[rowIndex][colIndex]` = usable observation count for that group/category pair. */
  counts: number[][]
}

export type BuildContingencyTableResult =
  | { status: 'ready'; table: ContingencyTable }
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

/**
 * The raw outcome-category label for a row, exactly as entered - never
 * numerically coerced (there is no `row.value` for a categorical/binary
 * outcome; see `models/Dataset.ts`). Mirrors the same tolerant `value`/
 * `Value` header lookup `validation.ts`'s `rawValueOf` uses.
 */
function categoryLabelOf(row: DatasetRow): string | undefined {
  const raw = (row.raw.value ?? row.raw.Value ?? '').trim()
  return raw.length > 0 ? raw : undefined
}

/**
 * Builds a contingency table for a categorical/binary outcome from a design
 * + its validated independent-groups dataset. Callers are expected to have
 * already confirmed (via `recommendAnalysis(design)`) that
 * `'categorical-association'` is the recommended, `status: 'supported'`
 * analysis for this design - this function does not re-derive that
 * decision.
 */
export function buildContingencyTable(
  design: ExperimentDesign,
  dataset: Dataset,
): BuildContingencyTableResult {
  if (dataset.format !== 'independent-groups') {
    return {
      status: 'insufficient-data',
      message:
        'This analysis currently only supports the independent-groups data format - a paired or ' +
        'nested categorical/binary dataset is not reconciled with a contingency-table analysis in ' +
        'this version of Rigor.',
    }
  }

  const rowLabels = design.groups.names.filter((name) => name.trim().length > 0)
  if (rowLabels.length < MIN_GROUPS) {
    return {
      status: 'insufficient-data',
      message:
        `This analysis needs at least ${MIN_GROUPS} named groups from your experiment design, but ` +
        `only ${rowLabels.length} ${rowLabels.length === 1 ? 'was' : 'were'} available.`,
    }
  }

  const excludedRowIds = excludedRowIdSet(dataset)
  const rowIndexByLabel = new Map(rowLabels.map((label, index) => [label, index]))

  const colLabels: string[] = []
  const colIndexByLabel = new Map<string, number>()
  const countsByRow: number[][] = rowLabels.map(() => [])

  for (const row of dataset.rows) {
    if (excludedRowIds.has(row.rowId)) continue
    if (row.group === undefined || !rowIndexByLabel.has(row.group)) continue

    const category = categoryLabelOf(row)
    if (category === undefined) continue

    let colIndex = colIndexByLabel.get(category)
    if (colIndex === undefined) {
      colIndex = colLabels.length
      colIndexByLabel.set(category, colIndex)
      colLabels.push(category)
      // Every row's array grows in lockstep, so all rows always have the
      // same length even when a new category is first seen partway through.
      for (const rowCounts of countsByRow) rowCounts.push(0)
    }

    const rowIndex = rowIndexByLabel.get(row.group) as number
    countsByRow[rowIndex][colIndex] += 1
  }

  if (colLabels.length < MIN_CATEGORIES) {
    return {
      status: 'insufficient-data',
      message:
        `This analysis needs at least ${MIN_CATEGORIES} distinct outcome categories in your data, ` +
        `but only ${colLabels.length} ${colLabels.length === 1 ? 'was' : 'were'} found. Excluded or ` +
        "missing values don't count - check the data preview above for what was flagged.",
    }
  }

  const emptyGroups = rowLabels.filter(
    (_label, index) => countsByRow[index].reduce((sum, count) => sum + count, 0) === 0,
  )
  if (emptyGroups.length > 0) {
    return {
      status: 'insufficient-data',
      message:
        `Not enough usable data to run this analysis yet: ${emptyGroups.map((g) => `'${g}'`).join(', ')} ` +
        `${emptyGroups.length === 1 ? 'has' : 'have'} no usable observations. Excluded or missing ` +
        "values don't count - check the data preview above for what was flagged.",
    }
  }

  return {
    status: 'ready',
    table: { rowLabels, colLabels, counts: countsByRow },
  }
}
