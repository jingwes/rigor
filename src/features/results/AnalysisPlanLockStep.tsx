import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type { AnalysisRecommendation } from '../../rules/types'
import { describeDesign } from '../experiment-design/describeDesign'
import {
  describeAggregationSampleSize,
  type NestedAggregationResult,
} from '../analysis-plan/aggregateByExperimentalUnit'

export interface AnalysisPlanLockStepProps {
  design: ExperimentDesign
  recommendation: AnalysisRecommendation
  excludedObservationCount: number
  /** Milestone 7: present only when technical-replicate aggregation applies. */
  aggregation?: NestedAggregationResult
  onLock: () => void
  onBack: () => void
}

/**
 * Milestone 11, "DESIGN phase": the summary shown once real results are
 * ready to compute but before they're revealed. Recaps everything that
 * could affect how the analysis is read - research question, outcome,
 * groups, experimental unit, pairing/replication, biological n vs raw
 * measurements, primary comparison, predefined exclusions, and the intended
 * analysis - almost entirely assembled from data that already exists
 * (`describeDesign`, the rules-engine recommendation, Milestone 7's
 * aggregation summary), per the spec's framing of this as an assembly task.
 *
 * "Lock analysis plan and view results" is a one-way door only in the sense
 * that it timestamps a decision - it never prevents the student from later
 * going back and changing their design. See `analysisPlanAudit.ts` for what
 * happens after that.
 */
export function AnalysisPlanLockStep({
  design,
  recommendation,
  excludedObservationCount,
  aggregation,
  onLock,
  onBack,
}: AnalysisPlanLockStepProps) {
  const summaryLines = describeDesign(design)

  return (
    <section aria-labelledby="analysis-plan-title">
      <h2 id="analysis-plan-title">Review your analysis plan</h2>
      <p>
        Before your results are shown, take a moment to confirm the plan below is what you
        intended. Locking it in timestamps that decision for your reproducibility record - it
        never stops you from coming back and changing your design afterwards. If you do, that
        change is simply recorded honestly alongside your results, not hidden and not blocked.
      </p>

      <dl className="summary-list">
        {summaryLines.map((line) => (
          <div className="summary-row" key={line.label}>
            <dt>{line.label}</dt>
            <dd>{line.value}</dd>
          </div>
        ))}
        {design.primaryComparison && (
          <div className="summary-row">
            <dt>Primary comparison</dt>
            <dd>{design.primaryComparison}</dd>
          </div>
        )}
        <div className="summary-row">
          <dt>Excluded observations</dt>
          <dd>
            {excludedObservationCount === 0
              ? 'None.'
              : `${excludedObservationCount} observation(s), flagged automatically during data import.`}
          </dd>
        </div>
      </dl>

      {aggregation && (
        <section aria-labelledby="analysis-plan-aggregation-title">
          <h3 id="analysis-plan-aggregation-title">Biological n vs. raw measurements</h3>
          <p>{describeAggregationSampleSize(aggregation, design.experimentalUnit.label)}</p>
        </section>
      )}

      <section aria-labelledby="analysis-plan-recommendation-title">
        <h3 id="analysis-plan-recommendation-title">Intended analysis</h3>
        <p>{recommendation.explanation}</p>
        {recommendation.warnings.length > 0 && (
          <ul className="chart-warnings">
            {recommendation.warnings.map((warning) => (
              <li key={warning.id} className={`chart-warning-${warning.severity}`}>
                {warning.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="wizard-nav">
        <button type="button" onClick={onLock} className="primary-action">
          Lock analysis plan and view results
        </button>
        <button type="button" onClick={onBack} className="wizard-back">
          Back to home
        </button>
      </div>
    </section>
  )
}
