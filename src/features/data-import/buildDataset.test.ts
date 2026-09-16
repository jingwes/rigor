import { beforeEach, describe, expect, it } from 'vitest'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import { buildDataset, resetRowIdCounterForTests } from './buildDataset'
import { parseCsvText } from './csvParsing'

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

beforeEach(() => {
  resetRowIdCounterForTests()
})

describe('buildDataset', () => {
  it('preserves raw values exactly, even for malformed-looking ones', () => {
    const dataset = buildDataset({
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rawRows: [{ sample_id: '1', group: 'Control', value: 'ten' }],
      design: baseDesign(),
    })
    expect(dataset.rows[0].raw).toEqual({
      sample_id: '1',
      group: 'Control',
      value: 'ten',
    })
    expect(dataset.rows[0].value).toBeUndefined()
  })

  it('coerces a valid numeric value', () => {
    const dataset = buildDataset({
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rawRows: [{ sample_id: '1', group: 'Control', value: '12.5' }],
      design: baseDesign(),
    })
    expect(dataset.rows[0].value).toBe(12.5)
  })

  it('is tolerant of header casing/spacing when mapping fields', () => {
    const dataset = buildDataset({
      format: 'independent-groups',
      columns: ['Sample ID', 'Group', 'Value'],
      rawRows: [{ 'Sample ID': '1', Group: 'Control', Value: '4' }],
      design: baseDesign(),
    })
    expect(dataset.rows[0].sampleId).toBe('1')
    expect(dataset.rows[0].group).toBe('Control')
    expect(dataset.rows[0].value).toBe(4)
  })

  it('never deletes a row due to a validation issue', () => {
    const dataset = buildDataset({
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rawRows: [
        { sample_id: '', group: '', value: '' },
        { sample_id: '2', group: 'Control', value: 'not a number' },
      ],
      design: baseDesign(),
    })
    expect(dataset.rows).toHaveLength(2)
    expect(dataset.issues.length).toBeGreaterThan(0)
  })

  it('flags a missing required column but still keeps whatever rows were parsed', () => {
    const dataset = buildDataset({
      format: 'independent-groups',
      columns: ['sample_id', 'value'], // missing 'group'
      rawRows: [{ sample_id: '1', value: '4' }],
      design: baseDesign(),
    })
    expect(dataset.rows).toHaveLength(1)
    expect(
      dataset.issues.some(
        (i) => i.field === 'group' && i.severity === 'excluded',
      ),
    ).toBe(true)
  })

  it('attaches CSV parsing structural issues to the correct row by index', () => {
    const dataset = buildDataset({
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rawRows: [
        { sample_id: '1', group: 'Control', value: '1' },
        { sample_id: '2', group: 'Control', value: '2' },
      ],
      design: baseDesign(),
      structuralIssues: [
        {
          rowIndex: 1,
          severity: 'excluded',
          message: 'wrong number of fields',
        },
      ],
    })
    const structural = dataset.issues.find(
      (i) => i.message === 'wrong number of fields',
    )
    expect(structural?.rowId).toBe(dataset.rows[1].rowId)
  })
})

describe('buildDataset + parseCsvText integration', () => {
  it('parses a valid independent-groups CSV with no issues', () => {
    const csv =
      'sample_id,group,value\n1,Control,10\n2,Control,11\n3,Treatment,15\n'
    const { columns, rawRows, issues: structuralIssues } = parseCsvText(csv)
    const dataset = buildDataset({
      format: 'independent-groups',
      columns,
      rawRows,
      design: baseDesign(),
      structuralIssues,
    })
    expect(dataset.rows).toHaveLength(3)
    // Only the "very small group" caution should fire (small n), nothing excluded.
    expect(dataset.issues.every((i) => i.severity === 'warning')).toBe(true)
  })

  it('flags an empty file', () => {
    const { columns, rawRows, issues } = parseCsvText('')
    expect(columns).toHaveLength(0)
    expect(rawRows).toHaveLength(0)
    expect(issues.some((i) => /empty/.test(i.message))).toBe(true)
  })

  it('flags a header-only file', () => {
    const { rawRows, issues } = parseCsvText('sample_id,group,value\n')
    expect(rawRows).toHaveLength(0)
    expect(issues.some((i) => /no data rows/.test(i.message))).toBe(true)
  })

  it('surfaces a row with the wrong number of columns via Papa Parse errors', () => {
    const csv = 'sample_id,group,value\n1,Control,10\n2,Control\n'
    const { issues } = parseCsvText(csv)
    expect(issues.some((i) => i.severity === 'excluded')).toBe(true)
  })
})
