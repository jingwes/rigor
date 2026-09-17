import { describe, expect, it } from 'vitest'
import { ProjectValidationError, validateRigorProjectLatestShape } from './projectValidation'
import { PROJECT_FILE_SCHEMA_VERSION } from '../models/ProjectFile'
import type { RigorProject } from '../models/ProjectFile'

function wellFormedProject(): RigorProject {
  return {
    schemaVersion: PROJECT_FILE_SCHEMA_VERSION,
    appVersion: '0.6.0-alpha',
    projectMetadata: { createdAt: '2026-01-01T00:00:00.000Z' },
    experimentDesign: {
      researchQuestion: 'Does fertilizer X increase plant height?',
      outcome: { name: 'plant height', type: 'continuous', unit: 'cm' },
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
      rows: [
        { rowId: 'row-1', raw: { sample_id: '1', group: 'Control', value: '10' }, group: 'Control', value: 10 },
      ],
      issues: [],
    },
    analysis: {
      analysisType: 'welch-two-sample-t-test',
      result: {
        nA: 3,
        nB: 3,
        meanA: 10,
        meanB: 13,
        sdA: 1,
        sdB: 1,
        meanDifference: -3,
        meanDifferenceCi95Low: -5,
        meanDifferenceCi95High: -1,
        tStatistic: -3.5,
        degreesOfFreedom: 4,
        pValue: 0.02,
        effectSize: -2.9,
        effectSizeMethod: 'hedges_g',
      },
      groupALabel: 'Control',
      groupBLabel: 'Treatment',
      normalityDiagnosticsByGroup: {
        Control: { n: 3, shapiroWilkW: 1, shapiroWilkPValue: 1, skewness: 0 },
      },
    },
    analysisHistory: [
      { id: 'entry-1', timestamp: '2026-01-01T00:00:00.000Z', action: 'plan-locked', description: 'Analysis plan locked' },
    ],
  }
}

describe('validateRigorProjectLatestShape - accepts well-formed input', () => {
  it('accepts a well-formed current-version project unchanged', () => {
    const project = wellFormedProject()
    expect(validateRigorProjectLatestShape(project)).toEqual(project)
  })

  it('accepts a project with no analysis/visualization (both optional)', () => {
    const project: Record<string, unknown> = { ...wellFormedProject() }
    delete project.analysis
    expect(() => validateRigorProjectLatestShape(project)).not.toThrow()
  })

  it('accepts a project with no groups.roles at all (every project before Milestone 15, and most after)', () => {
    const project = wellFormedProject()
    expect(project.experimentDesign.groups.roles).toBeUndefined()
    expect(() => validateRigorProjectLatestShape(project)).not.toThrow()
  })

  it('accepts a project with a valid groups.roles designation', () => {
    const project = wellFormedProject()
    project.experimentDesign.groups.roles = { Control: 'control' }
    expect(validateRigorProjectLatestShape(project)).toEqual(project)
  })
})

describe('validateRigorProjectLatestShape - groups.roles (Milestone 15)', () => {
  it('rejects a non-object groups.roles, naming the field', () => {
    const project = wellFormedProject()
    const bad = {
      ...project,
      experimentDesign: {
        ...project.experimentDesign,
        groups: { ...project.experimentDesign.groups, roles: 'control' },
      },
    }
    expect(() => validateRigorProjectLatestShape(bad)).toThrow(/experimentDesign\.groups\.roles/)
  })

  it('rejects an unrecognized role value, naming the group', () => {
    const project = wellFormedProject()
    const bad = {
      ...project,
      experimentDesign: {
        ...project.experimentDesign,
        groups: { ...project.experimentDesign.groups, roles: { Control: 'main-character' } },
      },
    }
    expect(() => validateRigorProjectLatestShape(bad)).toThrow(
      /experimentDesign\.groups\.roles\.Control/,
    )
  })
})

describe('validateRigorProjectLatestShape - rejects malformed input with a specific error', () => {
  it('rejects a non-object top level', () => {
    expect(() => validateRigorProjectLatestShape('not an object')).toThrow(ProjectValidationError)
    expect(() => validateRigorProjectLatestShape(null)).toThrow(ProjectValidationError)
    expect(() => validateRigorProjectLatestShape(42)).toThrow(ProjectValidationError)
  })

  it('rejects a schemaVersion that does not match the current version, naming the field', () => {
    const project = { ...wellFormedProject(), schemaVersion: 999 }
    expect(() => validateRigorProjectLatestShape(project)).toThrow(/schemaVersion/)
  })

  it('rejects a missing required field with a specific path', () => {
    const project: Record<string, unknown> = { ...wellFormedProject() }
    delete project.appVersion
    expect(() => validateRigorProjectLatestShape(project)).toThrow(/appVersion/)
  })

  it('rejects a missing nested required field with a specific dotted path', () => {
    const project = wellFormedProject()
    const withoutOutcomeName = {
      ...project,
      experimentDesign: {
        ...project.experimentDesign,
        outcome: { type: 'continuous' },
      },
    }
    expect(() => validateRigorProjectLatestShape(withoutOutcomeName)).toThrow(
      /experimentDesign\.outcome\.name/,
    )
  })

  it('rejects a wrong-typed field, naming the expected vs actual type', () => {
    const project = wellFormedProject()
    const wrongType = {
      ...project,
      experimentDesign: { ...project.experimentDesign, groups: { count: 'two', names: ['A', 'B'] } },
    }
    try {
      validateRigorProjectLatestShape(wrongType)
      throw new Error('expected validateRigorProjectLatestShape to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectValidationError)
      expect((error as Error).message).toContain('experimentDesign.groups.count')
      expect((error as Error).message).toContain('expected a number')
      expect((error as Error).message).toContain('string')
    }
  })

  it('rejects an invalid enum value, listing what was allowed', () => {
    const project = wellFormedProject()
    const badFormat = { ...project, dataset: { ...project.dataset, format: 'spreadsheet' } }
    expect(() => validateRigorProjectLatestShape(badFormat)).toThrow(/dataset\.format/)
  })

  it('rejects an analysisHistory entry with an invalid action', () => {
    const project = wellFormedProject()
    const badHistory = {
      ...project,
      analysisHistory: [{ id: 'e1', timestamp: 't', action: 'not-a-real-action', description: 'x' }],
    }
    expect(() => validateRigorProjectLatestShape(badHistory)).toThrow(/analysisHistory\[0\]\.action/)
  })

  it('rejects a dataset row with a non-numeric value field', () => {
    const project = wellFormedProject()
    const badRow = {
      ...project,
      dataset: {
        ...project.dataset,
        rows: [{ rowId: 'row-1', raw: {}, value: 'not-a-number' }],
      },
    }
    expect(() => validateRigorProjectLatestShape(badRow)).toThrow(/dataset\.rows\[0\]\.value/)
  })
})
