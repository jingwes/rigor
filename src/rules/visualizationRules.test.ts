import { describe, expect, it } from 'vitest'
import {
  evaluateLogScaleRequest,
  evaluateNonZeroBaselineWarning,
  evaluateUnitsMixupWarning,
} from './visualizationRules'

describe('evaluateLogScaleRequest', () => {
  it('allows a log axis when all values are positive', () => {
    const result = evaluateLogScaleRequest([1, 2, 3, 100])
    expect(result.allowed).toBe(true)
    expect(result.warning).toBeNull()
  })

  it('disallows and warns when a value is zero', () => {
    const result = evaluateLogScaleRequest([0, 2, 3])
    expect(result.allowed).toBe(false)
    expect(result.warning).not.toBeNull()
    expect(result.warning?.id).toBe('log-scale-nonpositive-values')
  })

  it('disallows and warns when a value is negative', () => {
    const result = evaluateLogScaleRequest([-1, 2, 3])
    expect(result.allowed).toBe(false)
    expect(result.warning?.severity).toBe('caution')
  })

  it('does not warn for an empty array', () => {
    const result = evaluateLogScaleRequest([])
    expect(result.allowed).toBe(true)
    expect(result.warning).toBeNull()
  })
})

describe('evaluateNonZeroBaselineWarning', () => {
  it('warns when a non-zero baseline is set for a zero-meaningful quantity', () => {
    const warning = evaluateNonZeroBaselineWarning({ yAxisMin: 10 })
    expect(warning).not.toBeNull()
    expect(warning?.id).toBe('non-zero-baseline')
  })

  it('does not warn when the baseline is zero', () => {
    const warning = evaluateNonZeroBaselineWarning({ yAxisMin: 0 })
    expect(warning).toBeNull()
  })

  it('does not warn when zero is not a meaningful reference point', () => {
    const warning = evaluateNonZeroBaselineWarning({
      yAxisMin: 10,
      zeroIsMeaningful: false,
    })
    expect(warning).toBeNull()
  })

  it('is overridable (a caution, not a hard block)', () => {
    const warning = evaluateNonZeroBaselineWarning({ yAxisMin: 5 })
    expect(warning?.severity).toBe('caution')
  })
})

describe('evaluateUnitsMixupWarning', () => {
  it('does not warn when no unit label is given', () => {
    expect(evaluateUnitsMixupWarning([0.1, 0.2, 0.5], undefined)).toBeNull()
  })

  it('does not warn for valid percentages (0-100)', () => {
    expect(evaluateUnitsMixupWarning([10, 42, 99], '%')).toBeNull()
  })

  it('warns for percentages outside 0-100', () => {
    const warning = evaluateUnitsMixupWarning([10, 150], 'percent')
    expect(warning?.id).toBe('units-mixup-percentage-out-of-range')
  })

  it('warns when values labeled as percentage all look like proportions', () => {
    const warning = evaluateUnitsMixupWarning([0.1, 0.3, 0.9], '%')
    expect(warning?.id).toBe('units-mixup-percentage-looks-like-proportion')
  })

  it('does not warn for valid proportions (0-1)', () => {
    expect(evaluateUnitsMixupWarning([0.1, 0.5, 1], 'proportion')).toBeNull()
  })

  it('warns for proportions outside 0-1', () => {
    const warning = evaluateUnitsMixupWarning([0.5, 42], 'fraction')
    expect(warning?.id).toBe('units-mixup-proportion-out-of-range')
  })

  it('does not warn for an unrelated unit label', () => {
    expect(evaluateUnitsMixupWarning([1, 2, 500], 'grams')).toBeNull()
  })
})
