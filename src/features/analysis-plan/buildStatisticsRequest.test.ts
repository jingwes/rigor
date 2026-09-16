import { describe, expect, it } from 'vitest'
import type { Dataset, DatasetRow, ParsingIssue } from '../../models/Dataset'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import { buildStatisticsRequest } from './buildStatisticsRequest'

function design(overrides: Partial<ExperimentDesign> = {}): ExperimentDesign {
  return {
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

function row(partial: Partial<DatasetRow> & { rowId: string }): DatasetRow {
  return { raw: {}, ...partial }
}

describe('buildStatisticsRequest - independent-groups (welch-two-sample-t-test)', () => {
  it('groups rows by the design group names, mapping names[0] -> a and names[1] -> b', () => {
    const dataset: Dataset = {
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rows: [
        row({ rowId: 'r1', group: 'Control', value: 10 }),
        row({ rowId: 'r2', group: 'Control', value: 11 }),
        row({ rowId: 'r3', group: 'Control', value: 9 }),
        row({ rowId: 'r4', group: 'Treatment', value: 12 }),
        row({ rowId: 'r5', group: 'Treatment', value: 13 }),
        row({ rowId: 'r6', group: 'Treatment', value: 14 }),
      ],
      issues: [],
    }

    const result = buildStatisticsRequest(
      design(),
      dataset,
      'welch-two-sample-t-test',
    )

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready')
    expect(result.request.analysisType).toBe('welch-two-sample-t-test')
    expect(result.request.payload).toEqual({
      a: [10, 11, 9],
      b: [12, 13, 14],
    })
    expect(result.groupALabel).toBe('Control')
    expect(result.groupBLabel).toBe('Treatment')
  })

  it('excludes rows with an "excluded"-severity issue from the numeric arrays', () => {
    const dataset: Dataset = {
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rows: [
        row({ rowId: 'r1', group: 'Control', value: 10 }),
        row({ rowId: 'r2', group: 'Control', value: 999 }), // excluded below
        row({ rowId: 'r3', group: 'Control', value: 9 }),
        row({ rowId: 'r4', group: 'Treatment', value: 12 }),
        row({ rowId: 'r5', group: 'Treatment', value: 13 }),
      ],
      issues: [
        {
          rowId: 'r2',
          severity: 'excluded',
          message: 'value is an outlier flagged for exclusion',
        },
      ],
    }

    const result = buildStatisticsRequest(
      design(),
      dataset,
      'welch-two-sample-t-test',
    )

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready')
    expect(result.request.payload).toEqual({ a: [10, 9], b: [12, 13] })
  })

  it('KEEPS rows that only have a "warning"-severity issue (kept-but-flagged)', () => {
    const dataset: Dataset = {
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rows: [
        row({ rowId: 'r1', group: 'Control', value: 10 }),
        row({ rowId: 'r2', group: 'Control', value: 11 }),
        row({ rowId: 'r3', group: 'Treatment', value: 12 }),
        row({ rowId: 'r4', group: 'Treatment', value: 13 }),
      ],
      issues: [
        {
          rowId: 'r1',
          severity: 'warning',
          message: 'duplicate sample id, kept for the student to review',
        },
      ],
    }

    const result = buildStatisticsRequest(
      design(),
      dataset,
      'welch-two-sample-t-test',
    )

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready')
    expect(result.request.payload.a).toContain(10)
  })

  it('ignores rows whose group value does not match either declared group name', () => {
    const dataset: Dataset = {
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rows: [
        row({ rowId: 'r1', group: 'Control', value: 10 }),
        row({ rowId: 'r2', group: 'Control', value: 11 }),
        row({ rowId: 'r3', group: 'Contrl', value: 999 }), // typo, not a declared group
        row({ rowId: 'r4', group: 'Treatment', value: 12 }),
        row({ rowId: 'r5', group: 'Treatment', value: 13 }),
      ],
      issues: [],
    }

    const result = buildStatisticsRequest(
      design(),
      dataset,
      'welch-two-sample-t-test',
    )

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready')
    expect(result.request.payload).toEqual({ a: [10, 11], b: [12, 13] })
  })

  it('reports insufficient-data when a group has fewer than 2 usable values', () => {
    const dataset: Dataset = {
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rows: [
        row({ rowId: 'r1', group: 'Control', value: 10 }),
        row({ rowId: 'r2', group: 'Treatment', value: 12 }),
        row({ rowId: 'r3', group: 'Treatment', value: 13 }),
      ],
      issues: [],
    }

    const result = buildStatisticsRequest(
      design(),
      dataset,
      'welch-two-sample-t-test',
    )

    expect(result.status).toBe('insufficient-data')
    if (result.status !== 'insufficient-data') throw new Error('expected insufficient-data')
    expect(result.message).toMatch(/not enough valid data/i)
  })

  it('rows missing a numeric value do not count toward either group', () => {
    const dataset: Dataset = {
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rows: [
        row({ rowId: 'r1', group: 'Control', value: 10 }),
        row({ rowId: 'r2', group: 'Control' }), // no numeric value
        row({ rowId: 'r3', group: 'Treatment', value: 12 }),
        row({ rowId: 'r4', group: 'Treatment', value: 13 }),
      ],
      issues: [
        { rowId: 'r2', severity: 'excluded', message: 'missing a value' },
      ],
    }

    const result = buildStatisticsRequest(
      design(),
      dataset,
      'welch-two-sample-t-test',
    )
    expect(result.status).toBe('insufficient-data')
  })
})

describe('buildStatisticsRequest - paired (paired-t-test)', () => {
  function pairedDesign(): ExperimentDesign {
    return design({
      groups: { count: 2, names: ['before', 'after'] },
      relationship: 'paired',
    })
  }

  it('pivots rows by subjectId + condition into matched a/b arrays in subject order', () => {
    const dataset: Dataset = {
      format: 'paired',
      columns: ['subject_id', 'condition', 'value'],
      rows: [
        row({ rowId: 'r1', subjectId: '1', condition: 'before', value: 12.3 }),
        row({ rowId: 'r2', subjectId: '1', condition: 'after', value: 14.0 }),
        row({ rowId: 'r3', subjectId: '2', condition: 'before', value: 11.8 }),
        row({ rowId: 'r4', subjectId: '2', condition: 'after', value: 12.2 }),
      ],
      issues: [],
    }

    const result = buildStatisticsRequest(pairedDesign(), dataset, 'paired-t-test')

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready')
    expect(result.request.analysisType).toBe('paired-t-test')
    expect(result.request.payload).toEqual({
      a: [12.3, 11.8],
      b: [14.0, 12.2],
    })
    expect(result.groupALabel).toBe('before')
    expect(result.groupBLabel).toBe('after')
  })

  it('only pairs subjects that appear in a different row order in the data', () => {
    const dataset: Dataset = {
      format: 'paired',
      columns: ['subject_id', 'condition', 'value'],
      rows: [
        row({ rowId: 'r1', subjectId: '1', condition: 'after', value: 14.0 }),
        row({ rowId: 'r2', subjectId: '2', condition: 'before', value: 11.8 }),
        row({ rowId: 'r3', subjectId: '1', condition: 'before', value: 12.3 }),
        row({ rowId: 'r4', subjectId: '2', condition: 'after', value: 12.2 }),
      ],
      issues: [],
    }

    const result = buildStatisticsRequest(pairedDesign(), dataset, 'paired-t-test')
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready')
    // Subject order follows first appearance in the data (subject 1, then 2).
    expect(result.request.payload).toEqual({ a: [12.3, 11.8], b: [14.0, 12.2] })
  })

  it('excludes a subject with an "excluded" issue on one of its two rows entirely (incomplete pair)', () => {
    const dataset: Dataset = {
      format: 'paired',
      columns: ['subject_id', 'condition', 'value'],
      rows: [
        row({ rowId: 'r1', subjectId: '1', condition: 'before', value: 12.3 }),
        row({ rowId: 'r2', subjectId: '1', condition: 'after', value: 14.0 }),
        row({ rowId: 'r3', subjectId: '2', condition: 'before', value: 11.8 }),
        row({ rowId: 'r4', subjectId: '2', condition: 'after', value: 999 }),
        row({ rowId: 'r5', subjectId: '3', condition: 'before', value: 10.1 }),
        row({ rowId: 'r6', subjectId: '3', condition: 'after', value: 10.9 }),
      ],
      issues: [
        { rowId: 'r4', severity: 'excluded', message: 'outlier, excluded' },
      ],
    }

    const result = buildStatisticsRequest(pairedDesign(), dataset, 'paired-t-test')
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready')
    // Subject 2's "after" value was excluded, so subject 2 contributes no pair.
    expect(result.request.payload).toEqual({
      a: [12.3, 10.1],
      b: [14.0, 10.9],
    })
  })

  it('keeps a pair when only a warning-severity issue is present', () => {
    const dataset: Dataset = {
      format: 'paired',
      columns: ['subject_id', 'condition', 'value'],
      rows: [
        row({ rowId: 'r1', subjectId: '1', condition: 'before', value: 12.3 }),
        row({ rowId: 'r2', subjectId: '1', condition: 'after', value: 14.0 }),
        row({ rowId: 'r3', subjectId: '2', condition: 'before', value: 11.8 }),
        row({ rowId: 'r4', subjectId: '2', condition: 'after', value: 12.2 }),
      ],
      issues: [
        { rowId: 'r4', severity: 'warning', message: 'duplicate id, kept' },
      ],
    }

    const result = buildStatisticsRequest(pairedDesign(), dataset, 'paired-t-test')
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready')
    expect(result.request.payload.b).toContain(12.2)
  })

  it('reports insufficient-data with fewer than 2 complete pairs', () => {
    const dataset: Dataset = {
      format: 'paired',
      columns: ['subject_id', 'condition', 'value'],
      rows: [
        row({ rowId: 'r1', subjectId: '1', condition: 'before', value: 12.3 }),
        row({ rowId: 'r2', subjectId: '1', condition: 'after', value: 14.0 }),
        row({ rowId: 'r3', subjectId: '2', condition: 'before', value: 11.8 }),
        // subject 2's "after" measurement was never entered
      ],
      issues: [],
    }

    const result = buildStatisticsRequest(pairedDesign(), dataset, 'paired-t-test')
    expect(result.status).toBe('insufficient-data')
    if (result.status !== 'insufficient-data') throw new Error('expected insufficient-data')
    expect(result.message).toMatch(/not enough valid paired data/i)
  })

  it('an empty dataset is reported as insufficient-data, not a crash', () => {
    const dataset: Dataset = {
      format: 'paired',
      columns: ['subject_id', 'condition', 'value'],
      rows: [],
      issues: [] as ParsingIssue[],
    }
    const result = buildStatisticsRequest(pairedDesign(), dataset, 'paired-t-test')
    expect(result.status).toBe('insufficient-data')
  })
})
