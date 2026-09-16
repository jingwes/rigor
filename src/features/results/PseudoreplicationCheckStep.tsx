import type { PseudoreplicationSummary } from '../../rules/replicationRules'

export interface PseudoreplicationCheckStepProps {
  summary: PseudoreplicationSummary
  unitLabel: string
  onConfirm: () => void
  onBack: () => void
}

/**
 * Milestone 7: the required, explicit confirmation step shown between data
 * import and running statistics whenever `replicationRules.ts` detects
 * likely pseudoreplication in a nested dataset (Section 13 of the spec).
 *
 * This is deliberately a click a student has to make, not a silent
 * background transformation - Rigor never averages technical replicates
 * without the student seeing and agreeing to it. The one resolution V1
 * offers (averaging within experimental unit) is stated as a simplification,
 * not the universally correct answer.
 */
export function PseudoreplicationCheckStep({
  summary,
  unitLabel,
  onConfirm,
  onBack,
}: PseudoreplicationCheckStepProps) {
  return (
    <section aria-labelledby="pseudoreplication-check-title">
      <h2 id="pseudoreplication-check-title">Check your sample size before analyzing</h2>

      {summary.warning && (
        <ul className="chart-warnings">
          <li className={`chart-warning-${summary.warning.severity}`}>{summary.warning.message}</li>
        </ul>
      )}

      <p>
        This version of Rigor supports exactly one way to handle this: average each {unitLabel}
        {"'"}s measurements into a single value, then run the analysis on those {summary.totalUnits}
        {' '}averaged values instead of the {summary.totalUsableRows} raw measurements. This is a
        simplification, not necessarily the statistically ideal answer for every nested design - more
        complex nested designs may require mixed-effects models, which this version does not yet
        support.
      </p>

      <p>
        Your raw, un-averaged measurements are never deleted. They stay in your dataset and remain
        visible and exportable even after this step.
      </p>

      <div className="wizard-nav">
        <button type="button" onClick={onBack} className="wizard-back">
          Back
        </button>
        <button type="button" className="primary-action" onClick={onConfirm}>
          Aggregate within experimental unit (mean) and continue
        </button>
      </div>
    </section>
  )
}
