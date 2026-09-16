import { describe, expect, it } from 'vitest'
import { createInitialDraft } from './wizardTypes'
import {
  canProceedFromStep,
  getNextStepId,
  getPreviousStepId,
  isStepApplicable,
  resizeGroupNames,
} from './wizardLogic'

describe('resizeGroupNames', () => {
  it('pads with empty strings and never invents a name', () => {
    expect(resizeGroupNames([], 3)).toEqual(['', '', ''])
  })

  it('preserves existing names when growing', () => {
    expect(resizeGroupNames(['Control'], 3)).toEqual(['Control', '', ''])
  })

  it('truncates when shrinking', () => {
    expect(resizeGroupNames(['Control', 'Drug A', 'Drug B'], 2)).toEqual(['Control', 'Drug A'])
  })
})

describe('isStepApplicable', () => {
  it('skips the relationship step for a single group', () => {
    const draft = { ...createInitialDraft(), groupsCount: 1 }
    expect(isStepApplicable('relationship', draft)).toBe(false)
  })

  it('includes the relationship step for two or more groups', () => {
    const draft = { ...createInitialDraft(), groupsCount: 2 }
    expect(isStepApplicable('relationship', draft)).toBe(true)
  })
})

describe('step navigation', () => {
  it('skips relationship when there is only one group', () => {
    const draft = { ...createInitialDraft(), groupsCount: 1 }
    expect(getNextStepId('groups', draft)).toBe('experimentalUnit')
    expect(getPreviousStepId('experimentalUnit', draft)).toBe('groups')
  })

  it('visits relationship when there are two groups', () => {
    const draft = { ...createInitialDraft(), groupsCount: 2 }
    expect(getNextStepId('groups', draft)).toBe('relationship')
  })

  it('has no next step after summary and no previous step before the first step', () => {
    const draft = createInitialDraft()
    expect(getNextStepId('summary', draft)).toBeNull()
    expect(getPreviousStepId('researchQuestion', draft)).toBeNull()
  })
})

describe('canProceedFromStep', () => {
  it('blocks the research question step until outcome name and type are set', () => {
    const draft = createInitialDraft()
    expect(canProceedFromStep('researchQuestion', draft)).toBe(false)
    expect(
      canProceedFromStep('researchQuestion', { ...draft, outcomeName: 'height' }),
    ).toBe(false)
    expect(
      canProceedFromStep('researchQuestion', {
        ...draft,
        outcomeName: 'height',
        outcomeType: 'unknown',
      }),
    ).toBe(true)
  })

  it('accepts "not sure" as a complete answer for technical replication', () => {
    const draft = {
      ...createInitialDraft(),
      experimentalUnitLabel: 'Plant',
      technicalReplicationPresent: null,
    }
    expect(canProceedFromStep('experimentalUnit', draft)).toBe(true)
  })

  it('requires an answer before leaving the final-details step', () => {
    const draft = createInitialDraft()
    expect(canProceedFromStep('finalDetails', draft)).toBe(false)
    expect(canProceedFromStep('finalDetails', { ...draft, exclusionsPredefined: false })).toBe(true)
  })
})
