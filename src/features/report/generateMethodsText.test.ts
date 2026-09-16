import { describe, expect, it } from 'vitest'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type {
  PairedTTestResult,
  WelchTwoSampleTTestResult,
} from '../../statistics/types'
import { generateMethodsText } from './generateMethodsText'

function design(overrides: Partial<ExperimentDesign> = {}): ExperimentDesign {
  return {
    outcome: { name: 'cell viability', type: 'continuous', unit: '%' },
    groups: { count: 2, names: ['Control', 'Treatment'] },
    relationship: 'independent',
    experimentalUnit: { label: 'independent biological replicate' },
    technicalReplication: { present: false },
    repeatedMeasures: { present: false },
    exclusionsPredefined: false,
    ...overrides,
  }
}

const welchResult: WelchTwoSampleTTestResult = {
  nA: 6,
  nB: 6,
  meanA: 10,
  meanB: 13,
  sdA: 1,
  sdB: 1,
  meanDifference: -3,
  meanDifferenceCi95Low: -5,
  meanDifferenceCi95High: -1,
  tStatistic: -3.67,
  degreesOfFreedom: 10,
  pValue: 0.004,
  effectSize: -2.1,
  effectSizeMethod: 'hedges_g',
}

const pairedResult: PairedTTestResult = {
  nPairs: 16,
  meanDifference: 0.137,
  sdDifference: 0.135,
  meanDifferenceCi95Low: 0.065,
  meanDifferenceCi95High: 0.209,
  tStatistic: 4.06,
  degreesOfFreedom: 15,
  pValue: 0.001,
  effectSize: 1.02,
  effectSizeMethod: 'cohens_d_z',
}

describe('generateMethodsText', () => {
  it('describes the outcome, groups, real n values, and the actual test used (Welch)', () => {
    const text = generateMethodsText({
      design: design(),
      analysis: { analysisType: 'welch-two-sample-t-test', result: welchResult },
      groupALabel: 'Control',
      groupBLabel: 'Treatment',
      excludedObservationCount: 0,
    })

    expect(text).toContain('Cell viability')
    expect(text).toContain('Control')
    expect(text).toContain('Treatment')
    expect(text).toContain('n = 6')
    expect(text).toMatch(/Welch/)
    expect(text).not.toMatch(/paired/i)
  })

  it('describes the paired test with matched-subject counts', () => {
    const text = generateMethodsText({
      design: design({
        groups: { count: 2, names: ['before', 'after'] },
        relationship: 'paired',
      }),
      analysis: { analysisType: 'paired-t-test', result: pairedResult },
      groupALabel: 'before',
      groupBLabel: 'after',
      excludedObservationCount: 0,
    })

    expect(text).toMatch(/paired/i)
    expect(text).toContain('16 matched')
    expect(text).toContain('before')
    expect(text).toContain('after')
  })

  it('mentions real exclusions only when they occurred, and never invents a count', () => {
    const noExclusions = generateMethodsText({
      design: design(),
      analysis: { analysisType: 'welch-two-sample-t-test', result: welchResult },
      groupALabel: 'Control',
      groupBLabel: 'Treatment',
      excludedObservationCount: 0,
    })
    expect(noExclusions).not.toMatch(/excluded/i)

    const withExclusions = generateMethodsText({
      design: design(),
      analysis: { analysisType: 'welch-two-sample-t-test', result: welchResult },
      groupALabel: 'Control',
      groupBLabel: 'Treatment',
      excludedObservationCount: 2,
    })
    expect(withExclusions).toMatch(/2 observations were excluded/i)
  })

  it('states the real app name/version, not a hardcoded/invented one', () => {
    const text = generateMethodsText({
      design: design(),
      analysis: { analysisType: 'welch-two-sample-t-test', result: welchResult },
      groupALabel: 'Control',
      groupBLabel: 'Treatment',
      excludedObservationCount: 0,
    })
    expect(text).toContain(__APP_VERSION__)
  })

  it('is a pure function: identical input produces identical output', () => {
    const input = {
      design: design(),
      analysis: {
        analysisType: 'welch-two-sample-t-test' as const,
        result: welchResult,
      },
      groupALabel: 'Control',
      groupBLabel: 'Treatment',
      excludedObservationCount: 0,
    }
    expect(generateMethodsText(input)).toBe(generateMethodsText(input))
  })
})
