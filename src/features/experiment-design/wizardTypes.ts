import type { GroupRole, OutcomeType, StudyRelationship } from '../../models/ExperimentDesign'

/**
 * The wizard's working draft.
 *
 * This is deliberately a *different* shape from `ExperimentDesign`: while the
 * student is filling in the form, most fields are simply "not answered yet"
 * (`undefined`), which is different from an explicit "I'm not sure"
 * (`'unknown'` for enum-like fields, or `null` for the technical-replication
 * yes/no/not-sure question). Only once every required question has an answer
 * do we convert this into a well-formed `ExperimentDesign` (see
 * `toExperimentDesign.ts`).
 */

export type GroupCountChoice = 'one' | 'two' | 'threeOrMore'

export interface WizardDraft {
  // Step 1: research question & outcome
  researchQuestion: string
  outcomeName: string
  outcomeType: OutcomeType | undefined
  outcomeUnit: string

  // Step 2: groups / conditions
  groupCountChoice: GroupCountChoice | undefined
  groupsCount: number | undefined
  groupNames: string[]
  /**
   * Optional per-group control/reference designation, indexed the same way
   * as `groupNames` (index `i` is that group's role, or `undefined` for "no
   * particular role" - the default for most designs). Optional on the type
   * (not just an empty array) so existing code/tests that construct a
   * `WizardDraft` literal without it keep compiling - identical treatment to
   * `methodDescription` above, for the same reason.
   */
  groupRoles?: (GroupRole | undefined)[]

  // Step 3: independence and pairing
  relationship: StudyRelationship | undefined

  // Step 4: experimental unit & technical replication
  experimentalUnitLabel: string
  experimentalUnitOther: string
  experimentalUnitDescription: string
  /** true = yes, false = no, null = "not sure", undefined = not answered yet */
  technicalReplicationPresent: boolean | null | undefined
  /** kept as free text while editing; parsed to a number on conversion */
  technicalReplicationMeasurementsPerUnit: string

  // Step 5: final questions
  exclusionsPredefined: boolean | undefined
  notes: string

  // Step 6 (summary): Milestone 14's optional method-description cross-check
  // field. Optional on the type (not just blank) so existing code/tests that
  // construct a `WizardDraft` literal without it keep compiling - truly
  // absent and "typed but blank" are treated identically here (both mean "no
  // description given").
  methodDescription?: string
}

/**
 * The options offered for a group's optional control/reference designation,
 * in display order. `value: undefined` is "no particular role" - the
 * default, and by far the most common choice, since most designs don't need
 * one.
 */
export const GROUP_ROLE_OPTIONS: { value: GroupRole | undefined; label: string }[] = [
  { value: undefined, label: 'No particular role' },
  { value: 'control', label: 'Control (reference)' },
  { value: 'positive-control', label: 'Positive control' },
  { value: 'negative-control', label: 'Negative control' },
]

export const EXPERIMENTAL_UNIT_PRESETS = [
  'Participant',
  'Animal',
  'Plant',
  'Independently prepared cell culture',
  'Organoid',
  'Tissue sample',
  'School',
  'Plate',
  'Other',
] as const

export type ExperimentalUnitPreset = (typeof EXPERIMENTAL_UNIT_PRESETS)[number]

export function createInitialDraft(): WizardDraft {
  return {
    researchQuestion: '',
    outcomeName: '',
    outcomeType: undefined,
    outcomeUnit: '',

    groupCountChoice: undefined,
    groupsCount: undefined,
    groupNames: [],
    groupRoles: [],

    relationship: undefined,

    experimentalUnitLabel: '',
    experimentalUnitOther: '',
    experimentalUnitDescription: '',
    technicalReplicationPresent: undefined,
    technicalReplicationMeasurementsPerUnit: '',

    exclusionsPredefined: undefined,
    notes: '',

    methodDescription: '',
  }
}

export const WIZARD_STEP_IDS = [
  'researchQuestion',
  'groups',
  'relationship',
  'experimentalUnit',
  'finalDetails',
  'summary',
] as const

export type WizardStepId = (typeof WIZARD_STEP_IDS)[number]
