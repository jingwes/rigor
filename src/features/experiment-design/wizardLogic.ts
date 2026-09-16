import type { WizardDraft, WizardStepId } from './wizardTypes'
import { WIZARD_STEP_IDS } from './wizardTypes'

/**
 * Pure helpers for step transitions and validation. Kept out of JSX so the
 * rules for "can I move on" and "what's the next step" are easy to read and
 * test in isolation.
 */

/** Step 3 (relationship) only makes sense once there are 2+ groups. */
export function isStepApplicable(stepId: WizardStepId, draft: WizardDraft): boolean {
  if (stepId === 'relationship') {
    return (draft.groupsCount ?? 0) >= 2
  }
  return true
}

function applicableSteps(draft: WizardDraft): WizardStepId[] {
  return WIZARD_STEP_IDS.filter((id) => isStepApplicable(id, draft))
}

export function getNextStepId(current: WizardStepId, draft: WizardDraft): WizardStepId | null {
  const steps = applicableSteps(draft)
  const index = steps.indexOf(current)
  if (index === -1 || index === steps.length - 1) return null
  return steps[index + 1]
}

export function getPreviousStepId(current: WizardStepId, draft: WizardDraft): WizardStepId | null {
  const steps = applicableSteps(draft)
  const index = steps.indexOf(current)
  if (index <= 0) return null
  return steps[index - 1]
}

export function getStepNumber(current: WizardStepId, draft: WizardDraft): number {
  return applicableSteps(draft).indexOf(current) + 1
}

export function getTotalSteps(draft: WizardDraft): number {
  return applicableSteps(draft).length
}

/** Whether the student has answered enough of a step to move forward. */
export function canProceedFromStep(stepId: WizardStepId, draft: WizardDraft): boolean {
  switch (stepId) {
    case 'researchQuestion':
      return draft.outcomeName.trim().length > 0 && draft.outcomeType !== undefined
    case 'groups':
      return draft.groupCountChoice !== undefined && (draft.groupsCount ?? 0) >= 1
    case 'relationship':
      return draft.relationship !== undefined
    case 'experimentalUnit':
      return (
        draft.experimentalUnitLabel.trim().length > 0 &&
        draft.technicalReplicationPresent !== undefined
      )
    case 'finalDetails':
      return draft.exclusionsPredefined !== undefined
    case 'summary':
      return true
    default:
      return false
  }
}

/**
 * Keep `groupNames` in sync with a target count: preserve names already
 * typed in, and pad with empty strings (never guess a name).
 */
export function resizeGroupNames(names: string[], count: number): string[] {
  const safeCount = Math.max(0, count)
  if (names.length === safeCount) return names
  if (names.length > safeCount) return names.slice(0, safeCount)
  return [...names, ...Array(safeCount - names.length).fill('')]
}
