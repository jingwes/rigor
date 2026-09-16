/**
 * Milestone 5: axis-misuse warnings for chart customization.
 *
 * These are small, pure, independently-testable functions that check a
 * *proposed* chart configuration against the raw values it would plot, and
 * return a `Warning` (reusing the `Warning` shape from `./types`, the same
 * one the Milestone 2 rules engine uses) when something looks likely to
 * mislead a reader.
 *
 * Per the project's philosophy, these are explanatory cautions the student
 * can knowingly override, not hard prohibitions - with one narrow exception:
 * a logarithmic axis is mathematically undefined for zero/negative values,
 * so that specific axis *option* is reported as not `allowed` (the chart
 * itself is never blocked - it falls back to a linear axis rather than
 * silently producing a broken log-scale chart).
 *
 * No React, no rendering, no dependency on `src/rules/analysisRules.ts` or
 * any other existing rules file.
 */

import type { Warning } from './types'

export interface LogScaleEvaluation {
  /** Whether a log axis may be applied to these values as-is. */
  allowed: boolean
  /** Present whenever a log axis was requested but is not (fully) safe. */
  warning: Warning | null
}

/**
 * Log scale is undefined at zero and negative numbers (log(0) = -Infinity,
 * log of a negative number is not a real number). If any value in the data
 * is <= 0, a log axis cannot represent it, so the log option must be
 * disabled/ignored for this dataset rather than silently producing an
 * incomplete or broken chart.
 */
export function evaluateLogScaleRequest(
  values: readonly number[],
): LogScaleEvaluation {
  const hasNonPositiveValue = values.some((value) => value <= 0)

  if (!hasNonPositiveValue) {
    return { allowed: true, warning: null }
  }

  return {
    allowed: false,
    warning: {
      id: 'log-scale-nonpositive-values',
      message:
        'A logarithmic axis is undefined for zero or negative values, ' +
        'so it cannot be used with this data. The chart will use a ' +
        'linear axis instead.',
      severity: 'caution',
    },
  }
}

export interface NonZeroBaselineParams {
  /** The Y-axis minimum the student has configured (their chosen baseline). */
  yAxisMin: number
  /**
   * Whether zero is a meaningful reference point for this quantity (true for
   * most counts, concentrations, durations, percentages, and other
   * ratio-scale measurements where "none of it" is a real, comparable
   * state). Callers/the customization UI decide this - it cannot be
   * inferred from the numbers alone (e.g. temperature in Celsius has an
   * arbitrary zero, so this would be `false` for that quantity). Defaults
   * to `true`, since most classroom experimental quantities are ratio-scale.
   */
  zeroIsMeaningful?: boolean
}

/**
 * Truncating the Y-axis so it does not start at zero can visually exaggerate
 * (or shrink) differences between groups relative to their true magnitude.
 * This is a caution, not a prohibition: sometimes a non-zero baseline is the
 * right call (e.g. zooming into a narrow, already-established range), so the
 * student may override it - they are just shown why it matters first.
 */
export function evaluateNonZeroBaselineWarning({
  yAxisMin,
  zeroIsMeaningful = true,
}: NonZeroBaselineParams): Warning | null {
  if (!zeroIsMeaningful) return null
  if (yAxisMin === 0) return null

  return {
    id: 'non-zero-baseline',
    message:
      'This chart’s Y-axis does not start at zero. For this kind of ' +
      'quantity, zero is a meaningful reference point, and a non-zero ' +
      'baseline can make differences between groups look larger (or ' +
      'smaller) than they really are. This can be the right choice in some ' +
      'contexts (e.g. zooming into an already-established range) - just make ' +
      'sure the axis start is clearly labeled if you keep it.',
    severity: 'caution',
  }
}

/**
 * Heuristic (deliberately not exhaustive) check for a units mix-up between
 * percentages (conventionally 0-100) and proportions (conventionally 0-1),
 * based on the axis unit label the student typed plus the actual values:
 *
 *  - If the unit looks like a percentage ("%", "percent", "percentage") but
 *    any value falls outside [0, 100], that is very likely not a valid
 *    percentage.
 *  - If the unit looks like a percentage but *every* value falls inside
 *    [0, 1], the values look like an un-multiplied proportion mislabeled as
 *    a percentage (e.g. 0.42 instead of 42).
 *  - If the unit looks like a proportion/fraction/ratio but any value falls
 *    outside [0, 1], that is likely either an unconverted percentage or an
 *    otherwise invalid proportion.
 *
 * This only looks at the declared unit label and the numeric range - it
 * cannot know the "true" units, so it is a nudge to double-check, not a
 * verdict.
 */
export function evaluateUnitsMixupWarning(
  values: readonly number[],
  unitLabel: string | undefined,
): Warning | null {
  if (!unitLabel || values.length === 0) return null

  const normalizedUnit = unitLabel.trim().toLowerCase()
  const looksLikePercentage =
    normalizedUnit.includes('%') || normalizedUnit.includes('percent')
  const looksLikeProportion =
    !looksLikePercentage &&
    (normalizedUnit.includes('proportion') ||
      normalizedUnit.includes('fraction') ||
      normalizedUnit.includes('ratio'))

  if (looksLikePercentage) {
    const outOfRange = values.some((value) => value < 0 || value > 100)
    if (outOfRange) {
      return {
        id: 'units-mixup-percentage-out-of-range',
        message:
          'This axis is labeled as a percentage, but some values fall ' +
          'outside the 0-100 range. Double-check that the values are ' +
          'expressed as percentages (e.g. 42, not 0.42) and not another ' +
          'unit.',
        severity: 'caution',
      }
    }

    const allWithinUnitInterval = values.every(
      (value) => value >= 0 && value <= 1,
    )
    if (allWithinUnitInterval) {
      return {
        id: 'units-mixup-percentage-looks-like-proportion',
        message:
          'This axis is labeled as a percentage, but every value is between ' +
          '0 and 1. These values look like they might be an un-converted ' +
          'proportion (e.g. 0.42 rather than 42%). Double-check whether ' +
          'they need to be multiplied by 100.',
        severity: 'caution',
      }
    }

    return null
  }

  if (looksLikeProportion) {
    const outOfRange = values.some((value) => value < 0 || value > 1)
    if (outOfRange) {
      return {
        id: 'units-mixup-proportion-out-of-range',
        message:
          'This axis is labeled as a proportion/fraction, but some values ' +
          'fall outside the 0-1 range. Double-check whether these are ' +
          'actually percentages (e.g. 42 rather than 0.42).',
        severity: 'caution',
      }
    }
  }

  return null
}
