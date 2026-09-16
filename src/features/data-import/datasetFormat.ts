/**
 * Deciding which of the three CSV/entry shapes (Section 14 of the spec)
 * applies to a given experimental design.
 *
 * This module never guesses: when the design doesn't clearly imply one
 * format, it says so (`{ kind: 'ask' }`) instead of picking one.
 */

import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type { DatasetFormat } from '../../models/Dataset'

export interface ColumnTemplate {
  format: DatasetFormat
  label: string
  columns: string[]
  /** A short description of when this shape applies. */
  description: string
  /** A tiny worked example, one row per array entry, matching `columns`. */
  example: string[][]
}

export const COLUMN_TEMPLATES: Record<DatasetFormat, ColumnTemplate> = {
  'independent-groups': {
    format: 'independent-groups',
    label: 'Independent groups',
    columns: ['sample_id', 'group', 'value'],
    description:
      'Each row is one measurement from one experimental unit. Every unit belongs to exactly ' +
      'one group, and units are not linked to each other across groups.',
    example: [
      ['1', 'Control', '12.3'],
      ['2', 'Control', '11.8'],
      ['3', 'Treatment', '15.1'],
    ],
  },
  paired: {
    format: 'paired',
    label: 'Paired (before/after or matched pairs)',
    columns: ['subject_id', 'condition', 'value'],
    description:
      'Each subject/unit is measured under exactly two conditions (e.g. "before" and "after"), ' +
      'so each subject_id should appear exactly twice - once per condition.',
    example: [
      ['1', 'before', '12.3'],
      ['1', 'after', '14.0'],
      ['2', 'before', '11.8'],
      ['2', 'after', '12.2'],
    ],
  },
  nested: {
    format: 'nested',
    label: 'Nested / repeated sub-measurements',
    columns: ['experimental_unit', 'subsample', 'group', 'value'],
    description:
      'Multiple measurements (subsamples) are taken from the same experimental unit. Each unit ' +
      'belongs to one group, and has one row per subsample.',
    example: [
      ['unit-1', '1', 'Control', '12.3'],
      ['unit-1', '2', 'Control', '12.6'],
      ['unit-2', '1', 'Treatment', '15.1'],
      ['unit-2', '2', 'Treatment', '14.9'],
    ],
  },
}

export type FormatResolution =
  | { kind: 'determined'; format: DatasetFormat }
  | { kind: 'ask'; reason: 'unsure' | 'ambiguous' }

/**
 * Decide which entry/import format applies for a captured `ExperimentDesign`,
 * following the mapping from the Milestone 3 spec:
 *
 *  - technical replication present, or an explicitly nested design -> nested
 *  - independent groups -> independent-groups
 *  - paired/repeated with exactly two groups -> paired
 *  - the student told us they weren't sure -> ask, don't guess
 *  - anything else that doesn't cleanly match one of the above (e.g.
 *    "repeated" with three or more groups, which isn't representable in the
 *    paired shape) -> also ask, rather than guess a shape that might not fit
 */
export function resolveDatasetFormat(
  design: ExperimentDesign,
): FormatResolution {
  if (
    design.technicalReplication.present === true ||
    design.relationship === 'nested'
  ) {
    return { kind: 'determined', format: 'nested' }
  }

  if (design.relationship === 'independent') {
    return { kind: 'determined', format: 'independent-groups' }
  }

  if (
    (design.relationship === 'paired' || design.relationship === 'repeated') &&
    design.groups.count === 2
  ) {
    return { kind: 'determined', format: 'paired' }
  }

  if (design.relationship === 'unknown') {
    return { kind: 'ask', reason: 'unsure' }
  }

  return { kind: 'ask', reason: 'ambiguous' }
}
