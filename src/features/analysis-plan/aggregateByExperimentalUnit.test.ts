import { describe, expect, it } from 'vitest'
import type { Dataset, DatasetRow } from '../../models/Dataset'
import {
  aggregateByExperimentalUnit,
  describeAggregationSampleSize,
  summarizeAggregation,
} from './aggregateByExperimentalUnit'

function row(partial: Partial<DatasetRow> & { rowId: string }): DatasetRow {
  return { raw: {}, ...partial }
}

function nestedDataset(rows: DatasetRow[], issues: Dataset['issues'] = []): Dataset {
  return {
    format: 'nested',
    columns: ['experimental_unit', 'subsample', 'group', 'value'],
    rows,
    issues,
  }
}

describe('aggregateByExperimentalUnit', () => {
  it('computes the correct per-unit mean', () => {
    const dataset = nestedDataset([
      row({ rowId: 'r1', experimentalUnit: 'unit-1', group: 'Control', subsample: '1', value: 10 }),
      row({ rowId: 'r2', experimentalUnit: 'unit-1', group: 'Control', subsample: '2', value: 12 }),
      row({ rowId: 'r3', experimentalUnit: 'unit-1', group: 'Control', subsample: '3', value: 14 }),
      row({ rowId: 'r4', experimentalUnit: 'unit-2', group: 'Treatment', subsample: '1', value: 20 }),
      row({ rowId: 'r5', experimentalUnit: 'unit-2', group: 'Treatment', subsample: '2', value: 22 }),
    ])

    const result = aggregateByExperimentalUnit(dataset)

    expect(result).toEqual([
      { unit: 'unit-1', group: 'Control', aggregatedValue: 12, rawValueCount: 3 },
      { unit: 'unit-2', group: 'Treatment', aggregatedValue: 21, rawValueCount: 2 },
    ])
  })

  it('excludes rows with an "excluded"-severity issue from the mean', () => {
    const dataset = nestedDataset(
      [
        row({ rowId: 'r1', experimentalUnit: 'unit-1', group: 'Control', subsample: '1', value: 10 }),
        row({ rowId: 'r2', experimentalUnit: 'unit-1', group: 'Control', subsample: '2', value: 999 }),
        row({ rowId: 'r3', experimentalUnit: 'unit-1', group: 'Control', subsample: '3', value: 14 }),
      ],
      [{ rowId: 'r2', severity: 'excluded', message: 'outlier' }],
    )

    const result = aggregateByExperimentalUnit(dataset)
    expect(result).toEqual([
      { unit: 'unit-1', group: 'Control', aggregatedValue: 12, rawValueCount: 2 },
    ])
  })

  it('keeps rows with only a "warning"-severity issue in the mean', () => {
    const dataset = nestedDataset(
      [
        row({ rowId: 'r1', experimentalUnit: 'unit-1', group: 'Control', subsample: '1', value: 10 }),
        row({ rowId: 'r2', experimentalUnit: 'unit-1', group: 'Control', subsample: '2', value: 14 }),
      ],
      [{ rowId: 'r2', severity: 'warning', message: 'duplicate subsample id' }],
    )

    const result = aggregateByExperimentalUnit(dataset)
    expect(result).toEqual([
      { unit: 'unit-1', group: 'Control', aggregatedValue: 12, rawValueCount: 2 },
    ])
  })

  it('does not mutate the input dataset', () => {
    const dataset = nestedDataset([
      row({ rowId: 'r1', experimentalUnit: 'unit-1', group: 'Control', subsample: '1', value: 10 }),
      row({ rowId: 'r2', experimentalUnit: 'unit-1', group: 'Control', subsample: '2', value: 14 }),
    ])
    const before = JSON.parse(JSON.stringify(dataset))

    aggregateByExperimentalUnit(dataset)

    expect(dataset).toEqual(before)
    expect(dataset.rows).toHaveLength(2)
  })

  it('preserves unit order by first appearance', () => {
    const dataset = nestedDataset([
      row({ rowId: 'r1', experimentalUnit: 'unit-b', group: 'Control', subsample: '1', value: 1 }),
      row({ rowId: 'r2', experimentalUnit: 'unit-a', group: 'Control', subsample: '1', value: 2 }),
      row({ rowId: 'r3', experimentalUnit: 'unit-b', group: 'Control', subsample: '2', value: 3 }),
    ])

    const result = aggregateByExperimentalUnit(dataset)
    expect(result.map((u) => u.unit)).toEqual(['unit-b', 'unit-a'])
  })
})

describe('describeAggregationSampleSize', () => {
  it('shows both the unit count and the raw measurement count, clearly labeled', () => {
    const units = aggregateByExperimentalUnit(
      nestedDataset([
        row({ rowId: 'r1', experimentalUnit: 'unit-1', group: 'Control', subsample: '1', value: 1 }),
        row({ rowId: 'r2', experimentalUnit: 'unit-1', group: 'Control', subsample: '2', value: 2 }),
        row({ rowId: 'r3', experimentalUnit: 'unit-2', group: 'Control', subsample: '1', value: 3 }),
        row({ rowId: 'r4', experimentalUnit: 'unit-2', group: 'Control', subsample: '2', value: 4 }),
        row({ rowId: 'r5', experimentalUnit: 'unit-3', group: 'Treatment', subsample: '1', value: 5 }),
        row({ rowId: 'r6', experimentalUnit: 'unit-3', group: 'Treatment', subsample: '2', value: 6 }),
      ]),
    )
    const aggregation = summarizeAggregation(units)

    const text = describeAggregationSampleSize(aggregation, 'mouse')
    expect(text).toContain('3 biological replicates')
    expect(text).toContain('from 6 raw measurements')
    expect(text).toMatch(/mixed-effects models/)
  })
})
