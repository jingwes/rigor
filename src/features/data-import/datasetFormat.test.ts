import { describe, expect, it } from 'vitest'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import { resolveDatasetFormat } from './datasetFormat'

function baseDesign(
  overrides: Partial<ExperimentDesign> = {},
): ExperimentDesign {
  return {
    outcome: { name: 'height', type: 'continuous' },
    groups: { count: 2, names: ['Control', 'Treatment'] },
    relationship: 'independent',
    experimentalUnit: { label: 'Plant' },
    technicalReplication: { present: false },
    repeatedMeasures: { present: false },
    exclusionsPredefined: false,
    ...overrides,
  }
}

describe('resolveDatasetFormat', () => {
  it('resolves independent designs to independent-groups', () => {
    expect(
      resolveDatasetFormat(baseDesign({ relationship: 'independent' })),
    ).toEqual({
      kind: 'determined',
      format: 'independent-groups',
    })
  })

  it('resolves paired designs with exactly two groups to paired', () => {
    expect(
      resolveDatasetFormat(
        baseDesign({
          relationship: 'paired',
          groups: { count: 2, names: ['a', 'b'] },
        }),
      ),
    ).toEqual({ kind: 'determined', format: 'paired' })
  })

  it('resolves repeated designs with exactly two groups to paired', () => {
    expect(
      resolveDatasetFormat(
        baseDesign({
          relationship: 'repeated',
          groups: { count: 2, names: ['a', 'b'] },
        }),
      ),
    ).toEqual({ kind: 'determined', format: 'paired' })
  })

  it('resolves an explicitly nested design to nested', () => {
    expect(
      resolveDatasetFormat(baseDesign({ relationship: 'nested' })),
    ).toEqual({
      kind: 'determined',
      format: 'nested',
    })
  })

  it('resolves technical replication to nested regardless of relationship', () => {
    expect(
      resolveDatasetFormat(
        baseDesign({
          relationship: 'independent',
          technicalReplication: { present: true },
        }),
      ),
    ).toEqual({ kind: 'determined', format: 'nested' })
  })

  it('asks rather than guesses when relationship is unknown', () => {
    expect(
      resolveDatasetFormat(baseDesign({ relationship: 'unknown' })),
    ).toEqual({
      kind: 'ask',
      reason: 'unsure',
    })
  })

  it('asks rather than guesses for a repeated design with 3+ groups (not representable as paired)', () => {
    expect(
      resolveDatasetFormat(
        baseDesign({
          relationship: 'repeated',
          groups: { count: 3, names: ['a', 'b', 'c'] },
        }),
      ),
    ).toEqual({ kind: 'ask', reason: 'ambiguous' })
  })
})
