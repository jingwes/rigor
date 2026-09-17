import { describe, expect, it } from 'vitest'
import { applyMigrations, UnsupportedSchemaVersionError, type RigorProjectV1 } from './migrations'
import { PROJECT_FILE_SCHEMA_VERSION } from '../models/ProjectFile'
import { validateRigorProjectLatestShape } from './projectValidation'

function v1Project(): RigorProjectV1 {
  return {
    schemaVersion: 1,
    appVersion: '0.5.0-alpha',
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
    // Note: no `analysis`, no `analysisHistory` - this is the real,
    // pre-Milestone-11 shape a version-1 file would have had.
  }
}

describe('applyMigrations - real historical migration: schema version 1 -> 2', () => {
  it("adds a missing analysisHistory: [] to an old project that predates the audit trail (Section 63: never make old saved projects silently unusable)", () => {
    const migrated = applyMigrations(v1Project() as unknown as Record<string, unknown>, 1)

    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.analysisHistory).toEqual([])
    // Everything else is carried through untouched.
    expect(migrated.experimentDesign).toEqual(v1Project().experimentDesign)
    expect(migrated.dataset).toEqual(v1Project().dataset)
    expect(migrated.appVersion).toBe('0.5.0-alpha')
  })

  it('produces a result that passes strict validation against the CURRENT RigorProject shape', () => {
    const migrated = applyMigrations(v1Project() as unknown as Record<string, unknown>, 1)
    expect(() => validateRigorProjectLatestShape(migrated)).not.toThrow()
  })

  it('is a no-op (identity) when the project already claims the current schema version', () => {
    const current = {
      ...v1Project(),
      schemaVersion: PROJECT_FILE_SCHEMA_VERSION,
      analysisHistory: [],
    } as unknown as Record<string, unknown>
    const migrated = applyMigrations(current, PROJECT_FILE_SCHEMA_VERSION)
    expect(migrated).toEqual(current)
  })
})

describe('applyMigrations - mechanism correctness (registry + version-gap handling)', () => {
  it('throws a clear, specific error for a project claiming a NEWER schema version than this build understands', () => {
    const future = { schemaVersion: PROJECT_FILE_SCHEMA_VERSION + 1 }
    expect(() => applyMigrations(future, PROJECT_FILE_SCHEMA_VERSION + 1)).toThrow(
      UnsupportedSchemaVersionError,
    )
    expect(() => applyMigrations(future, PROJECT_FILE_SCHEMA_VERSION + 1)).toThrow(/newer version of Rigor/)
  })

  it('throws a clear, specific error rather than silently returning a partially-migrated project when a version gap has no registered migration', () => {
    // Schema version 0 has no registered migration - simulates a future
    // gap in the registry (this never actually happens today, since the
    // only pre-current version is 1, which IS registered).
    expect(() => applyMigrations({ schemaVersion: 0 }, 0)).toThrow(UnsupportedSchemaVersionError)
    expect(() => applyMigrations({ schemaVersion: 0 }, 0)).toThrow(/no longer has a migration path/)
  })
})
