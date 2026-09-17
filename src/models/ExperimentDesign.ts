/**
 * The typed schema for a single experimental design.
 *
 * This is the output of the Milestone 1 design wizard. Nothing here is a
 * statistical recommendation - it is an honest, structured record of what a
 * student told us about their experiment. Fields that were not answered, or
 * that the student said they were unsure about, are represented explicitly
 * as `"unknown"` (for enum-like fields) or `null` / `undefined` (as typed
 * below) - never guessed.
 */

export type OutcomeType =
  | 'continuous'
  | 'ordinal'
  | 'count'
  | 'binary'
  | 'categorical'
  | 'proportion'
  | 'unknown'

export type StudyRelationship = 'independent' | 'paired' | 'repeated' | 'nested' | 'unknown'

export interface ExperimentDesign {
  researchQuestion?: string
  outcome: {
    name: string
    type: OutcomeType
    unit?: string
  }
  groups: {
    count: number
    names: string[]
  }
  relationship: StudyRelationship
  experimentalUnit: {
    label: string
    description?: string
  }
  technicalReplication: {
    present: boolean | null
    measurementsPerUnit?: number
  }
  repeatedMeasures: {
    present: boolean
    timepoints?: number
  }
  blocking?: {
    present: boolean
    variable?: string
  }
  primaryComparison?: string
  exclusionsPredefined: boolean
  notes?: string
  /**
   * Milestone 14: an optional, free-text "describe your experiment in your
   * own words" field, used only by the deterministic method-description
   * cross-checker (`src/rules/methodDescriptionChecker.ts`) as an extra,
   * student-initiated safety net. Never required, never auto-filled, and
   * never read by anything that changes another field on this design.
   */
  methodDescription?: string
}
