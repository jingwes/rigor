import { describe, expect, it } from 'vitest'
import type { Dataset, DatasetRow } from '../../models/Dataset'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import {
  checkBinaryOutcomeCardinality,
  checkDuplicateIds,
  checkGroupNameConsistency,
  checkMissingGroupLabels,
  checkMissingIdentifiers,
  checkMissingValues,
  checkNestedSubsampleConsistency,
  checkNumericOutcomeValues,
  checkPairedCompleteness,
  checkSmallGroups,
  validateDataset,
} from './validation'

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

function row(
  partial: Partial<DatasetRow> & { rowId: string; raw: Record<string, string> },
): DatasetRow {
  return partial
}

function dataset(
  partial: Partial<Dataset> & { format: Dataset['format'] },
): Dataset {
  return { columns: [], rows: [], issues: [], ...partial }
}

describe('checkMissingIdentifiers', () => {
  it('flags a row missing a sample ID (independent-groups)', () => {
    const ds = dataset({
      format: 'independent-groups',
      rows: [
        row({
          rowId: 'r1',
          raw: { sample_id: '', group: 'Control', value: '1' },
        }),
      ],
    })
    const issues = checkMissingIdentifiers(ds)
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('excluded')
    expect(issues[0].rowId).toBe('r1')
  })

  it('flags a paired row missing subject id and condition separately', () => {
    const ds = dataset({
      format: 'paired',
      rows: [row({ rowId: 'r1', raw: {} })],
    })
    const issues = checkMissingIdentifiers(ds)
    expect(issues).toHaveLength(2)
    expect(issues.map((i) => i.field).sort()).toEqual([
      'condition',
      'subjectId',
    ])
  })

  it('flags a nested row missing unit or subsample', () => {
    const ds = dataset({
      format: 'nested',
      rows: [row({ rowId: 'r1', raw: {}, experimentalUnit: 'unit-1' })],
    })
    const issues = checkMissingIdentifiers(ds)
    expect(issues).toHaveLength(1)
    expect(issues[0].field).toBe('subsample')
  })
})

describe('checkMissingGroupLabels', () => {
  it('flags rows with an empty group in independent-groups format', () => {
    const ds = dataset({
      format: 'independent-groups',
      rows: [row({ rowId: 'r1', raw: { value: '1' } })],
    })
    expect(checkMissingGroupLabels(ds)).toHaveLength(1)
  })

  it('does not apply to paired format (no group column)', () => {
    const ds = dataset({
      format: 'paired',
      rows: [row({ rowId: 'r1', raw: {} })],
    })
    expect(checkMissingGroupLabels(ds)).toHaveLength(0)
  })
})

describe('checkMissingValues', () => {
  it('flags a row with a blank value cell', () => {
    const ds = dataset({
      format: 'independent-groups',
      rows: [row({ rowId: 'r1', raw: { value: '   ' } })],
    })
    const issues = checkMissingValues(ds)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/missing a value/)
  })
})

describe('checkNumericOutcomeValues', () => {
  it('flags a non-numeric value for a continuous outcome', () => {
    const ds = dataset({
      format: 'independent-groups',
      rows: [row({ rowId: 'r1', raw: { value: 'ten' } })],
    })
    const issues = checkNumericOutcomeValues(ds, 'continuous')
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toBe("Value 'ten' is not a number.")
    expect(issues[0].severity).toBe('excluded')
  })

  it('flags Infinity as excluded, not silently accepted', () => {
    const ds = dataset({
      format: 'independent-groups',
      rows: [row({ rowId: 'r1', raw: { value: 'Infinity' }, value: Infinity })],
    })
    const issues = checkNumericOutcomeValues(ds, 'continuous')
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/infinite/)
  })

  it('flags a huge unparseable exponent that becomes Infinity', () => {
    const ds = dataset({
      format: 'independent-groups',
      rows: [
        row({ rowId: 'r1', raw: { value: '1e400' }, value: Number('1e400') }),
      ],
    })
    const issues = checkNumericOutcomeValues(ds, 'continuous')
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toMatch(/infinite/)
  })

  it('does not require numeric values for a categorical outcome', () => {
    const ds = dataset({
      format: 'independent-groups',
      rows: [row({ rowId: 'r1', raw: { value: 'red' } })],
    })
    expect(checkNumericOutcomeValues(ds, 'categorical')).toHaveLength(0)
  })

  it('flags a negative count as excluded and a fractional count as a warning', () => {
    const ds = dataset({
      format: 'independent-groups',
      rows: [
        row({ rowId: 'r1', raw: { value: '-2' }, value: -2 }),
        row({ rowId: 'r2', raw: { value: '2.5' }, value: 2.5 }),
      ],
    })
    const issues = checkNumericOutcomeValues(ds, 'count')
    const excluded = issues.filter((i) => i.severity === 'excluded')
    const warnings = issues.filter((i) => i.severity === 'warning')
    expect(excluded).toHaveLength(1)
    expect(warnings).toHaveLength(1)
  })

  it('warns (does not exclude) a proportion outside 0-1', () => {
    const ds = dataset({
      format: 'independent-groups',
      rows: [row({ rowId: 'r1', raw: { value: '55' }, value: 55 })],
    })
    const issues = checkNumericOutcomeValues(ds, 'proportion')
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
  })

  it('skips rows with a blank value (handled by checkMissingValues instead)', () => {
    const ds = dataset({
      format: 'independent-groups',
      rows: [row({ rowId: 'r1', raw: { value: '' } })],
    })
    expect(checkNumericOutcomeValues(ds, 'continuous')).toHaveLength(0)
  })
})

describe('checkBinaryOutcomeCardinality', () => {
  it('warns when more than two distinct values are found', () => {
    const ds = dataset({
      format: 'independent-groups',
      rows: [
        row({ rowId: 'r1', raw: { value: 'yes' } }),
        row({ rowId: 'r2', raw: { value: 'no' } }),
        row({ rowId: 'r3', raw: { value: 'maybe' } }),
      ],
    })
    const issues = checkBinaryOutcomeCardinality(ds, 'binary')
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
  })

  it('is silent for exactly two values', () => {
    const ds = dataset({
      format: 'independent-groups',
      rows: [
        row({ rowId: 'r1', raw: { value: 'yes' } }),
        row({ rowId: 'r2', raw: { value: 'no' } }),
      ],
    })
    expect(checkBinaryOutcomeCardinality(ds, 'binary')).toHaveLength(0)
  })
})

describe('checkDuplicateIds', () => {
  it('flags a duplicated sample id', () => {
    const ds = dataset({
      format: 'independent-groups',
      rows: [
        row({ rowId: 'r1', raw: {}, sampleId: 'S1' }),
        row({ rowId: 'r2', raw: {}, sampleId: 'S1' }),
      ],
    })
    const issues = checkDuplicateIds(ds)
    expect(issues).toHaveLength(2)
    expect(issues.every((i) => i.severity === 'warning')).toBe(true)
  })

  it('flags a duplicated (subject, condition) pair', () => {
    const ds = dataset({
      format: 'paired',
      rows: [
        row({ rowId: 'r1', raw: {}, subjectId: 'P1', condition: 'before' }),
        row({ rowId: 'r2', raw: {}, subjectId: 'P1', condition: 'before' }),
      ],
    })
    expect(checkDuplicateIds(ds)).toHaveLength(2)
  })
})

describe('checkPairedCompleteness', () => {
  it('flags a subject missing its paired counterpart', () => {
    const ds = dataset({
      format: 'paired',
      rows: [
        row({ rowId: 'r1', raw: {}, subjectId: 'P1', condition: 'before' }),
      ],
    })
    const issues = checkPairedCompleteness(ds)
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('excluded')
    expect(issues[0].message).toMatch(/paired counterpart is missing/)
  })

  it('flags a subject with three distinct conditions', () => {
    const ds = dataset({
      format: 'paired',
      rows: [
        row({ rowId: 'r1', raw: {}, subjectId: 'P1', condition: 'before' }),
        row({ rowId: 'r2', raw: {}, subjectId: 'P1', condition: 'after' }),
        row({ rowId: 'r3', raw: {}, subjectId: 'P1', condition: 'follow-up' }),
      ],
    })
    const issues = checkPairedCompleteness(ds)
    expect(issues).toHaveLength(3)
    expect(
      issues.every((i) => i.message.includes('3 different conditions')),
    ).toBe(true)
  })

  it('is silent for a properly paired subject', () => {
    const ds = dataset({
      format: 'paired',
      rows: [
        row({ rowId: 'r1', raw: {}, subjectId: 'P1', condition: 'before' }),
        row({ rowId: 'r2', raw: {}, subjectId: 'P1', condition: 'after' }),
      ],
    })
    expect(checkPairedCompleteness(ds)).toHaveLength(0)
  })
})

describe('checkNestedSubsampleConsistency', () => {
  it('warns about wildly uneven subsample counts per unit', () => {
    const rows: DatasetRow[] = []
    for (let i = 0; i < 2; i++)
      rows.push(row({ rowId: `a${i}`, raw: {}, experimentalUnit: 'unit-A' }))
    for (let i = 0; i < 8; i++)
      rows.push(row({ rowId: `b${i}`, raw: {}, experimentalUnit: 'unit-B' }))
    const ds = dataset({ format: 'nested', rows })
    const issues = checkNestedSubsampleConsistency(ds)
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
  })

  it('is silent for roughly even subsample counts', () => {
    const rows: DatasetRow[] = []
    for (let i = 0; i < 3; i++)
      rows.push(row({ rowId: `a${i}`, raw: {}, experimentalUnit: 'unit-A' }))
    for (let i = 0; i < 4; i++)
      rows.push(row({ rowId: `b${i}`, raw: {}, experimentalUnit: 'unit-B' }))
    const ds = dataset({ format: 'nested', rows })
    expect(checkNestedSubsampleConsistency(ds)).toHaveLength(0)
  })
})

describe('checkSmallGroups', () => {
  it('warns about a group with fewer than 3 units', () => {
    const ds = dataset({
      format: 'independent-groups',
      rows: [
        row({ rowId: 'r1', raw: {}, group: 'Control' }),
        row({ rowId: 'r2', raw: {}, group: 'Control' }),
      ],
    })
    const issues = checkSmallGroups(ds)
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warning')
  })

  it('does not block (never returns an excluded issue)', () => {
    const ds = dataset({
      format: 'independent-groups',
      rows: [row({ rowId: 'r1', raw: {}, group: 'Control' })],
    })
    const issues = checkSmallGroups(ds)
    expect(issues.every((i) => i.severity === 'warning')).toBe(true)
  })
})

describe('checkGroupNameConsistency', () => {
  it('flags a declared group with no data', () => {
    const design = baseDesign({
      groups: { count: 2, names: ['Control', 'Treatment'] },
    })
    const ds = dataset({
      format: 'independent-groups',
      rows: [row({ rowId: 'r1', raw: {}, group: 'Control' })],
    })
    const issues = checkGroupNameConsistency(ds, design)
    expect(
      issues.some((i) =>
        i.message.includes("'Treatment' from your design has no data"),
      ),
    ).toBe(true)
  })

  it('flags a data value that is not one of the declared groups', () => {
    const design = baseDesign({
      groups: { count: 2, names: ['Control', 'Treatment'] },
    })
    const ds = dataset({
      format: 'independent-groups',
      rows: [
        row({ rowId: 'r1', raw: {}, group: 'Control' }),
        row({ rowId: 'r2', raw: {}, group: 'Treatmnet' }),
      ],
    })
    const issues = checkGroupNameConsistency(ds, design)
    expect(
      issues.some((i) =>
        i.message.includes("'Treatmnet' appears in your data"),
      ),
    ).toBe(true)
  })
})

describe('validateDataset', () => {
  it('never removes a row, no matter how many issues it has', () => {
    const design = baseDesign()
    const ds = dataset({
      format: 'independent-groups',
      rows: [
        row({
          rowId: 'only-row',
          raw: { sample_id: '', group: '', value: 'not a number' },
        }),
      ],
    })
    validateDataset(ds, design)
    expect(ds.rows).toHaveLength(1)
    expect(ds.rows[0].rowId).toBe('only-row')
  })
})
