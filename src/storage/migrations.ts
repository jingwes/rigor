/**
 * Milestone 12: the project-file schema-migration registry (project spec
 * Section 63: "Never make old saved projects silently unusable.").
 *
 * Historical note on why there is exactly one real migration here: Rigor's
 * `PROJECT_FILE_SCHEMA_VERSION` constant was introduced in Milestone 6 and
 * left at `1` through Milestone 11, even though Milestone 11 added a new
 * required field (`analysisHistory`) to `RigorProject` - a gap in that
 * milestone's own bookkeeping, not a deliberate "no shape change" decision.
 * This milestone corrects that: the pre-Milestone-11 shape (everything
 * `RigorProject` has today, minus `analysisHistory`) is honestly treated as
 * schema version 1, the current shape is bumped to version 2, and a REAL
 * migration is registered between them - not a stub - because a project
 * file downloaded by an early build genuinely could still exist on a
 * student's disk.
 *
 * The mechanism matters more than this one migration: `migrations` is a
 * registry keyed by the version being migrated FROM, and `applyMigrations`
 * walks it forward one step at a time. The next time a field is added or
 * changed, its migration slot gets registered the same way - nothing about
 * `applyMigrations` itself needs to change. For example, a hypothetical
 * future Milestone that renamed `dataset` to `datasetV2` would register
 * `migrations[2] = (project) => { const { dataset, ...rest } = project;
 * return { ...rest, schemaVersion: 3, datasetV2: dataset } }` and bump
 * `PROJECT_FILE_SCHEMA_VERSION` to 3 - nothing else in this file would need
 * to change.
 */
import type { RigorProject } from '../models/ProjectFile'
import { PROJECT_FILE_SCHEMA_VERSION } from '../models/ProjectFile'

/**
 * The pre-Milestone-11 shape: identical to the current `RigorProject`
 * except for `schemaVersion` and the absence of `analysisHistory`. Exported
 * mainly so tests can build a well-typed "old project file" fixture.
 */
export interface RigorProjectV1 {
  schemaVersion: 1
  appVersion: string
  projectMetadata: RigorProject['projectMetadata']
  experimentDesign: RigorProject['experimentDesign']
  dataset: RigorProject['dataset']
  analysis?: RigorProject['analysis']
  visualization?: RigorProject['visualization']
}

/**
 * A single migration step: takes a plain object already confirmed to
 * roughly match the shape of the version it declares itself to be, and
 * returns a plain object matching the NEXT version's shape. Migrations
 * operate on loosely-typed `Record<string, unknown>`s (not the strict
 * `RigorProject` type) because the whole point is to transform a shape the
 * current types don't describe - the result is only checked against the
 * real `RigorProject` type afterwards, by `projectValidation.ts`.
 */
export type MigrationFn = (project: Record<string, unknown>) => Record<string, unknown>

/** Keyed by the version being migrated FROM. `migrations[1]` turns a version-1 project into a version-2 one. */
export const migrations: Record<number, MigrationFn> = {
  1: (project) => ({
    ...project,
    schemaVersion: 2,
    // Milestone 11 added this as a required, always-present (possibly
    // empty) field. A version-1 file predates the audit trail entirely, so
    // there is nothing honest to backfill beyond "no events were recorded
    // yet" - NOT an empty array standing in for lost data, but a true
    // description of a file from before this feature existed.
    analysisHistory: [],
  }),
}

export class UnsupportedSchemaVersionError extends Error {}

/**
 * Runs whichever migrations are needed to bring `project` (already confirmed
 * to be a plain object, currently claiming schema version `fromVersion`) up
 * to `PROJECT_FILE_SCHEMA_VERSION`, applying each step in the registry in
 * sequence. Never silently drops or guesses data:
 *
 *  - If `fromVersion` is NEWER than this build understands, throws a clear
 *    error telling the student to use an up-to-date version of Rigor,
 *    rather than attempting to "read what it can" from an unknown shape.
 *  - If `fromVersion` is older but this build has no registered migration
 *    path for some version in between, throws a clear error naming exactly
 *    which version gap is missing, rather than silently returning a
 *    partially-migrated (and therefore wrong) project.
 */
export function applyMigrations(
  project: Record<string, unknown>,
  fromVersion: number,
): Record<string, unknown> {
  if (fromVersion > PROJECT_FILE_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(
      `This project file was saved by a newer version of Rigor (schema version ${fromVersion}) than ` +
        `this app understands (schema version ${PROJECT_FILE_SCHEMA_VERSION}). Please open it with an ` +
        'up-to-date version of Rigor.',
    )
  }

  let current = project
  for (let version = fromVersion; version < PROJECT_FILE_SCHEMA_VERSION; version += 1) {
    const migrate = migrations[version]
    if (!migrate) {
      throw new UnsupportedSchemaVersionError(
        `This project file uses schema version ${fromVersion}, and this version of Rigor no longer ` +
          `has a migration path from schema version ${version} to ${version + 1}. It can't be opened safely.`,
      )
    }
    current = migrate(current)
  }
  return current
}
