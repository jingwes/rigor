import type { WizardDraft } from '../wizardTypes'

export interface FinalDetailsStepProps {
  draft: WizardDraft
  onUpdate: (patch: Partial<WizardDraft>) => void
}

export function FinalDetailsStep({ draft, onUpdate }: FinalDetailsStepProps) {
  return (
    <div className="wizard-fields">
      <fieldset>
        <legend>
          Did you decide, before collecting data, whether any observations would be excluded (for
          example, equipment failure or a predefined quality check)?
        </legend>
        <div className="radio-option">
          <label>
            <input
              type="radio"
              name="exclusions-predefined"
              checked={draft.exclusionsPredefined === true}
              onChange={() => onUpdate({ exclusionsPredefined: true })}
            />
            Yes
          </label>
        </div>
        <div className="radio-option">
          <label>
            <input
              type="radio"
              name="exclusions-predefined"
              checked={draft.exclusionsPredefined === false}
              onChange={() => onUpdate({ exclusionsPredefined: false })}
            />
            No
          </label>
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="notes">Anything else we should know? (optional)</label>
        <textarea
          id="notes"
          value={draft.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  )
}
