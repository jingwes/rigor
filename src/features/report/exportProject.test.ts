import { describe, expect, it, vi } from 'vitest'
import type { RigorProject } from '../../models/ProjectFile'
import { PROJECT_FILE_SCHEMA_VERSION } from '../../models/ProjectFile'
import { downloadProjectFile, serializeProject } from './exportProject'

function project(): RigorProject {
  return {
    schemaVersion: PROJECT_FILE_SCHEMA_VERSION,
    appVersion: '0.6.0-alpha',
    projectMetadata: { createdAt: '2026-01-01T00:00:00.000Z' },
    experimentDesign: {
      outcome: { name: 'plant height', type: 'continuous' },
      groups: { count: 2, names: ['Control', 'Treatment'] },
      relationship: 'independent',
      experimentalUnit: { label: 'Plant' },
      technicalReplication: { present: false },
      repeatedMeasures: { present: false },
      exclusionsPredefined: false,
    },
    dataset: {
      format: 'independent-groups',
      columns: ['sample_id', 'group', 'value'],
      rows: [],
      issues: [],
    },
  }
}

describe('serializeProject', () => {
  it('round-trips through JSON without losing data', () => {
    const json = serializeProject(project())
    expect(JSON.parse(json)).toEqual(project())
  })
})

describe('serializeProject - Milestone 7 aggregation', () => {
  it('keeps every raw nested row in the exported project even when aggregation was used', () => {
    const rawRows = Array.from({ length: 60 }, (_, i) => ({
      rowId: `row-${i}`,
      raw: {},
      experimentalUnit: `unit-${Math.floor(i / 10) + 1}`,
      subsample: String((i % 10) + 1),
      group: i < 30 ? 'Control' : 'Treatment',
      value: 10 + i,
    }))

    const nestedProject: RigorProject = {
      ...project(),
      experimentDesign: {
        ...project().experimentDesign,
        relationship: 'independent',
        technicalReplication: { present: true, measurementsPerUnit: 10 },
      },
      dataset: {
        format: 'nested',
        columns: ['experimental_unit', 'subsample', 'group', 'value'],
        rows: rawRows,
        issues: [],
      },
      analysis: {
        analysisType: 'welch-two-sample-t-test',
        result: {
          nA: 3,
          nB: 3,
          meanA: 10,
          meanB: 20,
          sdA: 1,
          sdB: 1,
          meanDifference: -10,
          meanDifferenceCi95Low: -12,
          meanDifferenceCi95High: -8,
          tStatistic: -10,
          degreesOfFreedom: 4,
          pValue: 0.001,
          effectSize: -5,
          effectSizeMethod: 'hedges_g',
        },
        groupALabel: 'Control',
        groupBLabel: 'Treatment',
        normalityDiagnosticsByGroup: {},
        aggregation: {
          method: 'mean',
          units: [
            { unit: 'unit-1', group: 'Control', aggregatedValue: 14.5, rawValueCount: 10 },
            { unit: 'unit-2', group: 'Control', aggregatedValue: 24.5, rawValueCount: 10 },
            { unit: 'unit-3', group: 'Control', aggregatedValue: 34.5, rawValueCount: 10 },
          ],
        },
      },
    }

    const json = serializeProject(nestedProject)
    const parsed = JSON.parse(json) as RigorProject

    // All 60 raw sub-measurement rows must still be present - aggregation
    // never deletes or filters the original dataset.
    expect(parsed.dataset.rows).toHaveLength(60)
    expect(parsed.dataset.rows).toEqual(nestedProject.dataset.rows)
    expect(parsed.analysis?.aggregation?.method).toBe('mean')
    expect(parsed.analysis?.aggregation?.units).toHaveLength(3)
  })
})

describe('downloadProjectFile', () => {
  it('creates and clicks a download link, then cleans up the object URL', () => {
    const createObjectURL = vi.fn(() => 'blob:fake-url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadProjectFile(project(), 'project.rigor.json')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})
