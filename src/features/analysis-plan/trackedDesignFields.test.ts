import { describe, expect, it } from 'vitest'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import {
  describeTrackedFieldChanges,
  diffTrackedDesignFields,
  extractTrackedDesignFields,
} from './trackedDesignFields'

function baseDesign(overrides: Partial<ExperimentDesign> = {}): ExperimentDesign {
  return {
    researchQuestion: 'Does fertilizer X increase plant height?',
    outcome: { name: 'plant height', type: 'continuous', unit: 'cm' },
    groups: { count: 2, names: ['Control', 'Treatment'] },
    relationship: 'independent',
    experimentalUnit: { label: 'Plant' },
    technicalReplication: { present: false },
    repeatedMeasures: { present: false },
    exclusionsPredefined: false,
    ...overrides,
  }
}

describe('extractTrackedDesignFields', () => {
  it('pulls out only the explicitly tracked fields', () => {
    const design = baseDesign()
    expect(extractTrackedDesignFields(design)).toEqual({
      groupCount: 2,
      groupNames: ['Control', 'Treatment'],
      relationship: 'independent',
      outcomeName: 'plant height',
      outcomeType: 'continuous',
      technicalReplicationPresent: false,
    })
  })

  it('copies the group-names array rather than aliasing it', () => {
    const design = baseDesign()
    const fields = extractTrackedDesignFields(design)
    fields.groupNames.push('Extra')
    expect(design.groups.names).toEqual(['Control', 'Treatment'])
  })
})

describe('diffTrackedDesignFields', () => {
  it('fires when a tracked field (group name) changes', () => {
    const before = extractTrackedDesignFields(baseDesign())
    const after = extractTrackedDesignFields(
      baseDesign({ groups: { count: 2, names: ['Control', 'High-dose'] } }),
    )
    const changes = diffTrackedDesignFields(before, after)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      field: 'groupNames',
      before: ['Control', 'Treatment'],
      after: ['Control', 'High-dose'],
    })
  })

  it('fires when the pairing/relationship answer changes', () => {
    const before = extractTrackedDesignFields(baseDesign())
    const after = extractTrackedDesignFields(baseDesign({ relationship: 'paired' }))
    const changes = diffTrackedDesignFields(before, after)
    expect(changes.map((c) => c.field)).toEqual(['relationship'])
  })

  it('fires when the primary outcome name or type changes', () => {
    const before = extractTrackedDesignFields(baseDesign())
    const afterName = extractTrackedDesignFields(
      baseDesign({ outcome: { name: 'leaf count', type: 'continuous', unit: 'cm' } }),
    )
    expect(diffTrackedDesignFields(before, afterName).map((c) => c.field)).toEqual(['outcomeName'])

    const afterType = extractTrackedDesignFields(
      baseDesign({ outcome: { name: 'plant height', type: 'count', unit: 'cm' } }),
    )
    expect(diffTrackedDesignFields(before, afterType).map((c) => c.field)).toEqual(['outcomeType'])
  })

  it('fires when the technical-replication flag changes', () => {
    const before = extractTrackedDesignFields(baseDesign())
    const after = extractTrackedDesignFields(
      baseDesign({ technicalReplication: { present: true, measurementsPerUnit: 3 } }),
    )
    expect(diffTrackedDesignFields(before, after).map((c) => c.field)).toEqual([
      'technicalReplicationPresent',
    ])
  })

  it('does NOT fire for untracked/irrelevant fields (research question, notes, unit)', () => {
    const before = extractTrackedDesignFields(baseDesign())
    const after = extractTrackedDesignFields(
      baseDesign({
        researchQuestion: 'A completely different question',
        notes: 'some new note',
        outcome: { name: 'plant height', type: 'continuous', unit: 'mm' },
        experimentalUnit: { label: 'Plant', description: 'a potted plant' },
      }),
    )
    expect(diffTrackedDesignFields(before, after)).toEqual([])
  })

  it('reports no changes for an identical design', () => {
    const before = extractTrackedDesignFields(baseDesign())
    const after = extractTrackedDesignFields(baseDesign())
    expect(diffTrackedDesignFields(before, after)).toEqual([])
  })

  it('reports multiple changes when several tracked fields change at once', () => {
    const before = extractTrackedDesignFields(baseDesign())
    const after = extractTrackedDesignFields(
      baseDesign({
        groups: { count: 2, names: ['Alpha', 'Beta'] },
        relationship: 'paired',
      }),
    )
    const changes = diffTrackedDesignFields(before, after)
    expect(changes.map((c) => c.field).sort()).toEqual(['groupNames', 'relationship'])
  })
})

describe('describeTrackedFieldChanges', () => {
  it('produces plain-language, honest wording naming before/after values', () => {
    const before = extractTrackedDesignFields(baseDesign())
    const after = extractTrackedDesignFields(
      baseDesign({ groups: { count: 2, names: ['Control', 'High-dose'] } }),
    )
    const text = describeTrackedFieldChanges(diffTrackedDesignFields(before, after))
    expect(text).toContain('Modified after results were viewed')
    expect(text).toContain('Group names')
    expect(text).toContain('Control, Treatment')
    expect(text).toContain('Control, High-dose')
  })
})
