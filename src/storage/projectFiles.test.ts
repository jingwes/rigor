import { afterEach, describe, expect, it } from 'vitest'
import {
  buildRigorProject,
  deleteAutosavedProject,
  hasAutosavedProject,
  loadAutosavedProject,
  parseProjectFileText,
  saveAutosavedProject,
} from './projectFiles'
import { resetIndexedDbConnectionForTests } from './indexedDb'
import type { ExperimentDesign } from '../models/ExperimentDesign'
import type { Dataset } from '../models/Dataset'

function design(): ExperimentDesign {
  return {
    outcome: { name: 'plant height', type: 'continuous' },
    groups: { count: 2, names: ['Control', 'Treatment'] },
    relationship: 'independent',
    experimentalUnit: { label: 'Plant' },
    technicalReplication: { present: false },
    repeatedMeasures: { present: false },
    exclusionsPredefined: false,
  }
}

function dataset(): Dataset {
  return {
    format: 'independent-groups',
    columns: ['sample_id', 'group', 'value'],
    rows: [],
    issues: [],
  }
}

describe('parseProjectFileText', () => {
  it('accepts a well-formed serialized project', () => {
    const project = buildRigorProject({
      experimentDesign: design(),
      dataset: dataset(),
      analysisHistory: [],
      appVersion: '0.6.0-alpha',
    })
    const result = parseProjectFileText(JSON.stringify(project))
    expect(result).toEqual({ ok: true, project })
  })

  it('produces a clear, specific error for text that is not valid JSON at all - never a crash', () => {
    const result = parseProjectFileText('{ this is not json')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/not valid JSON/)
    }
  })

  it('produces a clear, specific error for valid JSON that is not a Rigor project', () => {
    const result = parseProjectFileText(JSON.stringify({ hello: 'world' }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/schemaVersion/)
    }
  })

  it('produces a clear, specific error for a project with a missing/mistyped field', () => {
    const project = buildRigorProject({
      experimentDesign: design(),
      dataset: dataset(),
      analysisHistory: [],
      appVersion: '0.6.0-alpha',
    })
    const corrupted = { ...project, dataset: { ...project.dataset, format: 'not-a-real-format' } }
    const result = parseProjectFileText(JSON.stringify(corrupted))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/dataset\.format/)
    }
  })

  it('migrates and accepts a pre-Milestone-11 (schema version 1) file', () => {
    const legacy = {
      schemaVersion: 1,
      appVersion: '0.5.0-alpha',
      projectMetadata: { createdAt: '2026-01-01T00:00:00.000Z' },
      experimentDesign: design(),
      dataset: dataset(),
      // No analysisHistory - this is the point of the test.
    }
    const result = parseProjectFileText(JSON.stringify(legacy))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.project.schemaVersion).toBe(2)
      expect(result.project.analysisHistory).toEqual([])
    }
  })
})

describe('IndexedDB autosave (using the in-memory fake-indexeddb shim)', () => {
  afterEach(async () => {
    await deleteAutosavedProject()
    resetIndexedDbConnectionForTests()
  })

  it('reports no autosave before anything has been saved', async () => {
    expect(await hasAutosavedProject()).toBe(false)
    expect(await loadAutosavedProject()).toBeUndefined()
  })

  it('round-trips a saved project through IndexedDB', async () => {
    const project = buildRigorProject({
      experimentDesign: design(),
      dataset: dataset(),
      analysisHistory: [],
      appVersion: '0.6.0-alpha',
    })

    await saveAutosavedProject(project)

    expect(await hasAutosavedProject()).toBe(true)
    const loaded = await loadAutosavedProject()
    expect(loaded).toEqual({ ok: true, project })
  })

  it('overwrites the single autosave slot on a second save (no multi-project library)', async () => {
    const first = buildRigorProject({
      experimentDesign: design(),
      dataset: dataset(),
      analysisHistory: [],
      appVersion: '0.6.0-alpha',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const second = buildRigorProject({
      experimentDesign: { ...design(), outcome: { name: 'leaf count', type: 'count' } },
      dataset: dataset(),
      analysisHistory: [],
      appVersion: '0.6.0-alpha',
      createdAt: '2026-01-02T00:00:00.000Z',
    })

    await saveAutosavedProject(first)
    await saveAutosavedProject(second)

    const loaded = await loadAutosavedProject()
    expect(loaded).toEqual({ ok: true, project: second })
  })

  it('actually clears the autosave on delete', async () => {
    const project = buildRigorProject({
      experimentDesign: design(),
      dataset: dataset(),
      analysisHistory: [],
      appVersion: '0.6.0-alpha',
    })
    await saveAutosavedProject(project)
    expect(await hasAutosavedProject()).toBe(true)

    await deleteAutosavedProject()

    expect(await hasAutosavedProject()).toBe(false)
    expect(await loadAutosavedProject()).toBeUndefined()
  })

  it('surfaces a clear error (not a crash) when the autosave slot holds a corrupted/malformed project', async () => {
    const project = buildRigorProject({
      experimentDesign: design(),
      dataset: dataset(),
      analysisHistory: [],
      appVersion: '0.6.0-alpha',
    })
    // Save something that is not actually a valid RigorProject, simulating
    // on-disk/IndexedDB corruption.
    await saveAutosavedProject({ ...project, experimentDesign: undefined } as never)

    const loaded = await loadAutosavedProject()
    expect(loaded?.ok).toBe(false)
  })
})
