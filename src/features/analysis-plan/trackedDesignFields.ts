/**
 * Milestone 11: the small, explicit set of `ExperimentDesign` fields that
 * post-lock modification detection watches. Per the project spec (section
 * 30), we do not build an exhaustive diffing engine over the whole design -
 * only the fields the spec calls out as able to affect an already-locked
 * analysis: group definitions/names, the pairing/relationship answer, the
 * primary outcome (name + type), and whether technical replication is
 * present (which decides whether Milestone 7's aggregation path applies).
 */

import type { ExperimentDesign } from '../../models/ExperimentDesign'

export interface TrackedDesignFields {
  groupCount: number
  groupNames: string[]
  relationship: ExperimentDesign['relationship']
  outcomeName: string
  outcomeType: ExperimentDesign['outcome']['type']
  technicalReplicationPresent: boolean | null
}

export function extractTrackedDesignFields(design: ExperimentDesign): TrackedDesignFields {
  return {
    groupCount: design.groups.count,
    groupNames: [...design.groups.names],
    relationship: design.relationship,
    outcomeName: design.outcome.name,
    outcomeType: design.outcome.type,
    technicalReplicationPresent: design.technicalReplication.present,
  }
}

export interface TrackedFieldChange {
  field: keyof TrackedDesignFields
  label: string
  before: unknown
  after: unknown
}

const FIELD_LABELS: Record<keyof TrackedDesignFields, string> = {
  groupCount: 'Number of groups',
  groupNames: 'Group names',
  relationship: 'Group relationship (independent/paired/repeated/nested)',
  outcomeName: 'Primary outcome',
  outcomeType: 'Outcome type',
  technicalReplicationPresent: 'Technical replication',
}

const TRACKED_FIELD_KEYS = Object.keys(FIELD_LABELS) as (keyof TrackedDesignFields)[]

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => value === b[index])
  }
  return a === b
}

/**
 * Compares only the explicit tracked-field list above between two
 * snapshots. Pure, no React, independently testable - and deliberately NOT
 * an exhaustive diff of the whole `ExperimentDesign` object.
 */
export function diffTrackedDesignFields(
  before: TrackedDesignFields,
  after: TrackedDesignFields,
): TrackedFieldChange[] {
  const changes: TrackedFieldChange[] = []
  for (const field of TRACKED_FIELD_KEYS) {
    if (!valuesEqual(before[field], after[field])) {
      changes.push({ field, label: FIELD_LABELS[field], before: before[field], after: after[field] })
    }
  }
  return changes
}

function formatFieldValue(value: unknown): string {
  if (Array.isArray(value)) return `"${value.join(', ')}"`
  if (value === null || value === undefined) return 'not specified'
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  return `"${String(value)}"`
}

/**
 * Plain-language description for a `'design-modified'` audit entry, e.g.
 * `Modified after results were viewed: Group names changed from "Control,
 * Treatment" to "Control, High-dose".`
 */
export function describeTrackedFieldChanges(changes: TrackedFieldChange[]): string {
  if (changes.length === 0) return 'Modified after results were viewed.'
  const parts = changes.map(
    (change) =>
      `${change.label} changed from ${formatFieldValue(change.before)} to ${formatFieldValue(change.after)}`,
  )
  return `Modified after results were viewed: ${parts.join('; ')}.`
}
