/**
 * Milestone 3 data-validation rules.
 *
 * Every function here is pure: given a `Dataset` (and, where relevant, the
 * `ExperimentDesign` that describes what the data is supposed to look like),
 * it returns `ParsingIssue`s. It never mutates or removes rows - issues are
 * always additive, attached by `rowId`/`field` so a student can trace every
 * flag back to the exact place in their data.
 *
 * This is intentionally separate from `src/rules/analysisRules.ts`: that
 * engine reasons about which *analysis* fits a design. This module only
 * checks whether entered *data* is well-formed enough to describe honestly.
 */

import type {
  Dataset,
  DatasetRow,
  IssueSeverity,
  ParsingIssue,
} from '../../models/Dataset'
import type {
  ExperimentDesign,
  OutcomeType,
} from '../../models/ExperimentDesign'

const MIN_UNITS_PER_GROUP = 3

function makeIssue(
  severity: IssueSeverity,
  message: string,
  rowId?: string,
  field?: string,
): ParsingIssue {
  return { severity, message, rowId, field }
}

function rawValueOf(row: DatasetRow): string {
  return (row.raw.value ?? row.raw.Value ?? '').trim()
}

/** Missing identifier columns: sample id / subject id + condition / unit + subsample. */
export function checkMissingIdentifiers(dataset: Dataset): ParsingIssue[] {
  const issues: ParsingIssue[] = []

  for (const row of dataset.rows) {
    if (dataset.format === 'independent-groups' && !row.sampleId) {
      issues.push(
        makeIssue(
          'excluded',
          'This row is missing a sample ID.',
          row.rowId,
          'sampleId',
        ),
      )
    }
    if (dataset.format === 'paired') {
      if (!row.subjectId) {
        issues.push(
          makeIssue(
            'excluded',
            'This row is missing a subject ID.',
            row.rowId,
            'subjectId',
          ),
        )
      }
      if (!row.condition) {
        issues.push(
          makeIssue(
            'excluded',
            'This row is missing its condition label.',
            row.rowId,
            'condition',
          ),
        )
      }
    }
    if (dataset.format === 'nested') {
      if (!row.experimentalUnit) {
        issues.push(
          makeIssue(
            'excluded',
            'This row is missing an experimental unit ID.',
            row.rowId,
            'experimentalUnit',
          ),
        )
      }
      if (!row.subsample) {
        issues.push(
          makeIssue(
            'excluded',
            'This row is missing a subsample ID.',
            row.rowId,
            'subsample',
          ),
        )
      }
    }
  }

  return issues
}

/** Missing group labels, for the two formats that have a `group` column. */
export function checkMissingGroupLabels(dataset: Dataset): ParsingIssue[] {
  if (dataset.format !== 'independent-groups' && dataset.format !== 'nested')
    return []

  return dataset.rows
    .filter((row) => !row.group)
    .map((row) =>
      makeIssue(
        'excluded',
        'This row is missing a group label.',
        row.rowId,
        'group',
      ),
    )
}

/** Missing outcome values (the raw `value` cell was left blank). */
export function checkMissingValues(dataset: Dataset): ParsingIssue[] {
  return dataset.rows
    .filter((row) => rawValueOf(row).length === 0)
    .map((row) =>
      makeIssue('excluded', 'This row is missing a value.', row.rowId, 'value'),
    )
}

/**
 * Non-numeric / infinite values, validated according to the design's
 * declared outcome type - never assumed. Rows with a blank value are
 * skipped here (handled by `checkMissingValues`) to avoid double-flagging.
 */
export function checkNumericOutcomeValues(
  dataset: Dataset,
  outcomeType: OutcomeType,
): ParsingIssue[] {
  if (
    outcomeType !== 'continuous' &&
    outcomeType !== 'count' &&
    outcomeType !== 'proportion'
  ) {
    return []
  }

  const issues: ParsingIssue[] = []

  for (const row of dataset.rows) {
    const raw = rawValueOf(row)
    if (raw.length === 0) continue

    if (row.value === undefined) {
      issues.push(
        makeIssue(
          'excluded',
          `Value '${raw}' is not a number.`,
          row.rowId,
          'value',
        ),
      )
      continue
    }

    if (!Number.isFinite(row.value)) {
      issues.push(
        makeIssue(
          'excluded',
          `Value '${raw}' is infinite (not a finite number) and cannot be used.`,
          row.rowId,
          'value',
        ),
      )
      continue
    }

    if (outcomeType === 'count') {
      if (!Number.isInteger(row.value)) {
        issues.push(
          makeIssue(
            'warning',
            `Value ${row.value} is not a whole number, but this outcome is a count.`,
            row.rowId,
            'value',
          ),
        )
      }
      if (row.value < 0) {
        issues.push(
          makeIssue(
            'excluded',
            `Value ${row.value} is negative, but a count cannot be negative.`,
            row.rowId,
            'value',
          ),
        )
      }
    }

    if (outcomeType === 'proportion' && (row.value < 0 || row.value > 1)) {
      issues.push(
        makeIssue(
          'warning',
          `Value ${row.value} is outside the usual 0-1 range for a proportion - check whether ` +
            'it should be a fraction rather than a percentage.',
          row.rowId,
          'value',
        ),
      )
    }
  }

  return issues
}

/** A binary outcome should only ever take two distinct values. */
export function checkBinaryOutcomeCardinality(
  dataset: Dataset,
  outcomeType: OutcomeType,
): ParsingIssue[] {
  if (outcomeType !== 'binary') return []

  const distinct = new Set<string>()
  for (const row of dataset.rows) {
    const raw = rawValueOf(row)
    if (raw.length > 0) distinct.add(raw)
  }

  if (distinct.size > 2) {
    return [
      makeIssue(
        'warning',
        `Found ${distinct.size} different values for a binary outcome (${[...distinct].join(', ')}), ` +
          'but a binary outcome should only take two values.',
        undefined,
        'value',
      ),
    ]
  }

  return []
}

/** Duplicate identifiers where the format expects them to be unique. */
export function checkDuplicateIds(dataset: Dataset): ParsingIssue[] {
  const issues: ParsingIssue[] = []

  function flagDuplicates(
    keyOf: (row: DatasetRow) => string | undefined,
    describe: (key: string) => string,
  ) {
    const byKey = new Map<string, DatasetRow[]>()
    for (const row of dataset.rows) {
      const key = keyOf(row)
      if (!key) continue
      const list = byKey.get(key) ?? []
      list.push(row)
      byKey.set(key, list)
    }
    for (const [key, rows] of byKey) {
      if (rows.length > 1) {
        for (const row of rows) {
          issues.push(makeIssue('warning', describe(key), row.rowId))
        }
      }
    }
  }

  if (dataset.format === 'independent-groups') {
    flagDuplicates(
      (row) => row.sampleId,
      (id) =>
        `Sample ID '${id}' is used by more than one row; sample IDs are expected to be unique.`,
    )
  }

  if (dataset.format === 'nested') {
    flagDuplicates(
      (row) =>
        row.experimentalUnit && row.subsample
          ? `${row.experimentalUnit}::${row.subsample}`
          : undefined,
      (key) => {
        const [unit, subsample] = key.split('::')
        return `Unit '${unit}' subsample '${subsample}' appears more than once.`
      },
    )
  }

  if (dataset.format === 'paired') {
    flagDuplicates(
      (row) =>
        row.subjectId && row.condition
          ? `${row.subjectId}::${row.condition}`
          : undefined,
      (key) => {
        const [subject, condition] = key.split('::')
        return (
          `Subject '${subject}' has more than one row for condition '${condition}' - it's ` +
          'unclear which value to use.'
        )
      },
    )
  }

  return issues
}

/**
 * A paired subject should have exactly two distinct conditions, each once.
 * A subject with only one condition can't be paired; a subject with more
 * than two is ambiguous.
 */
export function checkPairedCompleteness(dataset: Dataset): ParsingIssue[] {
  if (dataset.format !== 'paired') return []

  const bySubject = new Map<string, DatasetRow[]>()
  for (const row of dataset.rows) {
    if (!row.subjectId) continue
    const list = bySubject.get(row.subjectId) ?? []
    list.push(row)
    bySubject.set(row.subjectId, list)
  }

  const issues: ParsingIssue[] = []

  for (const [subjectId, rows] of bySubject) {
    const conditions = new Set(
      rows.map((r) => r.condition).filter((c): c is string => Boolean(c)),
    )
    if (conditions.size === 1) {
      for (const row of rows) {
        issues.push(
          makeIssue(
            'excluded',
            `Subject '${subjectId}' only has a measurement for condition ` +
              `'${[...conditions][0]}' - its paired counterpart is missing.`,
            row.rowId,
            'condition',
          ),
        )
      }
    } else if (conditions.size > 2) {
      for (const row of rows) {
        issues.push(
          makeIssue(
            'excluded',
            `Subject '${subjectId}' has ${conditions.size} different conditions ` +
              `(${[...conditions].join(', ')}), but paired data expects exactly two.`,
            row.rowId,
            'condition',
          ),
        )
      }
    }
  }

  return issues
}

/** Wildly uneven subsample counts per experimental unit - a caution, not a block. */
export function checkNestedSubsampleConsistency(
  dataset: Dataset,
): ParsingIssue[] {
  if (dataset.format !== 'nested') return []

  const byUnit = new Map<string, number>()
  for (const row of dataset.rows) {
    if (!row.experimentalUnit) continue
    byUnit.set(
      row.experimentalUnit,
      (byUnit.get(row.experimentalUnit) ?? 0) + 1,
    )
  }

  if (byUnit.size < 2) return []

  const counts = [...byUnit.values()]
  const min = Math.min(...counts)
  const max = Math.max(...counts)
  const uneven = max !== min && (min === 0 || max / min >= 3)

  if (!uneven) return []

  const detail = [...byUnit.entries()]
    .map(([unit, count]) => `${unit}: ${count}`)
    .join(', ')
  return [
    makeIssue(
      'warning',
      `Experimental units have very different numbers of subsamples (${detail}) - this can make ` +
        'the nested analysis unreliable.',
    ),
  ]
}

/** Groups/units with a very small sample size - flagged, never blocked. */
export function checkSmallGroups(dataset: Dataset): ParsingIssue[] {
  const issues: ParsingIssue[] = []

  if (dataset.format === 'independent-groups') {
    const byGroup = new Map<string, number>()
    for (const row of dataset.rows) {
      if (!row.group) continue
      byGroup.set(row.group, (byGroup.get(row.group) ?? 0) + 1)
    }
    for (const [group, count] of byGroup) {
      if (count < MIN_UNITS_PER_GROUP) {
        issues.push(
          makeIssue(
            'warning',
            `Group '${group}' has only ${count} unit${count === 1 ? '' : 's'} - a very small ` +
              'sample size makes this comparison unreliable.',
            undefined,
            'group',
          ),
        )
      }
    }
  }

  if (dataset.format === 'nested') {
    const byGroup = new Map<string, Set<string>>()
    for (const row of dataset.rows) {
      if (!row.group || !row.experimentalUnit) continue
      if (!byGroup.has(row.group)) byGroup.set(row.group, new Set())
      byGroup.get(row.group)?.add(row.experimentalUnit)
    }
    for (const [group, units] of byGroup) {
      if (units.size < MIN_UNITS_PER_GROUP) {
        issues.push(
          makeIssue(
            'warning',
            `Group '${group}' has only ${units.size} experimental unit${units.size === 1 ? '' : 's'} ` +
              '- a very small sample size makes this comparison unreliable.',
            undefined,
            'group',
          ),
        )
      }
    }
  }

  if (dataset.format === 'paired') {
    const subjects = new Set<string>()
    for (const row of dataset.rows) {
      if (row.subjectId) subjects.add(row.subjectId)
    }
    if (subjects.size > 0 && subjects.size < MIN_UNITS_PER_GROUP) {
      issues.push(
        makeIssue(
          'warning',
          `Only ${subjects.size} subject${subjects.size === 1 ? '' : 's'} entered - a very small ` +
            'sample size makes this comparison unreliable.',
          undefined,
          'subjectId',
        ),
      )
    }
  }

  return issues
}

function groupingValueOf(
  dataset: Dataset,
  row: DatasetRow,
): string | undefined {
  return dataset.format === 'paired' ? row.condition : row.group
}

/**
 * Cross-check the group/condition names found in the data against the ones
 * the student named in the design wizard, in both directions: a declared
 * group with no data, and a data value that doesn't match any declared
 * group.
 */
export function checkGroupNameConsistency(
  dataset: Dataset,
  design: ExperimentDesign,
): ParsingIssue[] {
  const declared = new Set(
    design.groups.names
      .map((name) => name.trim())
      .filter((name) => name.length > 0),
  )
  if (declared.size === 0) return []

  const found = new Set<string>()
  for (const row of dataset.rows) {
    const value = groupingValueOf(dataset, row)
    if (value) found.add(value)
  }

  const issues: ParsingIssue[] = []

  for (const name of declared) {
    if (!found.has(name)) {
      issues.push(
        makeIssue(
          'warning',
          `The group '${name}' from your design has no data rows yet.`,
          undefined,
        ),
      )
    }
  }

  for (const value of found) {
    if (!declared.has(value)) {
      issues.push(
        makeIssue(
          'warning',
          `'${value}' appears in your data but wasn't one of the groups you named in your design ` +
            `(${[...declared].join(', ')}) - check for a typo, or treat it as a new group if that's ` +
            'intentional.',
          undefined,
        ),
      )
    }
  }

  return issues
}

/**
 * Run every validation check and return the combined list of issues. Does
 * not include structural/CSV-parsing issues (missing columns, Papa Parse
 * errors) - those are attached separately by the caller, since they concern
 * parsing rather than the semantics of already-parsed rows.
 */
export function validateDataset(
  dataset: Dataset,
  design: ExperimentDesign,
): ParsingIssue[] {
  return [
    ...checkMissingIdentifiers(dataset),
    ...checkMissingGroupLabels(dataset),
    ...checkMissingValues(dataset),
    ...checkNumericOutcomeValues(dataset, design.outcome.type),
    ...checkBinaryOutcomeCardinality(dataset, design.outcome.type),
    ...checkDuplicateIds(dataset),
    ...checkPairedCompleteness(dataset),
    ...checkNestedSubsampleConsistency(dataset),
    ...checkSmallGroups(dataset),
    ...checkGroupNameConsistency(dataset, design),
  ]
}
