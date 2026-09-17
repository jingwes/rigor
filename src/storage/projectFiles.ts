/**
 * Milestone 12: the app-facing project-file/persistence API - the one
 * module the rest of the app needs for opening a `.rigor.json` file,
 * autosaving in-progress work to IndexedDB, and reopening that autosave.
 * Builds on the generic `indexedDb.ts` key-value wrapper and the
 * `projectValidation.ts`/`migrations.ts` schema pipeline.
 *
 * Nothing in this module ever makes a network request - every function
 * here only touches `JSON.parse` and the browser's local IndexedDB.
 */
import type { RigorProject } from '../models/ProjectFile'
import { PROJECT_FILE_SCHEMA_VERSION } from '../models/ProjectFile'
import { applyMigrations } from './migrations'
import { ProjectValidationError, validateRigorProjectLatestShape } from './projectValidation'
import { idbDelete, idbGet, idbSet } from './indexedDb'

export { ProjectValidationError }

/** The single IndexedDB key Rigor autosaves the most-recent in-progress project under (Section 39: no multi-project library UI yet). */
const AUTOSAVE_KEY = 'current-project'

export type OpenProjectResult = { ok: true; project: RigorProject } | { ok: false; error: string }

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parses+migrates+validates an already-parsed JSON value (e.g. read back out
 * of IndexedDB, which stores structured-cloned values rather than text) into
 * a current-shape `RigorProject`. Never throws - every failure mode (wrong
 * top-level shape, unsupported schema version, a specific missing/mistyped
 * field) comes back as `{ ok: false, error }` with a human-readable message.
 */
export function parseRigorProjectValue(parsed: unknown): OpenProjectResult {
  try {
    if (!isPlainRecord(parsed)) {
      throw new ProjectValidationError(
        'This is not a Rigor project (expected a JSON object at the top level).',
      )
    }
    if (typeof parsed.schemaVersion !== 'number') {
      throw new ProjectValidationError(
        'This file is missing a numeric "schemaVersion" field, so it cannot be recognized as a Rigor ' +
          'project file.',
      )
    }
    const migrated = applyMigrations(parsed, parsed.schemaVersion)
    const project = validateRigorProjectLatestShape(migrated)
    return { ok: true, project }
  } catch (error) {
    if (error instanceof Error) return { ok: false, error: error.message }
    return { ok: false, error: 'This project file could not be opened, for an unknown reason.' }
  }
}

/**
 * Same as `parseRigorProjectValue`, but for raw JSON TEXT (e.g. the contents
 * of an uploaded `.rigor.json` file). A malformed-JSON file produces a
 * clear, specific parse error rather than an uncaught exception.
 */
export function parseProjectFileText(text: string): OpenProjectResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return {
      ok: false,
      error:
        "This doesn't look like a valid Rigor project file (its contents are not valid JSON): " +
        `${error instanceof Error ? error.message : String(error)}`,
    }
  }
  return parseRigorProjectValue(parsed)
}

/**
 * Assembles a `RigorProject` from the pieces the app has in memory at a
 * given moment - shared by the explicit "Save project" download
 * (`exportProject.ts`) and every IndexedDB autosave, so both always produce
 * the exact same shape.
 */
export function buildRigorProject(input: {
  experimentDesign: RigorProject['experimentDesign']
  dataset: RigorProject['dataset']
  analysisHistory: RigorProject['analysisHistory']
  analysis?: RigorProject['analysis']
  visualization?: RigorProject['visualization']
  appVersion: string
  createdAt?: string
}): RigorProject {
  return {
    schemaVersion: PROJECT_FILE_SCHEMA_VERSION,
    appVersion: input.appVersion,
    projectMetadata: { createdAt: input.createdAt ?? new Date().toISOString() },
    experimentDesign: input.experimentDesign,
    dataset: input.dataset,
    analysis: input.analysis,
    visualization: input.visualization,
    analysisHistory: input.analysisHistory,
  }
}

// --- IndexedDB autosave: a single "most-recent project" slot ---------------
// Per the project spec's "Continue last project" framing (Section 39), this
// milestone keeps exactly one autosaved project - not a project-management
// library. Saving again simply overwrites the previous autosave.

export async function saveAutosavedProject(project: RigorProject): Promise<void> {
  await idbSet(AUTOSAVE_KEY, project)
}

/** `undefined` means "no autosave exists yet" - distinct from `{ ok: false }`, which means one exists but is unreadable. */
export async function loadAutosavedProject(): Promise<OpenProjectResult | undefined> {
  const raw = await idbGet<unknown>(AUTOSAVE_KEY)
  if (raw === undefined) return undefined
  return parseRigorProjectValue(raw)
}

export async function hasAutosavedProject(): Promise<boolean> {
  const raw = await idbGet<unknown>(AUTOSAVE_KEY)
  return raw !== undefined
}

export async function deleteAutosavedProject(): Promise<void> {
  await idbDelete(AUTOSAVE_KEY)
}
