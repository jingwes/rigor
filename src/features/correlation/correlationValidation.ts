/**
 * Milestone 10: validation for the correlation/regression feature's own,
 * small two-column (X, Y) dataset shape.
 *
 * Judgment call: this is deliberately a NEW, purpose-built shape - not the
 * group-comparison `Dataset`/`ParsingIssue` types from
 * `src/models/Dataset.ts`. Those types are built around
 * groups/subjects/conditions/experimental-units-with-subsamples, none of
 * which apply here (there is exactly one X value and one Y value per row,
 * no group column at all). Forcing this feature through that shape would
 * mean leaving most of its fields unused/meaningless. This module is
 * simpler because the feature it serves is simpler, but it follows the same
 * "never silently drop a bad row" principle as
 * `src/features/data-import/validation.ts`: every row is kept and reported,
 * never removed.
 */
import { parseNumericValue } from '../data-import/numeric'

export interface CorrelationRow {
  rowId: string
  unitId?: string
  rawX: string
  rawY: string
  /** Coerced numeric value, present only if `rawX` parsed as a finite number. */
  x?: number
  /** Coerced numeric value, present only if `rawY` parsed as a finite number. */
  y?: number
}

export interface CorrelationValidationIssue {
  rowId?: string
  message: string
  severity: 'excluded' | 'warning'
}

export interface CorrelationValidationOutcome {
  /** Every non-blank row that was at least partially parsed, in original order. */
  rows: CorrelationRow[]
  issues: CorrelationValidationIssue[]
  /**
   * The clean, usable x/y arrays - present only when there is no
   * dataset-level blocking problem (see `blockingMessage`). Rows with any
   * per-row issue (missing/non-numeric/non-finite value) are excluded from
   * these arrays, even though they remain visible in `rows`/`issues`.
   */
  usable?: { x: number[]; y: number[]; n: number }
  /**
   * A dataset-level reason the analysis cannot proceed at all (too few valid
   * rows, or a constant X or Y column) - distinct from a per-row issue.
   * `usable` is `undefined` whenever this is set.
   */
  blockingMessage?: string
}

const MIN_N = 3

function findColumn(columns: string[], candidates: string[]): string | undefined {
  const lower = columns.map((c) => c.trim().toLowerCase())
  for (const candidate of candidates) {
    const index = lower.indexOf(candidate)
    if (index !== -1) return columns[index]
  }
  return undefined
}

function isRowBlank(rawX: string, rawY: string, unitId: string | undefined): boolean {
  return rawX.length === 0 && rawY.length === 0 && !unitId
}

/**
 * Validates rows already parsed into `{column -> raw string}` records
 * (whether from `GridEntry` or from `parseCsvText`). Accepts columns named
 * `x`/`y` (case-insensitive) plus an optional `unit_id` (also accepting
 * `unitid`/`unit`/`id`).
 */
export function validateCorrelationData(
  columns: string[],
  rawRows: Record<string, string>[],
): CorrelationValidationOutcome {
  const xColumn = findColumn(columns, ['x'])
  const yColumn = findColumn(columns, ['y'])
  const unitColumn = findColumn(columns, ['unit_id', 'unitid', 'unit', 'id'])

  if (!xColumn || !yColumn) {
    return {
      rows: [],
      issues: [
        {
          message:
            "Couldn't find an 'x' and a 'y' column - expected columns named 'x' and 'y' " +
            "(optionally with a 'unit_id' column).",
          severity: 'excluded',
        },
      ],
      blockingMessage:
        "This data needs an 'x' column and a 'y' column (optionally 'unit_id').",
    }
  }

  const rows: CorrelationRow[] = []
  const issues: CorrelationValidationIssue[] = []
  const usableX: number[] = []
  const usableY: number[] = []

  rawRows.forEach((rawRow, index) => {
    const rowId = `row-${index}`
    const unitId = unitColumn ? rawRow[unitColumn]?.trim() || undefined : undefined
    const rawX = (rawRow[xColumn] ?? '').trim()
    const rawY = (rawRow[yColumn] ?? '').trim()

    if (isRowBlank(rawX, rawY, unitId)) return

    if (rawX.length === 0) {
      issues.push({ rowId, message: `Row ${index + 1} is missing an X value.`, severity: 'excluded' })
      rows.push({ rowId, unitId, rawX, rawY })
      return
    }
    if (rawY.length === 0) {
      issues.push({ rowId, message: `Row ${index + 1} is missing a Y value.`, severity: 'excluded' })
      rows.push({ rowId, unitId, rawX, rawY })
      return
    }

    const x = parseNumericValue(rawX)
    const y = parseNumericValue(rawY)

    if (x === undefined) {
      issues.push({
        rowId,
        message: `Row ${index + 1}: X value '${rawX}' is not a number.`,
        severity: 'excluded',
      })
      rows.push({ rowId, unitId, rawX, rawY })
      return
    }
    if (y === undefined) {
      issues.push({
        rowId,
        message: `Row ${index + 1}: Y value '${rawY}' is not a number.`,
        severity: 'excluded',
      })
      rows.push({ rowId, unitId, rawX, rawY })
      return
    }
    if (!Number.isFinite(x)) {
      issues.push({
        rowId,
        message: `Row ${index + 1}: X value '${rawX}' is infinite and cannot be used.`,
        severity: 'excluded',
      })
      rows.push({ rowId, unitId, rawX, rawY, y })
      return
    }
    if (!Number.isFinite(y)) {
      issues.push({
        rowId,
        message: `Row ${index + 1}: Y value '${rawY}' is infinite and cannot be used.`,
        severity: 'excluded',
      })
      rows.push({ rowId, unitId, rawX, rawY, x })
      return
    }

    rows.push({ rowId, unitId, rawX, rawY, x, y })
    usableX.push(x)
    usableY.push(y)
  })

  let blockingMessage: string | undefined

  if (usableX.length < MIN_N) {
    blockingMessage =
      `At least ${MIN_N} valid rows are needed to compute a correlation - only ` +
      `${usableX.length} valid row${usableX.length === 1 ? '' : 's'} found.`
  } else if (new Set(usableX).size === 1) {
    blockingMessage =
      `Every valid X value is the same (${usableX[0]}) - correlation and regression are ` +
      'undefined when X never varies.'
  } else if (new Set(usableY).size === 1) {
    blockingMessage =
      `Every valid Y value is the same (${usableY[0]}) - correlation and regression are ` +
      'undefined when Y never varies.'
  }

  return {
    rows,
    issues,
    usable: blockingMessage ? undefined : { x: usableX, y: usableY, n: usableX.length },
    blockingMessage,
  }
}
