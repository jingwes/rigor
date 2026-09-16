import { describe, expect, it } from 'vitest'
import { createInitialDraft } from './wizardTypes'
import { toExperimentDesign } from './toExperimentDesign'

describe('toExperimentDesign', () => {
  it('never guesses: unanswered / unsure fields become "unknown" or null, not a default', () => {
    const draft = createInitialDraft()
    const design = toExperimentDesign(draft)

    expect(design.outcome.type).toBe('unknown')
    expect(design.relationship).toBe('unknown')
    expect(design.technicalReplication.present).toBeNull()
    expect(design.researchQuestion).toBeUndefined()
    expect(design.outcome.unit).toBeUndefined()
    expect(design.notes).toBeUndefined()
  })

  it('marks relationship as not applicable (unknown) for a single group even if never asked', () => {
    const draft = { ...createInitialDraft(), groupsCount: 1, groupCountChoice: 'one' as const }
    const design = toExperimentDesign(draft)
    expect(design.relationship).toBe('unknown')
    expect(design.repeatedMeasures.present).toBe(false)
  })

  it('derives repeatedMeasures from an explicit paired/repeated answer only', () => {
    const paired = toExperimentDesign({
      ...createInitialDraft(),
      groupsCount: 2,
      relationship: 'paired',
    })
    expect(paired.repeatedMeasures.present).toBe(true)
    expect(paired.repeatedMeasures.timepoints).toBe(2)

    const independent = toExperimentDesign({
      ...createInitialDraft(),
      groupsCount: 2,
      relationship: 'independent',
    })
    expect(independent.repeatedMeasures.present).toBe(false)
    expect(independent.repeatedMeasures.timepoints).toBeUndefined()
  })

  it('fills unnamed groups with a neutral positional label instead of guessing content', () => {
    const design = toExperimentDesign({
      ...createInitialDraft(),
      groupsCount: 2,
      groupNames: ['Control', ''],
    })
    expect(design.groups.names).toEqual(['Control', 'Group 2'])
  })

  it('resolves "Other" experimental unit to the free-text answer', () => {
    const design = toExperimentDesign({
      ...createInitialDraft(),
      experimentalUnitLabel: 'Other',
      experimentalUnitOther: 'zebrafish tank',
    })
    expect(design.experimentalUnit.label).toBe('zebrafish tank')
  })

  it('produces a complete, well-formed design from a fully answered draft', () => {
    const design = toExperimentDesign({
      researchQuestion: 'Does fertilizer X increase plant height?',
      outcomeName: 'plant height',
      outcomeType: 'continuous',
      outcomeUnit: 'cm',
      groupCountChoice: 'two',
      groupsCount: 2,
      groupNames: ['Control', 'Fertilizer X'],
      relationship: 'independent',
      experimentalUnitLabel: 'Plant',
      experimentalUnitOther: '',
      experimentalUnitDescription: 'individually potted seedlings',
      technicalReplicationPresent: true,
      technicalReplicationMeasurementsPerUnit: '3',
      exclusionsPredefined: true,
      notes: 'Grown under identical light conditions.',
    })

    expect(design).toEqual({
      researchQuestion: 'Does fertilizer X increase plant height?',
      outcome: { name: 'plant height', type: 'continuous', unit: 'cm' },
      groups: { count: 2, names: ['Control', 'Fertilizer X'] },
      relationship: 'independent',
      experimentalUnit: { label: 'Plant', description: 'individually potted seedlings' },
      technicalReplication: { present: true, measurementsPerUnit: 3 },
      repeatedMeasures: { present: false, timepoints: undefined },
      exclusionsPredefined: true,
      notes: 'Grown under identical light conditions.',
    })
  })
})
