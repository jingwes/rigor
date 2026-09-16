import { describe, expect, it } from 'vitest'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type { OneWayAnovaResult, WelchTwoSampleTTestResult } from '../../statistics/types'
import { generateInterpretationText } from './generateInterpretationText'

function design(): ExperimentDesign {
  return {
    outcome: { name: 'cell viability', type: 'continuous', unit: '%' },
    groups: { count: 2, names: ['Control', 'Treatment'] },
    relationship: 'independent',
    experimentalUnit: { label: 'replicate' },
    technicalReplication: { present: false },
    repeatedMeasures: { present: false },
    exclusionsPredefined: false,
  }
}

const result: WelchTwoSampleTTestResult = {
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
  pValue: 0.0001,
  effectSize: -2.1,
  effectSizeMethod: 'hedges_g',
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
    pValue: 0.0001,
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

describe('generateInterpretationText', () => {
  it('leads with the estimate and CI, states the p-value, and names the groups', () => {
    const text = generateInterpretationText({
      design: design(),
      analysis: { analysisType: 'welch-two-sample-t-test', result },
      groupALabel: 'Control',
      groupBLabel: 'Treatment',
    })
    expect(text).toContain('-3')
    expect(text).toContain('-5')
    expect(text).toContain('-1')
    expect(text).toContain('Control')
    expect(text).toContain('Treatment')
    expect(text).toContain('P < 0.001')
  })

  it('never claims proof, causation, or that the alternative hypothesis was accepted', () => {
    const text = generateInterpretationText({
      design: design(),
      analysis: { analysisType: 'welch-two-sample-t-test', result },
      groupALabel: 'Control',
      groupBLabel: 'Treatment',
    })
    const lower = text.toLowerCase()
    expect(lower).not.toContain('the treatment works')
    expect(lower).not.toContain('we accept the alternative')
    expect(lower).not.toContain('proves that')
    expect(lower).not.toContain('confirms that')
    expect(lower).not.toContain('is valid')
  })
})

describe('generateInterpretationText - one-way ANOVA (Milestone 8)', () => {
  function anovaDesign(): ExperimentDesign {
    return {
      outcome: { name: 'cell viability', type: 'continuous', unit: '%' },
      groups: { count: 3, names: ['Control', 'Low dose', 'High dose'] },
      relationship: 'independent',
      experimentalUnit: { label: 'replicate' },
      technicalReplication: { present: false },
      repeatedMeasures: { present: false },
      exclusionsPredefined: false,
    }
  }

  it('states the omnibus F/df/p, separately from the pairwise comparisons', () => {
    const text = generateInterpretationText({
      design: anovaDesign(),
      analysis: { analysisType: 'one-way-anova', result: anovaResult },
    })
    expect(text).toMatch(/F = 5\.18/)
    expect(text).toContain('P < 0.001')
    expect(text).toContain('Control')
    expect(text).toContain('Low dose')
    expect(text).toContain('High dose')
  })

  it('includes the required "adjusted for multiple testing" explanation', () => {
    const text = generateInterpretationText({
      design: anovaDesign(),
      analysis: { analysisType: 'one-way-anova', result: anovaResult },
    })
    expect(text.toLowerCase()).toContain('increases the chance of false-positive results')
    expect(text.toLowerCase()).toContain('adjusted for multiple testing')
  })

  it('only ever states the Holm-Bonferroni-adjusted p-value for each pair, never the raw one', () => {
    const text = generateInterpretationText({
      design: anovaDesign(),
      analysis: { analysisType: 'one-way-anova', result: anovaResult },
    })
    // 0.0958 (adjusted) must appear for the Control/High-dose comparison,
    // but the raw 0.0479 for that same comparison must not appear anywhere
    // in the interpretation text.
    expect(text).not.toContain('0.048')
    expect(text).not.toContain('0.047')
  })

  it('never claims proof, causation, or that the alternative hypothesis was accepted', () => {
    const text = generateInterpretationText({
      design: anovaDesign(),
      analysis: { analysisType: 'one-way-anova', result: anovaResult },
    })
    const lower = text.toLowerCase()
    expect(lower).not.toContain('the treatment works')
    expect(lower).not.toContain('we accept the alternative')
    expect(lower).not.toContain('proves that')
    expect(lower).not.toContain('confirms that')
  })
})
