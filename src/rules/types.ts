/**
 * Types for the Milestone 2 deterministic analysis rules engine.
 *
 * This module has no dependency on React, Pyodide, or any other later
 * milestone. It only reasons over the typed `ExperimentDesign` produced by
 * the Milestone 1 wizard and returns a recommendation describing which
 * analysis (if any) is consistent with the described design.
 *
 * Rigor never infers analysis choice from data (e.g. a normality-test
 * p-value) - only from the design the student described. When a method
 * is not yet implemented/validated, or the design is ambiguous, the
 * correct behavior is `"unsupported"` or `"needs-information"` - never a
 * guess.
 */

/**
 * The set of analyses this version of Rigor knows how to reason about.
 * Note: `"repeated-measures-anova"` is reserved for a future milestone.
 * It is never returned as a recommendation by the V1 rules engine (see
 * `CONT-3PLUS-REPEATED-001`, which is `unsupported` rather than
 * recommending this analysis).
 */
export type AnalysisType =
  | 'welch-two-sample-t-test'
  | 'paired-t-test'
  | 'one-way-anova'
  | 'repeated-measures-anova'
  | 'categorical-association'

export type WarningSeverity = 'info' | 'caution' | 'blocking'

export interface Warning {
  id: string
  message: string
  severity: WarningSeverity
}

export interface Question {
  id: string
  prompt: string
}

export type RecommendationStatus =
  'supported' | 'needs-information' | 'unsupported'

export interface AnalysisRecommendation {
  status: RecommendationStatus
  /**
   * Only ever populated when `status === 'supported'`. Every other status
   * must leave this `undefined` - the engine must never suggest a specific
   * analysis it is not confident is appropriate.
   */
  analysisType?: AnalysisType
  /**
   * Other analyses that could become relevant once more information is
   * available (e.g. once real cell counts exist). Not a recommendation.
   */
  alternatives?: AnalysisType[]
  /**
   * Populated when `status === 'needs-information'`: the question(s) that
   * must be answered before a recommendation can be made.
   */
  requiredQuestions?: Question[]
  warnings: Warning[]
  explanation: string
  ruleId: string
}
