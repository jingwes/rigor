import { describe, expect, it } from 'vitest'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type { WelchTwoSampleTTestResult } from '../../statistics/types'
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
