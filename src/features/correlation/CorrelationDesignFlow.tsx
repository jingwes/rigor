import { useState } from 'react'
import type { CorrelationDesign } from '../../models/CorrelationDesign'
import { WizardStepShell } from '../experiment-design/WizardStepShell'

export interface CorrelationDesignFlowProps {
  onExit: () => void
  onComplete: (design: CorrelationDesign) => void
}

type MeasuredOnceChoice = 'yes' | 'no' | 'unknown' | undefined

interface DesignDraft {
  researchQuestion: string
  xName: string
  xUnit: string
  yName: string
  yUnit: string
  measuredOnceChoice: MeasuredOnceChoice
  experimentalUnitLabel: string
}

const INITIAL_DRAFT: DesignDraft = {
  researchQuestion: '',
  xName: '',
  xUnit: '',
  yName: '',
  yUnit: '',
  measuredOnceChoice: undefined,
  experimentalUnitLabel: '',
}

type Step = 'variables' | 'measurementStructure' | 'unsupported'

/**
 * Milestone 10's small, dedicated design capture for a correlation/simple-
 * linear-regression question - deliberately NOT the group-comparison
 * `ExperimentDesignWizard`. Only 2 real questions (what are X and Y, and
 * were they each measured once per independent unit), not a full wizard.
 *
 * Per the project's "never guess" philosophy: if the student answers "no"
 * or "not sure" to the once-per-unit question, this flow does NOT proceed
 * to data entry/analysis. Repeated-measures correlation (the same unit
 * contributing more than one X/Y pair) isn't supported by this version, and
 * rather than silently computing a correlation that ignores that
 * non-independence, this shows an honest explanation and stops.
 */
export function CorrelationDesignFlow({ onExit, onComplete }: CorrelationDesignFlowProps) {
  const [draft, setDraft] = useState<DesignDraft>(INITIAL_DRAFT)
  const [step, setStep] = useState<Step>('variables')

  function update(patch: Partial<DesignDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  const canProceedFromVariables = draft.xName.trim().length > 0 && draft.yName.trim().length > 0

  function handleVariablesNext() {
    setStep('measurementStructure')
  }

  function handleMeasurementStructureNext() {
    if (draft.measuredOnceChoice === 'yes') {
      onComplete({
        researchQuestion: draft.researchQuestion.trim() || undefined,
        xVariable: { name: draft.xName.trim(), unit: draft.xUnit.trim() || undefined },
        yVariable: { name: draft.yName.trim(), unit: draft.yUnit.trim() || undefined },
        measuredOncePerUnit: true,
        experimentalUnitLabel: draft.experimentalUnitLabel.trim() || undefined,
      })
      return
    }
    setStep('unsupported')
  }

  if (step === 'unsupported') {
    return (
      <section aria-labelledby="correlation-unsupported-title">
        <h2 id="correlation-unsupported-title">This version doesn't support that yet</h2>
        <p>
          Rigor's correlation and regression tools currently only support one X measurement and
          one Y measurement per independent experimental unit (e.g. one height/weight pair per
          participant). Repeated-measures correlation - where the same unit contributes more than
          one X/Y pair - needs different statistical methods (such as mixed-effects models) that
          this version doesn't implement yet.
        </p>
        <p>
          Rather than compute a correlation that ignores that non-independence, Rigor is stopping
          here. Nothing has been analyzed.
        </p>
        <div className="wizard-nav">
          <button type="button" onClick={() => setStep('measurementStructure')} className="wizard-back">
            Back
          </button>
          <button type="button" onClick={onExit} className="wizard-next">
            Back to home
          </button>
        </div>
      </section>
    )
  }

  if (step === 'measurementStructure') {
    return (
      <WizardStepShell
        title="How your measurements were taken"
        stepNumber={2}
        totalSteps={2}
        onBack={() => setStep('variables')}
        onNext={handleMeasurementStructureNext}
        canProceed={draft.measuredOnceChoice !== undefined}
      >
        <div className="wizard-fields">
          <div className="field">
            <label htmlFor="experimental-unit-label">
              What is the independent experimental unit? (optional)
            </label>
            <input
              id="experimental-unit-label"
              type="text"
              value={draft.experimentalUnitLabel}
              onChange={(e) => update({ experimentalUnitLabel: e.target.value })}
              placeholder="e.g. participant, plant, sample"
            />
          </div>

          <fieldset>
            <legend>
              Are {draft.xName || 'X'} and {draft.yName || 'Y'} measured once for each independent
              experimental unit?
            </legend>
            <div className="radio-option">
              <label>
                <input
                  type="radio"
                  name="measured-once-per-unit"
                  checked={draft.measuredOnceChoice === 'yes'}
                  onChange={() => update({ measuredOnceChoice: 'yes' })}
                />
                Yes
              </label>
            </div>
            <div className="radio-option">
              <label>
                <input
                  type="radio"
                  name="measured-once-per-unit"
                  checked={draft.measuredOnceChoice === 'no'}
                  onChange={() => update({ measuredOnceChoice: 'no' })}
                />
                No
              </label>
            </div>
            <div className="radio-option">
              <label>
                <input
                  type="radio"
                  name="measured-once-per-unit"
                  checked={draft.measuredOnceChoice === 'unknown'}
                  onChange={() => update({ measuredOnceChoice: 'unknown' })}
                />
                I'm not sure
              </label>
            </div>
          </fieldset>
        </div>
      </WizardStepShell>
    )
  }

  return (
    <WizardStepShell
      title="What are you comparing?"
      stepNumber={1}
      totalSteps={2}
      onBack={onExit}
      onNext={handleVariablesNext}
      canProceed={canProceedFromVariables}
    >
      <div className="wizard-fields">
        <div className="field">
          <label htmlFor="correlation-research-question">
            What are you trying to find out? (optional)
          </label>
          <textarea
            id="correlation-research-question"
            value={draft.researchQuestion}
            onChange={(e) => update({ researchQuestion: e.target.value })}
            rows={3}
          />
        </div>

        <div className="field">
          <label htmlFor="x-variable-name">First measurement (X)</label>
          <input
            id="x-variable-name"
            type="text"
            value={draft.xName}
            onChange={(e) => update({ xName: e.target.value })}
            placeholder="e.g. height"
          />
        </div>
        <div className="field">
          <label htmlFor="x-variable-unit">Unit for X (optional)</label>
          <input
            id="x-variable-unit"
            type="text"
            value={draft.xUnit}
            onChange={(e) => update({ xUnit: e.target.value })}
            placeholder="e.g. cm"
          />
        </div>

        <div className="field">
          <label htmlFor="y-variable-name">Second measurement (Y)</label>
          <input
            id="y-variable-name"
            type="text"
            value={draft.yName}
            onChange={(e) => update({ yName: e.target.value })}
            placeholder="e.g. weight"
          />
        </div>
        <div className="field">
          <label htmlFor="y-variable-unit">Unit for Y (optional)</label>
          <input
            id="y-variable-unit"
            type="text"
            value={draft.yUnit}
            onChange={(e) => update({ yUnit: e.target.value })}
            placeholder="e.g. kg"
          />
        </div>
      </div>
    </WizardStepShell>
  )
}
