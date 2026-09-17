import type { WizardDraft } from '../wizardTypes'
import { EXPERIMENTAL_UNIT_PRESETS } from '../wizardTypes'

export interface ExperimentalUnitStepProps {
  draft: WizardDraft
  onUpdate: (patch: Partial<WizardDraft>) => void
}

export function ExperimentalUnitStep({ draft, onUpdate }: ExperimentalUnitStepProps) {
  return (
    <div className="wizard-fields">
      <fieldset>
        <legend>What was independently assigned to a treatment or condition?</legend>
        {EXPERIMENTAL_UNIT_PRESETS.map((preset) => (
          <div className="radio-option" key={preset}>
            <label>
              <input
                type="radio"
                name="experimental-unit"
                value={preset}
                checked={draft.experimentalUnitLabel === preset}
                onChange={() => onUpdate({ experimentalUnitLabel: preset })}
              />
              {preset}
            </label>
          </div>
        ))}
      </fieldset>

      {draft.experimentalUnitLabel === 'Other' && (
        <div className="field">
          <label htmlFor="experimental-unit-other">Please describe it</label>
          <input
            id="experimental-unit-other"
            type="text"
            value={draft.experimentalUnitOther}
            onChange={(e) => onUpdate({ experimentalUnitOther: e.target.value })}
          />
        </div>
      )}

      <div className="field">
        <label htmlFor="experimental-unit-description">
          Add more detail about your experimental unit (optional)
        </label>
        <input
          id="experimental-unit-description"
          type="text"
          value={draft.experimentalUnitDescription}
          onChange={(e) => onUpdate({ experimentalUnitDescription: e.target.value })}
          placeholder="e.g. which mouse strain, which cell line, which plant variety"
        />
        <p className="field-hint">
          For example: 8-week-old zebrafish from the same clutch, C57BL/6 mice, or HeLa cells.
        </p>
      </div>

      <fieldset>
        <legend>Did you take several measurements from each of these?</legend>
        <p className="option-examples">
          e.g. several cells from one mouse, several images from one well, repeated instrument
          readings from the same sample
        </p>
        <div className="radio-option">
          <label>
            <input
              type="radio"
              name="technical-replication"
              checked={draft.technicalReplicationPresent === true}
              onChange={() => onUpdate({ technicalReplicationPresent: true })}
            />
            Yes
          </label>
        </div>
        <div className="radio-option">
          <label>
            <input
              type="radio"
              name="technical-replication"
              checked={draft.technicalReplicationPresent === false}
              onChange={() =>
                onUpdate({
                  technicalReplicationPresent: false,
                  technicalReplicationMeasurementsPerUnit: '',
                })
              }
            />
            No
          </label>
        </div>
        <div className="radio-option">
          <label>
            <input
              type="radio"
              name="technical-replication"
              checked={draft.technicalReplicationPresent === null}
              onChange={() =>
                onUpdate({
                  technicalReplicationPresent: null,
                  technicalReplicationMeasurementsPerUnit: '',
                })
              }
            />
            Not sure
          </label>
        </div>
      </fieldset>

      {draft.technicalReplicationPresent === true && (
        <div className="field">
          <label htmlFor="measurements-per-unit">
            About how many measurements per unit, typically?
          </label>
          <input
            id="measurements-per-unit"
            type="number"
            min={1}
            value={draft.technicalReplicationMeasurementsPerUnit}
            onChange={(e) => onUpdate({ technicalReplicationMeasurementsPerUnit: e.target.value })}
          />
          <p className="field-hint">
            If this varies, just enter a typical number - you'll be able to enter exact counts per
            unit when you get to data entry.
          </p>
        </div>
      )}
    </div>
  )
}
