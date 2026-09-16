import type { WizardDraft } from '../wizardTypes'
import type { OutcomeType } from '../../../models/ExperimentDesign'

interface OutcomeTypeOption {
  value: OutcomeType
  label: string
  examples: string
}

const OUTCOME_TYPE_OPTIONS: OutcomeTypeOption[] = [
  {
    value: 'continuous',
    label: 'A numerical measurement',
    examples: 'e.g. height, fluorescence, reaction time, blood pressure, expression level',
  },
  {
    value: 'count',
    label: 'A count',
    examples: 'e.g. number of colonies, cells, or events',
  },
  {
    value: 'binary',
    label: 'Yes/no',
    examples: 'e.g. survived or did not survive, responded or did not respond',
  },
  {
    value: 'categorical',
    label: 'Categories',
    examples: 'e.g. phenotype A/B/C, color, genotype',
  },
  {
    value: 'ordinal',
    label: 'A rating or ordered score',
    examples: 'e.g. a 1-5 severity scale',
  },
  {
    value: 'unknown',
    label: "I'm not sure",
    examples: "That's fine - you can decide this later.",
  },
]

export interface ResearchQuestionStepProps {
  draft: WizardDraft
  onUpdate: (patch: Partial<WizardDraft>) => void
}

export function ResearchQuestionStep({ draft, onUpdate }: ResearchQuestionStepProps) {
  return (
    <div className="wizard-fields">
      <div className="field">
        <label htmlFor="research-question">What are you trying to find out?</label>
        <textarea
          id="research-question"
          value={draft.researchQuestion}
          onChange={(e) => onUpdate({ researchQuestion: e.target.value })}
          rows={3}
        />
      </div>

      <div className="field">
        <label htmlFor="outcome-name">What did you measure?</label>
        <input
          id="outcome-name"
          type="text"
          value={draft.outcomeName}
          onChange={(e) => onUpdate({ outcomeName: e.target.value })}
          placeholder="e.g. plant height"
        />
      </div>

      <fieldset>
        <legend>What kind of thing did you record?</legend>
        {OUTCOME_TYPE_OPTIONS.map((option) => (
          <div className="radio-option" key={option.value}>
            <label>
              <input
                type="radio"
                name="outcome-type"
                value={option.value}
                checked={draft.outcomeType === option.value}
                onChange={() => onUpdate({ outcomeType: option.value })}
              />
              {option.label}
            </label>
            <p className="option-examples">{option.examples}</p>
          </div>
        ))}
      </fieldset>

      <div className="field">
        <label htmlFor="outcome-unit">Unit (optional)</label>
        <input
          id="outcome-unit"
          type="text"
          value={draft.outcomeUnit}
          onChange={(e) => onUpdate({ outcomeUnit: e.target.value })}
          placeholder="e.g. cm, seconds, mmHg"
        />
      </div>
    </div>
  )
}
