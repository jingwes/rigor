/**
 * Milestone 10: the typed design capture for correlation/simple linear
 * regression between two continuous variables.
 *
 * Deliberately NOT a variant of `ExperimentDesign` (see
 * `src/features/correlation/`'s module docs for the full rationale): a
 * correlation question has no "groups" or "relationship" in the
 * group-comparison sense - it is about whether two continuous variables (X
 * and Y), each measured once per independent experimental unit, are
 * associated. Reusing `ExperimentDesign`'s `groups`/`relationship` fields
 * here would either leave them meaningless or force a fake mapping onto a
 * shape that was never designed for this question - so this gets its own
 * small, purpose-built type instead.
 */

export interface CorrelationVariable {
  name: string
  unit?: string
}

/**
 * `measuredOncePerUnit`: `true` = yes, `false` = no, `'unknown'` = not sure.
 * Per the project's "never guess" philosophy, only `true` allows the student
 * to proceed to data entry/analysis - `false` or `'unknown'` must lead to an
 * honest "not supported yet" message (repeated-measures correlation), never
 * a silently-wrong analysis. See `CorrelationDesignFlow.tsx`.
 */
export interface CorrelationDesign {
  researchQuestion?: string
  xVariable: CorrelationVariable
  yVariable: CorrelationVariable
  measuredOncePerUnit: boolean | 'unknown'
  experimentalUnitLabel?: string
}
