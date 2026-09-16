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
