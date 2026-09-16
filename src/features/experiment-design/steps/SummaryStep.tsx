import type { WizardDraft, WizardStepId } from '../wizardTypes'
import { toExperimentDesign } from '../toExperimentDesign'
import { describeDesign } from '../describeDesign'

export interface SummaryStepProps {
  draft: WizardDraft
  onEditStep: (step: WizardStepId) => void
  onRestart: () => void
  onExit: () => void
}

const STEP_LABELS: Record<WizardStepId, string> = {
  researchQuestion: 'question & measurement',
  groups: 'groups',
  relationship: 'independence',
  experimentalUnit: 'experimental unit',
  finalDetails: 'final details',
  summary: 'summary',
}

export function SummaryStep({ draft, onEditStep, onRestart, onExit }: SummaryStepProps) {
  const design = toExperimentDesign(draft)
  const lines = describeDesign(design)

  return (
    <section aria-labelledby="summary-title">
      <h2 id="summary-title">Your experimental design, so far</h2>
      <p>
        Here's everything you told us, in plain language. Nothing here is a statistical
        recommendation - Rigor doesn't have a rules engine yet, so it isn't judging whether your
        design is right. It's just reflecting back what you entered.
      </p>

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

      <p className="wizard-note">
        Data entry and analysis aren't available in this version of Rigor yet - this milestone
        only covers describing your experiment. Come back once those steps are built.
      </p>

      <div className="wizard-nav">
        <button type="button" onClick={() => onEditStep('researchQuestion')} className="wizard-back">
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
