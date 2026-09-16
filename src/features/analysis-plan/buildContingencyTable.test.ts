import { describe, expect, it } from 'vitest'
import type { Dataset, DatasetRow } from '../../models/Dataset'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import { buildContingencyTable } from './buildContingencyTable'

function design(overrides: Partial<ExperimentDesign> = {}): ExperimentDesign {
  return {
    outcome: { name: 'recovery status', type: 'binary' },
    groups: { count: 2, names: ['Control', 'Treatment'] },
    relationship: 'independent',
    experimentalUnit: { label: 'Patient' },
    technicalReplication: { present: false },
    repeatedMeasures: { present: false },
    exclusionsPredefined: false,
    ...overrides,
  }
}

function row(
  rowId: string,
  group: string,
  categoryValue: string,
): DatasetRow {
  return { rowId, raw: { value: categoryValue }, group }
}

describe('buildContingencyTable', () => {
  it('counts rows by declared group (row order) and first-observed category (column order)', () => {
    const dataset: Dataset = {
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rows: [
        row('r1', 'Control', 'improved'),
        row('r2', 'Control', 'improved'),
        row('r3', 'Control', 'not improved'),
        row('r4', 'Treatment', 'improved'),
        row('r5', 'Treatment', 'not improved'),
        row('r6', 'Treatment', 'not improved'),
      ],
      issues: [],
    }

    const result = buildContingencyTable(design(), dataset)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready')

    expect(result.table.rowLabels).toEqual(['Control', 'Treatment'])
    expect(result.table.colLabels).toEqual(['improved', 'not improved'])
    expect(result.table.counts).toEqual([
      [2, 1],
      [1, 2],
    ])
  })

  it('excludes rows with an "excluded"-severity issue from the counts', () => {
    const dataset: Dataset = {
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rows: [
        row('r1', 'Control', 'improved'),
        row('r2', 'Control', 'improved'), // excluded below
        row('r3', 'Control', 'not improved'),
        row('r4', 'Treatment', 'improved'),
        row('r5', 'Treatment', 'not improved'),
      ],
      issues: [
        { rowId: 'r2', severity: 'excluded', message: 'flagged for exclusion' },
      ],
    }

    const result = buildContingencyTable(design(), dataset)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready')
    expect(result.table.counts).toEqual([
      [1, 1],
      [1, 1],
    ])
  })

  it('keeps rows with only a "warning"-severity issue', () => {
    const dataset: Dataset = {
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rows: [
        row('r1', 'Control', 'improved'),
        row('r2', 'Control', 'not improved'),
        row('r3', 'Treatment', 'improved'),
        row('r4', 'Treatment', 'not improved'),
      ],
      issues: [
        { rowId: 'r1', severity: 'warning', message: 'flagged, but kept' },
      ],
    }

    const result = buildContingencyTable(design(), dataset)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready')
    expect(result.table.counts).toEqual([
      [1, 1],
      [1, 1],
    ])
  })

  it('supports 3+ groups and 3+ outcome categories', () => {
    const threeGroupDesign = design({
      groups: { count: 3, names: ['A', 'B', 'C'] },
      outcome: { name: 'severity', type: 'categorical' },
    })
    const dataset: Dataset = {
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rows: [
        row('r1', 'A', 'Mild'),
        row('r2', 'A', 'Moderate'),
        row('r3', 'A', 'Severe'),
        row('r4', 'B', 'Mild'),
        row('r5', 'B', 'Mild'),
        row('r6', 'C', 'Severe'),
      ],
      issues: [],
    }

    const result = buildContingencyTable(threeGroupDesign, dataset)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready')
    expect(result.table.rowLabels).toEqual(['A', 'B', 'C'])
    expect(result.table.colLabels).toEqual(['Mild', 'Moderate', 'Severe'])
    expect(result.table.counts).toEqual([
      [1, 1, 1],
      [2, 0, 0],
      [0, 0, 1],
    ])
  })

  it('rejects a non-independent-groups dataset format', () => {
    const dataset: Dataset = {
      format: 'paired',
      columns: ['subject_id', 'condition', 'value'],
      rows: [],
      issues: [],
    }
    const result = buildContingencyTable(design(), dataset)
    expect(result.status).toBe('insufficient-data')
  })

  it('reports insufficient data when fewer than 2 named groups are declared', () => {
    const oneGroupDesign = design({ groups: { count: 1, names: ['Control'] } })
    const dataset: Dataset = {
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rows: [row('r1', 'Control', 'improved')],
      issues: [],
    }
    const result = buildContingencyTable(oneGroupDesign, dataset)
    expect(result.status).toBe('insufficient-data')
  })

  it('reports insufficient data when fewer than 2 outcome categories are observed', () => {
    const dataset: Dataset = {
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rows: [
        row('r1', 'Control', 'improved'),
        row('r2', 'Treatment', 'improved'),
      ],
      issues: [],
    }
    const result = buildContingencyTable(design(), dataset)
    expect(result.status).toBe('insufficient-data')
    if (result.status !== 'insufficient-data') throw new Error('expected insufficient-data')
    expect(result.message).toMatch(/2 distinct outcome categories/)
  })

  it('reports insufficient data when a declared group has zero usable observations', () => {
    const dataset: Dataset = {
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rows: [
        row('r1', 'Control', 'improved'),
        row('r2', 'Control', 'not improved'),
        // No usable rows at all for 'Treatment'.
      ],
      issues: [],
    }
    const result = buildContingencyTable(design(), dataset)
    expect(result.status).toBe('insufficient-data')
    if (result.status !== 'insufficient-data') throw new Error('expected insufficient-data')
    expect(result.message).toMatch(/'Treatment'/)
  })

  it('does not count a row whose group does not match either declared name', () => {
    const dataset: Dataset = {
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rows: [
        row('r1', 'Control', 'improved'),
        row('r2', 'Control', 'not improved'),
        row('r3', 'Treatment', 'improved'),
        row('r4', 'Treatment', 'not improved'),
        row('r5', 'Mystery Group', 'improved'),
      ],
      issues: [],
    }
    const result = buildContingencyTable(design(), dataset)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready')
    expect(result.table.counts).toEqual([
      [1, 1],
      [1, 1],
    ])
  })

  it('does not count a row with a blank/missing category value', () => {
    const dataset: Dataset = {
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rows: [
        row('r1', 'Control', 'improved'),
        row('r2', 'Control', ''),
        row('r3', 'Treatment', 'not improved'),
        row('r4', 'Treatment', 'improved'),
      ],
      issues: [],
    }
    const result = buildContingencyTable(design(), dataset)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready')
    expect(result.table.counts).toEqual([
      [1, 0],
      [1, 1],
    ])
  })
})
