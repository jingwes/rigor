/**
 * The typed schema for a dataset entered or uploaded by a student in
 * Milestone 3 (data entry / import).
 *
 * The guiding rule for this whole module: never delete or silently "clean
 * up" a value, even one that looks malformed. Every row that was at least
 * partially parsed is kept in `Dataset.rows`, forever, for the lifetime of
 * this in-memory dataset. Problems are surfaced as `ParsingIssue`s that
 * point at the row/field they concern, so a student can see exactly what
 * happened and fix it themselves - Rigor never guesses on their behalf.
 *
 * This module has no dependency on React, Papa Parse, or any parsing logic -
 * it only defines the shape of the data those layers produce.
 */

/** The three column layouts Rigor understands (Section 14 of the spec). */
export type DatasetFormat = 'independent-groups' | 'paired' | 'nested'

/**
 * A single row of data, in whatever state it was parsed. `raw` always holds
 * every column exactly as it was entered/parsed, before any coercion -
 * nothing here is ever computed by discarding `raw` data.
 */
export interface DatasetRow {
  /** Stable id for this row, generated at import/entry time. */
  rowId: string
  /** Exactly what was parsed for this row, before any type coercion. */
  raw: Record<string, string>

  // --- independent-groups format ---
  /** The `sample_id` column, for the independent-groups format. */
  sampleId?: string
  group?: string
  /** Coerced numeric value, if the raw value string parsed as a valid number. */
  value?: number

  // --- paired format ---
  subjectId?: string
  /** e.g. "before"/"after" - the two condition labels for paired data. */
  condition?: string

  // --- nested format ---
  experimentalUnit?: string
  subsample?: string
}

export type IssueSeverity = 'excluded' | 'warning'

export interface ParsingIssue {
  /** Which row this concerns, if applicable. Absent for dataset-wide issues. */
  rowId?: string
  /** Which field/column this concerns, if applicable. */
  field?: string
  /** Human-readable, specific explanation (e.g. "value 'ten' is not a number"). */
  message: string
  /**
   * "excluded" = this observation could not be used for analysis.
   * "warning" = kept, but flagged for the student's attention.
   *
   * Either way, the row this refers to is never removed from `Dataset.rows`.
   */
  severity: IssueSeverity
}

export interface Dataset {
  format: DatasetFormat
  /** Column headers, in the order they were found (or entered). */
  columns: string[]
  /**
   * Every row that was at least partially parsed, INCLUDING ones with
   * issues. Rows are never deleted because of a validation problem - they
   * are marked via `issues` (matched by `rowId`) instead.
   */
  rows: DatasetRow[]
  /** All issues found while parsing and validating this dataset. */
  issues: ParsingIssue[]
}
