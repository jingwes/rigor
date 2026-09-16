import { describe, expect, it } from 'vitest'
import {
  computeInterval,
  confidenceInterval95,
  mean,
  sampleStandardDeviation,
  standardErrorOfMean,
  tCriticalValue95,
} from './statsMath'

describe('mean', () => {
  it('computes the arithmetic mean', () => {
    expect(mean([2, 4, 6, 8])).toBe(5)
  })

  it('throws on empty input', () => {
    expect(() => mean([])).toThrow()
  })
})

// Worked example A: values = [2, 4, 6, 8].
// mean = 5; squared deviations = 9, 1, 1, 9 -> sum 20; sample variance =
// 20 / (4-1) = 6.6666...; sample sd = sqrt(6.6666...) = 2.581989 (hand
// calculation, cross-checked independently of this codebase).
describe('worked example A: [2, 4, 6, 8]', () => {
  const values = [2, 4, 6, 8]

  it('sample standard deviation ~= 2.581989', () => {
    expect(sampleStandardDeviation(values)).toBeCloseTo(2.581989, 5)
  })

  it('SEM = sd / sqrt(4) ~= 1.290994', () => {
    expect(standardErrorOfMean(values)).toBeCloseTo(1.290994, 5)
  })

  it('95% CI uses t(df=3) = 3.182, giving [0.8921, 9.1079]', () => {
    const ci = confidenceInterval95(values)
    expect(ci).not.toBeNull()
    expect(ci?.mean).toBe(5)
    expect(ci?.lower).toBeCloseTo(0.8921, 3)
    expect(ci?.upper).toBeCloseTo(9.1079, 3)
  })
})

// Worked example B: the classic Khan-Academy-style dataset
// values = [2, 4, 4, 4, 5, 5, 7, 9], n = 8.
// mean = 5; squared deviations sum to 32; sample variance = 32/7 =
// 4.571429; sample sd = sqrt(4.571429) = 2.138090 (population sd for this
// same dataset is the well-known value 2; the sample, n-1, sd is used here
// since these are experimental observations, not a full population).
describe('worked example B: [2, 4, 4, 4, 5, 5, 7, 9]', () => {
  const values = [2, 4, 4, 4, 5, 5, 7, 9]

  it('sample standard deviation ~= 2.138090', () => {
    expect(sampleStandardDeviation(values)).toBeCloseTo(2.13809, 5)
  })

  it('SEM ~= 0.755929', () => {
    expect(standardErrorOfMean(values)).toBeCloseTo(0.755929, 5)
  })

  it('95% CI uses t(df=7) = 2.365, giving [3.2122, 6.7878]', () => {
    const ci = confidenceInterval95(values)
    expect(ci).not.toBeNull()
    expect(ci?.lower).toBeCloseTo(3.2122, 3)
    expect(ci?.upper).toBeCloseTo(6.7878, 3)
  })
})

describe('tCriticalValue95', () => {
  it('matches the standard table for small df', () => {
    expect(tCriticalValue95(1)).toBeCloseTo(12.706, 3)
    expect(tCriticalValue95(10)).toBeCloseTo(2.228, 3)
    expect(tCriticalValue95(30)).toBeCloseTo(2.042, 3)
  })

  it('falls back to the normal z-critical value (1.96) beyond df=30', () => {
    expect(tCriticalValue95(31)).toBe(1.96)
    expect(tCriticalValue95(500)).toBe(1.96)
  })

  it('rejects degrees of freedom below 1', () => {
    expect(() => tCriticalValue95(0)).toThrow()
  })
})

describe('interval math edge cases', () => {
  it('returns null for sd/sem/ci95 when n < 2', () => {
    expect(sampleStandardDeviation([5])).toBeNull()
    expect(standardErrorOfMean([5])).toBeNull()
    expect(confidenceInterval95([5])).toBeNull()
    expect(computeInterval([5], 'sd')).toBeNull()
    expect(computeInterval([], 'ci95')).toBeNull()
  })
})

describe('computeInterval', () => {
  const values = [2, 4, 6, 8]

  it('dispatches to sd', () => {
    const result = computeInterval(values, 'sd')
    expect(result?.halfWidth).toBeCloseTo(2.581989, 5)
  })

  it('dispatches to sem', () => {
    const result = computeInterval(values, 'sem')
    expect(result?.halfWidth).toBeCloseTo(1.290994, 5)
  })

  it('dispatches to ci95', () => {
    const result = computeInterval(values, 'ci95')
    expect(result?.halfWidth).toBeCloseTo(4.107944, 5)
  })

  it('all interval types share the same mean', () => {
    for (const type of ['sd', 'sem', 'ci95'] as const) {
      expect(computeInterval(values, type)?.mean).toBe(5)
    }
  })
})
