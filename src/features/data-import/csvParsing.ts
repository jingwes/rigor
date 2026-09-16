/**
 * Client-side CSV parsing with Papa Parse. This module never sends the file
 * or its parsed contents anywhere - it only reads the text already in the
 * browser's memory and returns structured data plus issues.
 */

import Papa from 'papaparse'
import type { IssueSeverity } from '../../models/Dataset'

/** A structural issue found before rows have been assigned stable ids. */
export interface StructuralIssue {
  /** Index into `rawRows`, if this concerns one specific row. */
  rowIndex?: number
  field?: string
  message: string
  severity: IssueSeverity
}

export interface ParsedCsv {
  columns: string[]
  rawRows: Record<string, string>[]
  issues: StructuralIssue[]
}

/**
 * Parse raw CSV text (already read from a File, in-browser) into columns +
 * rows, surfacing Papa Parse's own structural errors (wrong field count,
 * etc.) plus this app's own structural checks (empty file, header-only
 * file).
 */
export function parseCsvText(csvText: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
  })

  const columns = result.meta.fields ?? []
  const rawRows = result.data.map((row) => normalizeRow(row, columns))

  const issues: StructuralIssue[] = []

  if (columns.length === 0) {
    issues.push({
      severity: 'excluded',
      message:
        'This file appears to be empty - no header row could be found. Nothing could be imported.',
    })
  } else if (rawRows.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'This file has a header row but no data rows yet.',
    })
  }

  for (const error of result.errors) {
    issues.push({
      rowIndex: error.row,
      severity: 'excluded',
      message:
        error.row !== undefined
          ? `Row ${error.row + 2} of the file: ${error.message} (${error.code}).`
          : `${error.message} (${error.code}).`,
    })
  }

  return { columns, rawRows, issues }
}

function normalizeRow(
  row: Record<string, string | undefined>,
  columns: string[],
): Record<string, string> {
  const normalized: Record<string, string> = {}
  for (const column of columns) {
    normalized[column] = row[column] ?? ''
  }
  return normalized
}
