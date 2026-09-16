/**
 * Turning raw parsed rows (from either the paste grid or a CSV upload) into
 * a validated `Dataset`. This is the single place that combines coercion
 * (numeric parsing) with the semantic validation checks in `validation.ts`
 * and any structural issues found while parsing the raw text.
 *
 * Pure function, no React, no I/O.
 */

import type {
  Dataset,
  DatasetFormat,
  DatasetRow,
  ParsingIssue,
} from '../../models/Dataset'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import { COLUMN_TEMPLATES } from './datasetFormat'
import { parseNumericValue } from './numeric'
import { validateDataset } from './validation'
import type { StructuralIssue } from './csvParsing'

let rowIdCounter = 0

function nextRowId(): string {
  rowIdCounter += 1
  return `row-${rowIdCounter}`
}

/** Exposed only so tests can get deterministic, reproducible row ids. */
export function resetRowIdCounterForTests(): void {
  rowIdCounter = 0
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

/** Look up a raw field by its canonical (snake_case) name, tolerant of the
 * exact casing/spacing a student typed in a header. */
function getField(
  raw: Record<string, string>,
  canonicalKey: string,
): string | undefined {
  for (const [key, value] of Object.entries(raw)) {
    if (normalizeHeader(key) === canonicalKey) return value
  }
  return undefined
}

function trimmedOrUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function buildRow(
  format: DatasetFormat,
  raw: Record<string, string>,
  rowId: string,
): DatasetRow {
  const row: DatasetRow = { rowId, raw }

  const value = parseNumericValue(getField(raw, 'value'))
  if (value !== undefined) row.value = value

  if (format === 'independent-groups') {
    row.sampleId = trimmedOrUndefined(getField(raw, 'sample_id'))
    row.group = trimmedOrUndefined(getField(raw, 'group'))
  } else if (format === 'paired') {
    row.subjectId = trimmedOrUndefined(getField(raw, 'subject_id'))
    row.condition = trimmedOrUndefined(getField(raw, 'condition'))
  } else {
    row.experimentalUnit = trimmedOrUndefined(
      getField(raw, 'experimental_unit'),
    )
    row.subsample = trimmedOrUndefined(getField(raw, 'subsample'))
    row.group = trimmedOrUndefined(getField(raw, 'group'))
  }

  return row
}

export interface BuildDatasetInput {
  format: DatasetFormat
  columns: string[]
  rawRows: Record<string, string>[]
  design: ExperimentDesign
  /** Issues found before rows had stable ids (e.g. from CSV parsing). */
  structuralIssues?: StructuralIssue[]
}

export function buildDataset({
  format,
  columns,
  rawRows,
  design,
  structuralIssues = [],
}: BuildDatasetInput): Dataset {
  const rows = rawRows.map((raw) => buildRow(format, raw, nextRowId()))

  const normalizedColumns = new Set(columns.map(normalizeHeader))
  const missingColumnIssues: ParsingIssue[] = COLUMN_TEMPLATES[format].columns
    .filter((expected) => !normalizedColumns.has(expected))
    .map((column) => ({
      field: column,
      severity: 'excluded',
      message:
        `The column '${column}' is required for the ${COLUMN_TEMPLATES[format].label} format, but ` +
        "wasn't found. Any rows that were parsed are still shown below, but this field couldn't be " +
        'filled in for them.',
    }))

  const mappedStructuralIssues: ParsingIssue[] = structuralIssues.map(
    (issue) => ({
      rowId:
        issue.rowIndex !== undefined ? rows[issue.rowIndex]?.rowId : undefined,
      field: issue.field,
      message: issue.message,
      severity: issue.severity,
    }),
  )

  const dataset: Dataset = { format, columns, rows, issues: [] }
  dataset.issues = [
    ...mappedStructuralIssues,
    ...missingColumnIssues,
    ...validateDataset(dataset, design),
  ]

  return dataset
}
