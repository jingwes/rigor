import { describe, expect, it } from 'vitest'
import type { Dataset, DatasetRow } from '../models/Dataset'
import { analyzeReplicationStructure } from './replicationRules'

function row(partial: Partial<DatasetRow> & { rowId: string }): DatasetRow {
  return { raw: {}, ...partial }
}

describe('analyzeReplicationStructure', () => {
  it('fires for the classic case: uneven sub-measurement counts across units/groups', () => {
    // 3 units in "Control" (2, 3, 4 usable sub-measurements) and 3 units in
    // "Treatment" (5, 3, 3 usable sub-measurements).
    const rows: DatasetRow[] = []
    let rowId = 0
    const nextId = () => `r${++rowId}`

    const unitCounts: Array<[string, string, number]> = [
      ['mouse-1', 'Control', 2],
      ['mouse-2', 'Control', 3],
      ['mouse-3', 'Control', 4],
      ['mouse-4', 'Treatment', 5],
      ['mouse-5', 'Treatment', 3],
      ['mouse-6', 'Treatment', 3],
    ]

    for (const [unit, group, count] of unitCounts) {
      for (let i = 0; i < count; i++) {
        rows.push(
          row({
            rowId: nextId(),
            experimentalUnit: unit,
            group,
            subsample: String(i + 1),
            value: 10 + i,
          }),
        )
      }
    }

    const dataset: Dataset = {
      format: 'nested',
      columns: ['experimental_unit', 'subsample', 'group', 'value'],
      rows,
      issues: [],
    }

    const summary = analyzeReplicationStructure(dataset, { unitLabel: 'unit' })

    expect(summary.totalUnits).toBe(6)
    expect(summary.unitsByGroup).toEqual({ Control: 3, Treatment: 3 })
    expect(summary.totalUsableRows).toBe(2 + 3 + 4 + 5 + 3 + 3)
    expect(summary.isLikelyPseudoreplication).toBe(true)
    expect(summary.warning).toBeDefined()

    // The message must use the REAL numbers from the dataset, not hardcoded
    // placeholder numbers.
    expect(summary.warning?.message).toContain('6 units')
    expect(summary.warning?.message).toContain('20') // total usable rows
    expect(summary.warning?.message).toMatch(/between 2 and 5 measurements/)
    expect(summary.warning?.severity).toBe('caution')
  })

  it('does NOT fire when there is exactly one usable measurement per unit', () => {
    const dataset: Dataset = {
      format: 'nested',
      columns: ['experimental_unit', 'subsample', 'group', 'value'],
      rows: [
        row({ rowId: 'r1', experimentalUnit: 'mouse-1', group: 'Control', subsample: '1', value: 10 }),
        row({ rowId: 'r2', experimentalUnit: 'mouse-2', group: 'Control', subsample: '1', value: 11 }),
        row({ rowId: 'r3', experimentalUnit: 'mouse-3', group: 'Treatment', subsample: '1', value: 12 }),
        row({ rowId: 'r4', experimentalUnit: 'mouse-4', group: 'Treatment', subsample: '1', value: 13 }),
      ],
      issues: [],
    }

    const summary = analyzeReplicationStructure(dataset)

    expect(summary.isLikelyPseudoreplication).toBe(false)
    expect(summary.warning).toBeUndefined()
    expect(summary.totalUnits).toBe(4)
    expect(summary.totalUsableRows).toBe(4)
  })

  it('excludes rows with an "excluded"-severity issue from all counts', () => {
    const dataset: Dataset = {
      format: 'nested',
      columns: ['experimental_unit', 'subsample', 'group', 'value'],
      rows: [
        row({ rowId: 'r1', experimentalUnit: 'mouse-1', group: 'Control', subsample: '1', value: 10 }),
        row({ rowId: 'r2', experimentalUnit: 'mouse-1', group: 'Control', subsample: '2', value: 999 }),
        row({ rowId: 'r3', experimentalUnit: 'mouse-2', group: 'Control', subsample: '1', value: 11 }),
        row({ rowId: 'r4', experimentalUnit: 'mouse-3', group: 'Treatment', subsample: '1', value: 12 }),
        row({ rowId: 'r5', experimentalUnit: 'mouse-3', group: 'Treatment', subsample: '2', value: 998 }),
      ],
      issues: [
        { rowId: 'r2', severity: 'excluded', message: 'outlier' },
        { rowId: 'r5', severity: 'excluded', message: 'outlier' },
      ],
    }

    const summary = analyzeReplicationStructure(dataset)

    // After excluding r2 and r5, every unit has exactly 1 usable row - no
    // pseudoreplication should be detected.
    expect(summary.totalUsableRows).toBe(3)
    expect(summary.isLikelyPseudoreplication).toBe(false)
    expect(summary.unitCounts).toEqual(
      expect.arrayContaining([
        { unit: 'mouse-1', group: 'Control', usableRowCount: 1 },
        { unit: 'mouse-2', group: 'Control', usableRowCount: 1 },
        { unit: 'mouse-3', group: 'Treatment', usableRowCount: 1 },
      ]),
    )
  })

  it('keeps rows with only a "warning"-severity issue in the counts', () => {
    const dataset: Dataset = {
      format: 'nested',
      columns: ['experimental_unit', 'subsample', 'group', 'value'],
      rows: [
        row({ rowId: 'r1', experimentalUnit: 'mouse-1', group: 'Control', subsample: '1', value: 10 }),
        row({ rowId: 'r2', experimentalUnit: 'mouse-1', group: 'Control', subsample: '2', value: 10.5 }),
        row({ rowId: 'r3', experimentalUnit: 'mouse-2', group: 'Treatment', subsample: '1', value: 12 }),
        row({ rowId: 'r4', experimentalUnit: 'mouse-2', group: 'Treatment', subsample: '2', value: 12.5 }),
      ],
      issues: [{ rowId: 'r2', severity: 'warning', message: 'kept for review' }],
    }

    const summary = analyzeReplicationStructure(dataset)
    expect(summary.totalUsableRows).toBe(4)
    expect(summary.isLikelyPseudoreplication).toBe(true)
  })

  it('uses the generic "experimental unit" wording when no unitLabel is provided', () => {
    const dataset: Dataset = {
      format: 'nested',
      columns: ['experimental_unit', 'subsample', 'group', 'value'],
      rows: [
        row({ rowId: 'r1', experimentalUnit: 'u1', group: 'A', subsample: '1', value: 1 }),
        row({ rowId: 'r2', experimentalUnit: 'u1', group: 'A', subsample: '2', value: 2 }),
        row({ rowId: 'r3', experimentalUnit: 'u2', group: 'B', subsample: '1', value: 3 }),
        row({ rowId: 'r4', experimentalUnit: 'u2', group: 'B', subsample: '2', value: 4 }),
      ],
      issues: [],
    }

    const summary = analyzeReplicationStructure(dataset)
    expect(summary.warning?.message).toContain('experimental unit')
  })

  it('ignores rows from non-nested datasets', () => {
    const dataset: Dataset = {
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rows: [
        row({ rowId: 'r1', group: 'Control', value: 10 }),
        row({ rowId: 'r2', group: 'Control', value: 11 }),
      ],
      issues: [],
    }

    const summary = analyzeReplicationStructure(dataset)
    expect(summary.totalUnits).toBe(0)
    expect(summary.isLikelyPseudoreplication).toBe(false)
  })
})
