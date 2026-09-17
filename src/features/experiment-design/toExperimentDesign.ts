import type { ExperimentDesign, GroupRole } from '../../models/ExperimentDesign'
import type { WizardDraft } from './wizardTypes'

function trimmedOrUndefined(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function resolveExperimentalUnitLabel(draft: WizardDraft): string {
  if (draft.experimentalUnitLabel === 'Other') {
    return draft.experimentalUnitOther.trim()
  }
  return draft.experimentalUnitLabel
}

function resolveGroupNames(draft: WizardDraft): string[] {
  const count = draft.groupsCount ?? draft.groupNames.length
  const names = draft.groupNames.slice(0, count)
  while (names.length < count) names.push('')
  return names.map((name, index) => (name.trim().length > 0 ? name.trim() : `Group ${index + 1}`))
}

/**
 * Builds the optional `groups.roles` record from the draft's per-index role
 * picks, keyed by the SAME resolved group names `resolveGroupNames` produces
 * (so a role always lines up with the name actually recorded on the design,
 * including auto-generated "Group N" placeholders). Returns `undefined`
 * (not `{}`) when no group has a role, so a design with none looks exactly
 * like it did before this field existed.
 */
function resolveGroupRoles(
  draft: WizardDraft,
  resolvedNames: string[],
): Record<string, GroupRole> | undefined {
  const roles = draft.groupRoles ?? []
  const result: Record<string, GroupRole> = {}
  resolvedNames.forEach((name, index) => {
    const role = roles[index]
    if (role) result[name] = role
  })
  return Object.keys(result).length > 0 ? result : undefined
}

function parseMeasurementsPerUnit(draft: WizardDraft): number | undefined {
  if (draft.technicalReplicationPresent !== true) return undefined
  const parsed = Number(draft.technicalReplicationMeasurementsPerUnit)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * Convert a (completed) wizard draft into the well-formed `ExperimentDesign`
 * record. Nothing here invents an answer the student didn't give: fields
 * they left unsure map to `'unknown'` / `null`, exactly as they were
 * recorded while answering.
 *
 * `repeatedMeasures` is derived, not asked directly in this milestone: it is
 * `true` only when the independence/pairing answer positively indicated the
 * same units were measured more than once ('paired' or 'repeated').
 */
export function toExperimentDesign(draft: WizardDraft): ExperimentDesign {
  const groupsCount = draft.groupsCount ?? 1
  const relationship = groupsCount >= 2 ? (draft.relationship ?? 'unknown') : 'unknown'
  const repeatedMeasuresPresent = relationship === 'paired' || relationship === 'repeated'
  const groupNames = resolveGroupNames(draft)
  const groupRoles = resolveGroupRoles(draft, groupNames)

  return {
    researchQuestion: trimmedOrUndefined(draft.researchQuestion),
    outcome: {
      name: draft.outcomeName.trim(),
      type: draft.outcomeType ?? 'unknown',
      unit: trimmedOrUndefined(draft.outcomeUnit),
    },
    groups: {
      count: groupsCount,
      names: groupNames,
      ...(groupRoles ? { roles: groupRoles } : {}),
    },
    relationship,
    experimentalUnit: {
      label: resolveExperimentalUnitLabel(draft),
      description: trimmedOrUndefined(draft.experimentalUnitDescription),
    },
    technicalReplication: {
      present: draft.technicalReplicationPresent ?? null,
      measurementsPerUnit: parseMeasurementsPerUnit(draft),
    },
    repeatedMeasures: {
      present: repeatedMeasuresPresent,
      timepoints: repeatedMeasuresPresent ? groupsCount : undefined,
    },
    exclusionsPredefined: draft.exclusionsPredefined ?? false,
    notes: trimmedOrUndefined(draft.notes),
    methodDescription: trimmedOrUndefined(draft.methodDescription ?? ''),
  }
}
