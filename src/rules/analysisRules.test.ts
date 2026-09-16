import { describe, expect, it } from 'vitest'
import type {
  ExperimentDesign,
  OutcomeType,
  StudyRelationship,
} from '../models/ExperimentDesign'
import { recommendAnalysis } from './analysisRules'
import type { AnalysisRecommendation, AnalysisType } from './types'

const OUTCOME_TYPES: OutcomeType[] = [
  'continuous',
  'ordinal',
  'count',
  'binary',
  'categorical',
  'proportion',
  'unknown',
]

const RELATIONSHIPS: StudyRelationship[] = [
  'independent',
  'paired',
  'repeated',
  'nested',
  'unknown',
]

function buildDesign(overrides: {
  outcomeType: OutcomeType
  groupsCount: number
  relationship: StudyRelationship
}): ExperimentDesign {
  const { outcomeType, groupsCount, relationship } = overrides
  return {
    researchQuestion: 'Does the treatment change the outcome?',
    outcome: { name: 'Outcome', type: outcomeType, unit: 'units' },
    groups: {
      count: groupsCount,
      names: Array.from(
        { length: Math.max(groupsCount, 0) },
        (_, i) => `Group ${i + 1}`,
      ),
    },
    relationship,
    experimentalUnit: { label: 'plant' },
    technicalReplication: { present: false },
    repeatedMeasures: { present: false },
    exclusionsPredefined: false,
  }
}

describe('recommendAnalysis: continuous outcome, 2 groups', () => {
  it("recommends Welch t-test for independent groups (never Student's pooled-variance test)", () => {
    const result = recommendAnalysis(
      buildDesign({
        outcomeType: 'continuous',
        groupsCount: 2,
        relationship: 'independent',
      }),
    )
    expect(result.status).toBe('supported')
    expect(result.analysisType).toBe('welch-two-sample-t-test')
    expect(result.ruleId).toBe('CONT-2-INDEPENDENT-001')
    expect(result.explanation).toMatch(/welch/i)
    expect(result.explanation.length).toBeGreaterThan(0)
    // Explicit prohibited-combination guarantee: the engine's AnalysisType
    // union does not even contain a pooled-variance Student's t-test option,
    // so it is structurally impossible for this branch to recommend one.
    expect(result.analysisType).not.toBe('one-way-anova')
  })

  it('recommends paired t-test for paired groups', () => {
    const result = recommendAnalysis(
      buildDesign({
        outcomeType: 'continuous',
        groupsCount: 2,
        relationship: 'paired',
      }),
    )
    expect(result.status).toBe('supported')
    expect(result.analysisType).toBe('paired-t-test')
    expect(result.ruleId).toBe('CONT-2-PAIRED-001')
  })

  it('treats "repeated" (2 timepoints, same units) as paired data', () => {
    const result = recommendAnalysis(
      buildDesign({
        outcomeType: 'continuous',
        groupsCount: 2,
        relationship: 'repeated',
      }),
    )
    expect(result.status).toBe('supported')
    expect(result.analysisType).toBe('paired-t-test')
    expect(result.ruleId).toBe('CONT-2-PAIRED-001')
  })

  it('treats "nested" for exactly two groups as paired (linked, not independent) data', () => {
    const result = recommendAnalysis(
      buildDesign({
        outcomeType: 'continuous',
        groupsCount: 2,
        relationship: 'nested',
      }),
    )
    expect(result.status).toBe('supported')
    expect(result.analysisType).toBe('paired-t-test')
    expect(result.ruleId).toBe('CONT-2-PAIRED-001')
  })

  it('never guesses independent or paired when the relationship is unknown', () => {
    const result = recommendAnalysis(
      buildDesign({
        outcomeType: 'continuous',
        groupsCount: 2,
        relationship: 'unknown',
      }),
    )
    expect(result.status).toBe('needs-information')
    expect(result.analysisType).toBeUndefined()
    expect(result.ruleId).toBe('CONT-2-UNKNOWN-001')
    expect(result.requiredQuestions).toBeDefined()
    expect(result.requiredQuestions!.length).toBeGreaterThan(0)
  })
})

describe('recommendAnalysis: continuous outcome, 3+ groups', () => {
  it('recommends one-way ANOVA for independent groups, with a multiple-comparisons warning', () => {
    const result = recommendAnalysis(
      buildDesign({
        outcomeType: 'continuous',
        groupsCount: 3,
        relationship: 'independent',
      }),
    )
    expect(result.status).toBe('supported')
    expect(result.analysisType).toBe('one-way-anova')
    expect(result.ruleId).toBe('CONT-3PLUS-INDEPENDENT-001')
    expect(result.explanation).toMatch(/multiple testing|correction/i)
    expect(
      result.warnings.some((w) =>
        /multiple testing|correction/i.test(w.message),
      ),
    ).toBe(true)
  })

  it('is unsupported for 3+ paired/repeated groups, and specifically never recommends one-way-anova', () => {
    for (const relationship of ['paired', 'repeated'] as const) {
      const result = recommendAnalysis(
        buildDesign({
          outcomeType: 'continuous',
          groupsCount: 3,
          relationship,
        }),
      )
      expect(result.status).toBe('unsupported')
      expect(result.analysisType).toBeUndefined()
      // This is the safety-critical assertion: a 3+ group repeated-measures
      // design must never be recommended a one-way ANOVA.
      expect(result.analysisType).not.toBe('one-way-anova')
      expect(result.ruleId).toBe('CONT-3PLUS-REPEATED-001')
      expect(result.explanation).toMatch(
        /repeated-measures analysis that is not yet supported/i,
      )
    }
  })

  it('also treats 3+ nested groups as unsupported rather than defaulting to one-way ANOVA (judgment call)', () => {
    const result = recommendAnalysis(
      buildDesign({
        outcomeType: 'continuous',
        groupsCount: 3,
        relationship: 'nested',
      }),
    )
    expect(result.status).toBe('unsupported')
    expect(result.analysisType).toBeUndefined()
    expect(result.analysisType).not.toBe('one-way-anova')
    expect(result.ruleId).toBe('CONT-3PLUS-REPEATED-001')
  })

  it('needs information when the relationship is unknown for 3+ groups', () => {
    const result = recommendAnalysis(
      buildDesign({
        outcomeType: 'continuous',
        groupsCount: 4,
        relationship: 'unknown',
      }),
    )
    expect(result.status).toBe('needs-information')
    expect(result.analysisType).toBeUndefined()
    expect(result.ruleId).toBe('CONT-3PLUS-UNKNOWN-001')
  })
})

describe('recommendAnalysis: continuous outcome, single group', () => {
  it('needs information when there is nothing to compare against', () => {
    const result = recommendAnalysis(
      buildDesign({
        outcomeType: 'continuous',
        groupsCount: 1,
        relationship: 'unknown',
      }),
    )
    expect(result.status).toBe('needs-information')
    expect(result.analysisType).toBeUndefined()
    expect(result.ruleId).toBe('CONT-1-GROUP-001')
  })
})

describe('recommendAnalysis: categorical/binary outcome', () => {
  it('recommends categorical-association for a binary outcome with 2 groups, noting chi-square/Fisher is data-dependent', () => {
    const result = recommendAnalysis(
      buildDesign({
        outcomeType: 'binary',
        groupsCount: 2,
        relationship: 'independent',
      }),
    )
    expect(result.status).toBe('supported')
    expect(result.analysisType).toBe('categorical-association')
    expect(result.ruleId).toBe('CAT-ASSOCIATION-001')
    expect(result.explanation).toMatch(/chi-square/i)
    expect(result.explanation).toMatch(/fisher/i)
  })

  it('recommends categorical-association for a categorical outcome with 3+ groups', () => {
    const result = recommendAnalysis(
      buildDesign({
        outcomeType: 'categorical',
        groupsCount: 4,
        relationship: 'independent',
      }),
    )
    expect(result.status).toBe('supported')
    expect(result.analysisType).toBe('categorical-association')
    expect(result.ruleId).toBe('CAT-ASSOCIATION-001')
  })

  it('needs information for a single categorical group (not yet an association test)', () => {
    for (const outcomeType of ['binary', 'categorical'] as const) {
      const result = recommendAnalysis(
        buildDesign({ outcomeType, groupsCount: 1, relationship: 'unknown' }),
      )
      expect(result.status).toBe('needs-information')
      expect(result.analysisType).toBeUndefined()
      expect(result.ruleId).toBe('CAT-SINGLE-GROUP-001')
      expect(result.explanation).toMatch(/goodness-of-fit/i)
      expect(result.requiredQuestions!.length).toBeGreaterThan(0)
    }
  })
})

describe('recommendAnalysis: unsupported outcome types', () => {
  const unsupportedOutcomeTypes: OutcomeType[] = [
    'ordinal',
    'count',
    'proportion',
    'unknown',
  ]
  const groupCounts = [1, 2, 3, 5]

  it('is unsupported in every case, for every group count and relationship combination', () => {
    for (const outcomeType of unsupportedOutcomeTypes) {
      for (const groupsCount of groupCounts) {
        for (const relationship of RELATIONSHIPS) {
          const result = recommendAnalysis(
            buildDesign({ outcomeType, groupsCount, relationship }),
          )
          expect(result.status).toBe('unsupported')
          expect(result.analysisType).toBeUndefined()
          expect(result.ruleId).toBe(
            `OUTCOME-${outcomeType.toUpperCase()}-UNSUPPORTED-001`,
          )
          expect(result.explanation.length).toBeGreaterThan(0)
        }
      }
    }
  })
})

describe('recommendAnalysis: exhaustive matrix invariants', () => {
  const groupCounts = [0, 1, 2, 3, 4, 5, 10]

  const allResults: Array<{
    fixture: {
      outcomeType: OutcomeType
      groupsCount: number
      relationship: StudyRelationship
    }
    result: AnalysisRecommendation
  }> = []

  for (const outcomeType of OUTCOME_TYPES) {
    for (const groupsCount of groupCounts) {
      for (const relationship of RELATIONSHIPS) {
        const fixture = { outcomeType, groupsCount, relationship }
        allResults.push({
          fixture,
          result: recommendAnalysis(buildDesign(fixture)),
        })
      }
    }
  }

  it('every recommendation has a non-empty explanation and ruleId', () => {
    for (const { result } of allResults) {
      expect(result.explanation).toBeTruthy()
      expect(result.explanation.length).toBeGreaterThan(0)
      expect(result.ruleId).toBeTruthy()
    }
  })

  it('never returns an analysisType unless status is "supported"', () => {
    for (const { fixture, result } of allResults) {
      if (result.status !== 'supported') {
        expect(
          result.analysisType,
          `fixture: ${JSON.stringify(fixture)}`,
        ).toBeUndefined()
      } else {
        expect(
          result.analysisType,
          `fixture: ${JSON.stringify(fixture)}`,
        ).toBeDefined()
      }
    }
  })

  it('always populates warnings as an array (never undefined)', () => {
    for (const { result } of allResults) {
      expect(Array.isArray(result.warnings)).toBe(true)
    }
  })

  it('never recommends repeated-measures-anova (reserved, not implemented in V1)', () => {
    for (const { result } of allResults) {
      expect(result.analysisType).not.toBe(
        'repeated-measures-anova' satisfies AnalysisType,
      )
    }
  })

  it('never recommends one-way-anova for a continuous 3+ group paired/repeated/nested design', () => {
    const dangerousFixtures = allResults.filter(
      ({ fixture }) =>
        fixture.outcomeType === 'continuous' &&
        fixture.groupsCount >= 3 &&
        (fixture.relationship === 'paired' ||
          fixture.relationship === 'repeated' ||
          fixture.relationship === 'nested'),
    )
    expect(dangerousFixtures.length).toBeGreaterThan(0)
    for (const { result } of dangerousFixtures) {
      expect(result.status).toBe('unsupported')
      expect(result.analysisType).not.toBe('one-way-anova')
      expect(result.analysisType).toBeUndefined()
    }
  })

  it('every ruleId consistently maps to the same status/analysisType wherever it appears', () => {
    const behaviorByRuleId = new Map<string, string>()
    for (const { fixture, result } of allResults) {
      const behavior = JSON.stringify({
        status: result.status,
        analysisType: result.analysisType,
      })
      const seen = behaviorByRuleId.get(result.ruleId)
      if (seen === undefined) {
        behaviorByRuleId.set(result.ruleId, behavior)
      } else {
        expect(
          behavior,
          `ruleId ${result.ruleId} for fixture ${JSON.stringify(fixture)}`,
        ).toBe(seen)
      }
    }

    const expectedRuleIds = [
      'CONT-2-INDEPENDENT-001',
      'CONT-2-PAIRED-001',
      'CONT-2-UNKNOWN-001',
      'CONT-3PLUS-INDEPENDENT-001',
      'CONT-3PLUS-REPEATED-001',
      'CONT-3PLUS-UNKNOWN-001',
      'CONT-1-GROUP-001',
      'CAT-ASSOCIATION-001',
      'CAT-SINGLE-GROUP-001',
      'OUTCOME-ORDINAL-UNSUPPORTED-001',
      'OUTCOME-COUNT-UNSUPPORTED-001',
      'OUTCOME-PROPORTION-UNSUPPORTED-001',
      'OUTCOME-UNKNOWN-UNSUPPORTED-001',
    ]
    const seenRuleIds = new Set(allResults.map(({ result }) => result.ruleId))
    expect(new Set(expectedRuleIds)).toEqual(seenRuleIds)
  })
})
