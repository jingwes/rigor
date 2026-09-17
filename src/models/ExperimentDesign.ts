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

/**
 * A purely cosmetic/interpretive tag a student can optionally attach to a
 * named group - e.g. "this is the negative control". Never read by
 * `recommendAnalysis` (the rules engine keys its decisions off
 * `groups.count`/`relationship`/`outcome.type` only) and never changes which
 * statistical test is chosen, how groups are ordered, or what gets computed -
 * see `src/rules/analysisRules.test.ts`'s "control designation" case. It is
 * only ever read by report-text generation (`generateInterpretationText.ts`/
 * `generateMethodsText.ts`) and the design summary, to phrase a comparison
 * relative to a named control where one is set.
 */
export type GroupRole = 'control' | 'positive-control' | 'negative-control'

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
    /**
     * Optional, keyed by (resolved) group name. Absent entirely for designs
     * that don't use it (the common case) - never required, and never
     * guessed at. Group names are already used as the de facto identifier
     * for a group elsewhere in the app (dataset rows, aggregation, the
     * rules-engine-adjacent report text), so keying by name here follows
     * that existing convention rather than introducing a new one.
     */
    roles?: Record<string, GroupRole>
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
