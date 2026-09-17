import type { OutcomeType, StudyRelationship } from '../../models/ExperimentDesign'

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
