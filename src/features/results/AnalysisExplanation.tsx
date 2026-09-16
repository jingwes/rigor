import type { AnalysisRecommendation } from '../../rules/types'

export interface AnalysisExplanationProps {
  recommendation: AnalysisRecommendation
  /**
   * Set when `recommendation.status === 'supported'` but the recommended
   * analysis isn't one this version of Rigor actually computes yet (e.g. a
   * one-way ANOVA or a categorical-association test) - Milestone 6 only
   * implements Welch's two-sample t-test and the paired t-test.
   */
  notYetImplemented?: boolean
  /** Set when the data itself wasn't enough to run the recommended analysis. */
  insufficientDataMessage?: string
}

/**
 * The honest, non-fake explanation state shown whenever Rigor cannot (yet)
 * produce real results: an unsupported/ambiguous design, a design whose
 * analysis isn't implemented in this version, or valid-but-too-thin data.
 * Reuses the rules engine's own `explanation`/`requiredQuestions` text
 * rather than inventing new wording - this is the same voice used on the
 * wizard's Summary step.
 */
export function AnalysisExplanation({
  recommendation,
  notYetImplemented,
  insufficientDataMessage,
}: AnalysisExplanationProps) {
  return (
    <section aria-labelledby="analysis-explanation-title">
      <h2 id="analysis-explanation-title">
        {insufficientDataMessage
          ? 'Not enough data yet to run this analysis'
          : "Rigor can't run an analysis for this yet"}
      </h2>

      <p>{recommendation.explanation}</p>

      {notYetImplemented && recommendation.status === 'supported' && (
        <p>
          A recommended analysis was identified for your design, but this version of Rigor's
          statistics engine only computes a Welch two-sample t-test or a paired t-test. The
          recommended analysis here hasn't been implemented and verified in this app yet, so no
          results can be shown - your data has still been kept, in case this becomes available in
          a future version.
        </p>
      )}

      {insufficientDataMessage && <p>{insufficientDataMessage}</p>}

      {recommendation.status === 'needs-information' &&
        recommendation.requiredQuestions &&
        recommendation.requiredQuestions.length > 0 && (
          <div>
            <h3>What we'd need to know</h3>
            <ul>
              {recommendation.requiredQuestions.map((question) => (
                <li key={question.id}>{question.prompt}</li>
              ))}
            </ul>
          </div>
        )}

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
  )
}
