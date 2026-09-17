import { describe, expect, it } from 'vitest'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type {
  OneWayAnovaResult,
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

const anovaResult: OneWayAnovaResult = {
  groups: [
    {
      label: 'Control',
      n: 10,
      mean: 5.032,
      median: 5.155,
      sd: 0.583,
      q1: 4.56,
      q3: 5.3,
      iqr: 0.74,
      min: 4.17,
      max: 6.11,
      ci95Low: 4.61,
      ci95High: 5.45,
    },
    {
      label: 'Low dose',
      n: 10,
      mean: 4.661,
      median: 4.55,
      sd: 0.794,
      q1: 4.19,
      q3: 4.87,
      iqr: 0.68,
      min: 3.59,
      max: 6.03,
      ci95Low: 4.09,
      ci95High: 5.23,
    },
    {
      label: 'High dose',
      n: 10,
      mean: 5.526,
      median: 5.435,
      sd: 0.443,
      q1: 5.26,
      q3: 5.8,
      iqr: 0.54,
      min: 4.92,
      max: 6.31,
      ci95Low: 5.21,
      ci95High: 5.84,
    },
  ],
  omnibus: {
    method: 'welch_anova',
    fStatistic: 5.181,
    numeratorDf: 2,
    denominatorDf: 17.128,
    pValue: 0.0174,
  },
  pairwiseComparisons: [
    {
      groupALabel: 'Control',
      groupBLabel: 'Low dose',
      meanDifference: 0.371,
      tStatistic: 1.191,
      degreesOfFreedom: 16.52,
      pValueRaw: 0.2504,
      pValueAdjusted: 0.2504,
      effectSize: 0.51,
      effectSizeMethod: 'hedges_g',
    },
    {
      groupALabel: 'Control',
      groupBLabel: 'High dose',
      meanDifference: -0.494,
      tStatistic: -2.134,
      degreesOfFreedom: 16.79,
      pValueRaw: 0.0479,
      pValueAdjusted: 0.0958,
      effectSize: -0.914,
      effectSizeMethod: 'hedges_g',
    },
    {
      groupALabel: 'Low dose',
      groupBLabel: 'High dose',
      meanDifference: -0.865,
      tStatistic: -3.01,
      degreesOfFreedom: 14.1,
      pValueRaw: 0.0093,
      pValueAdjusted: 0.0279,
      effectSize: -1.289,
      effectSizeMethod: 'hedges_g',
    },
  ],
  pairwiseCorrectionMethod: 'holm_bonferroni',
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

describe('generateMethodsText - control/reference group designation (Milestone 15)', () => {
  it('notes the designated control group for a two-group Welch test', () => {
    const text = generateMethodsText({
      design: design({
        groups: { count: 2, names: ['Vehicle', 'Drug A'], roles: { Vehicle: 'negative-control' } },
      }),
      analysis: { analysisType: 'welch-two-sample-t-test', result: welchResult },
      groupALabel: 'Vehicle',
      groupBLabel: 'Drug A',
      excludedObservationCount: 0,
    })
    expect(text).toContain('the designated negative control group')
  })

  it('leaves the two-group methods text unchanged when no group is designated (default)', () => {
    const text = generateMethodsText({
      design: design(),
      analysis: { analysisType: 'welch-two-sample-t-test', result: welchResult },
      groupALabel: 'Control',
      groupBLabel: 'Treatment',
      excludedObservationCount: 0,
    })
    expect(text).not.toMatch(/designated/i)
  })

  it('notes the designated control group for a one-way ANOVA', () => {
    const text = generateMethodsText({
      design: design({
        groups: {
          count: 3,
          names: ['Control', 'Low dose', 'High dose'],
          roles: { Control: 'control' },
        },
      }),
      analysis: { analysisType: 'one-way-anova', result: anovaResult },
      excludedObservationCount: 0,
    })
    expect(text).toContain(
      '"Control" (n = 10 independent biological replicates, the designated control (reference) group)',
    )
  })
})

describe('generateMethodsText - one-way ANOVA (Milestone 8)', () => {
  function anovaDesign(): ExperimentDesign {
    return design({ groups: { count: 3, names: ['Control', 'Low dose', 'High dose'] } })
  }

  it('describes the outcome, all real group n values, and names Welch ANOVA', () => {
    const text = generateMethodsText({
      design: anovaDesign(),
      analysis: { analysisType: 'one-way-anova', result: anovaResult },
      excludedObservationCount: 0,
    })

    expect(text).toContain('Cell viability')
    expect(text).toContain('Control')
    expect(text).toContain('Low dose')
    expect(text).toContain('High dose')
    // Real per-group n's, not a single invented total.
    expect(text).toContain('n = 10')
    expect(text).toMatch(/Welch/)
    expect(text).toMatch(/one-way ANOVA/i)
  })

  it('states that pairwise comparisons were corrected for multiple testing (Holm-Bonferroni)', () => {
    const text = generateMethodsText({
      design: anovaDesign(),
      analysis: { analysisType: 'one-way-anova', result: anovaResult },
      excludedObservationCount: 0,
    })
    expect(text).toMatch(/holm-bonferroni/i)
    expect(text).toMatch(/multiple testing/i)
    expect(text).toContain('3 pairwise comparisons')
  })

  it('does not require groupALabel/groupBLabel (reads labels from the result itself)', () => {
    expect(() =>
      generateMethodsText({
        design: anovaDesign(),
        analysis: { analysisType: 'one-way-anova', result: anovaResult },
        excludedObservationCount: 0,
      }),
    ).not.toThrow()
  })

  it('mentions real exclusions only when they occurred', () => {
    const withExclusions = generateMethodsText({
      design: anovaDesign(),
      analysis: { analysisType: 'one-way-anova', result: anovaResult },
      excludedObservationCount: 3,
    })
    expect(withExclusions).toMatch(/3 observations were excluded/i)
  })
})
