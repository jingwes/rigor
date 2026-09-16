import { useId } from 'react'
import type { IntervalType } from './statsMath'

export interface IntervalTypeSelectorProps {
  value: IntervalType
  onChange: (value: IntervalType) => void
}

/**
 * Reusable control (not baked into any one chart) that asks, in plain
 * language, what the error-bar interval on a chart should represent. "SD"
 * and "CI95" are the two primary, always-visible options; SEM lives behind
 * an "Advanced" disclosure since it is easy to misread as "the spread of
 * the data" when it is not.
 *
 * Raw points always render on the charts that use this control's value -
 * this only ever changes the overlay, never the underlying numbers.
 */
export function IntervalTypeSelector({
  value,
  onChange,
}: IntervalTypeSelectorProps) {
  const groupName = useId()

  return (
    <fieldset className="interval-type-selector">
      <legend>What do you want the interval to show?</legend>

      <div className="radio-option">
        <label>
          <input
            type="radio"
            name={groupName}
            value="sd"
            checked={value === 'sd'}
            onChange={() => onChange('sd')}
          />
          Variation among observations
        </label>
        <p className="option-examples">
          Shows the standard deviation: how spread out the individual
          observations are around the mean.
        </p>
      </div>

      <div className="radio-option">
        <label>
          <input
            type="radio"
            name={groupName}
            value="ci95"
            checked={value === 'ci95'}
            onChange={() => onChange('ci95')}
          />
          Uncertainty in the estimated mean
        </label>
        <p className="option-examples">
          Shows a 95% confidence interval: the range likely to contain the true
          mean, given this sample.
        </p>
      </div>

      <details open={value === 'sem'}>
        <summary>Advanced</summary>
        <div className="radio-option">
          <label>
            <input
              type="radio"
              name={groupName}
              value="sem"
              checked={value === 'sem'}
              onChange={() => onChange('sem')}
            />
            Standard error of the mean (SEM)
          </label>
          <p className="option-examples">
            SEM describes uncertainty in the estimated mean. It does not show
            the spread of individual observations.
          </p>
        </div>
      </details>
    </fieldset>
  )
}
