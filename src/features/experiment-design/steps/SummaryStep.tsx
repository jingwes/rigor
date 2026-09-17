import type { ExperimentDesign } from '../../../models/ExperimentDesign'
import type { AuditEntry } from '../../../models/AuditEntry'
import { recommendAnalysis } from '../../../rules/analysisRules'
import type { WizardDraft, WizardStepId } from '../wizardTypes'
import { toExperimentDesign } from '../toExperimentDesign'
import { describeDesign } from '../describeDesign'
import { MethodDescriptionCheck } from '../MethodDescriptionCheck'

export interface SummaryStepProps {
  draft: WizardDraft
  onEditStep: (step: WizardStepId) => void
  onRestart: () => void
  onExit: () => void
  onEnterData: (design: ExperimentDesign) => void
  /**
   * Milestone 14: updates the draft's optional free-text method description,
   * and records an audit entry when a cross-check alert is dismissed.
   * Optional (default to no-ops) so this step still renders standalone (as
   * existing tests already do) without wiring the full wizard-level plumbing.
   */
  onUpdateMethodDescription?: (value: string) => void
  onRecordMethodDescriptionOverride?: (entry: AuditEntry) => void
}

/**
 * The only two analyses this version of Rigor actually computes (Milestone
 * 6 scope). The rules engine (Milestone 2) can recommend others - e.g. a
 * one-way ANOVA for 3+ independent groups - that are statistically correct
 * recommendations this app just hasn't implemented and verified yet.
 */
const IMPLEMENTED_ANALYSIS_TYPES = new Set([
  'welch-two-sample-t-test',
  'paired-t-test',
])

const STEP_LABELS: Record<WizardStepId, string> = {
  researchQuestion: 'question & measurement',
  groups: 'groups',
  relationship: 'independence',
  experimentalUnit: 'experimental unit',
  finalDetails: 'final details',
  summary: 'summary',
}

export function SummaryStep({
  draft,
  onEditStep,
  onRestart,
  onExit,
  onEnterData,
  onUpdateMethodDescription,
  onRecordMethodDescriptionOverride,
}: SummaryStepProps) {
  const design = toExperimentDesign(draft)
  const lines = describeDesign(design)
  const recommendation = recommendAnalysis(design)
  const isImplemented =
    recommendation.status === 'supported' &&
    recommendation.analysisType !== undefined &&
    IMPLEMENTED_ANALYSIS_TYPES.has(recommendation.analysisType)

  return (
    <section aria-labelledby="summary-title">
      <h2 id="summary-title">Your experimental design, so far</h2>
      <p>Here's everything you told us, in plain language.</p>

      <dl className="summary-list">
        {lines.map((line) => (
          <div className="summary-row" key={line.label}>
            <dt>{line.label}</dt>
            <dd>
              {line.value}{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => onEditStep(line.editStep)}
              >
                Edit
              </button>
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="recommendation-title">
        <h3 id="recommendation-title">Recommended analysis</h3>
        <p>{recommendation.explanation}</p>

        {recommendation.status === 'needs-information' &&
          recommendation.requiredQuestions &&
          recommendation.requiredQuestions.length > 0 && (
            <ul>
              {recommendation.requiredQuestions.map((question) => (
                <li key={question.id}>{question.prompt}</li>
              ))}
            </ul>
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

        {recommendation.status === 'supported' && !isImplemented && (
          <p className="wizard-note">
            This is the statistically recommended analysis for your design, but this version of
            Rigor's statistics engine only computes a Welch two-sample t-test or a paired t-test -
            it doesn't run this one yet.
          </p>
        )}
      </section>

      <p className="wizard-note">
        {isImplemented
          ? 'This is a preview, not a locked-in analysis plan - you can still go back and change ' +
            "your design. You can enter your data now, and once it's validated, Rigor will run " +
            'the recommended analysis and show real results.'
          : "You can still enter your data now - collecting it carefully is worthwhile even " +
            "before a supported analysis is available - but Rigor won't be able to produce " +
            'statistical results for this design without more information, or without support ' +
            "for it in this version. Rigor will check your data over regardless."}
      </p>

      <MethodDescriptionCheck
        description={draft.methodDescription ?? ''}
        onChangeDescription={onUpdateMethodDescription ?? (() => {})}
        design={design}
        onReviewStep={onEditStep}
        onRecordOverride={onRecordMethodDescriptionOverride ?? (() => {})}
      />

      <div className="wizard-nav">
        <button
          type="button"
          onClick={() => onEnterData(design)}
          className="primary-action"
        >
          Enter your data
        </button>
        <button
          type="button"
          onClick={() => onEditStep('researchQuestion')}
          className="wizard-back"
        >
          Back to editing ({STEP_LABELS.researchQuestion})
        </button>
        <button type="button" onClick={onRestart} className="wizard-next">
          Start a new design
        </button>
        <button type="button" onClick={onExit} className="wizard-back">
          Back to home
        </button>
      </div>
    </section>
  )
}
