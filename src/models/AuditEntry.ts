/**
 * Milestone 11: the append-only analysis-plan audit trail.
 *
 * Philosophy (project spec, section 29-30): this is about TRANSPARENCY, not
 * restriction. Locking an analysis plan and later changing it are both
 * always allowed - nothing in this module ever blocks a student action. Its
 * only job is to keep an honest, timestamped record of what happened and
 * when, so the reproducibility trail stays truthful.
 *
 * Every function here is a plain, pure function over immutable data - no
 * React, no dates read from a hidden global clock by default (callers can
 * inject one), so this is fully unit-testable on its own. `appendAuditEntry`
 * never mutates the array it's given; it always returns a new array with
 * the new entry on the end. Nothing in this module ever removes, reorders,
 * or rewrites a past entry - "append-only" is enforced by never exposing an
 * operation that could do those things.
 */

export type AuditAction =
  | 'plan-locked'
  | 'results-viewed'
  | 'design-modified'
  /**
   * Reserved for Milestone 28's future user-driven exclusion feature. No UI
   * in this version of Rigor lets a student add/change/remove an exclusion
   * (Milestone 9's "excluded" rows are only ever produced automatically by
   * data-validation, not chosen by the student) - so nothing ever produces
   * an entry with this action yet. It's included now so that when that
   * feature is built, it only needs to call `recordAuditEntry` with this
   * action rather than widen this type and every switch over it.
   */
  | 'exclusion-changed'
  /**
   * Reserved similarly for a future data-editing feature (re-importing or
   * hand-editing an already-imported dataset). Nothing in this version of
   * Rigor lets a student modify data after import, so nothing produces this
   * yet either.
   */
  | 'data-modified'

export interface AuditEntry {
  id: string
  /** ISO 8601 timestamp of when this event happened. */
  timestamp: string
  action: AuditAction
  /** Human-readable, e.g. "Analysis plan locked" or "Results viewed". */
  description: string
  /** Optional "before" snapshot for entries that record a change. */
  before?: unknown
  /** Optional "after" snapshot for entries that record a change. */
  after?: unknown
}

/** Injectable so tests can produce deterministic ids/timestamps. */
export interface AuditClock {
  now(): Date
  nextId(): string
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const systemAuditClock: AuditClock = {
  now: () => new Date(),
  nextId: randomId,
}

export interface AuditEntryInput {
  action: AuditAction
  description: string
  before?: unknown
  after?: unknown
}

/**
 * Builds one new, fully-formed `AuditEntry` - pure given the clock it's
 * handed (defaults to the real system clock/id generator in production).
 */
export function createAuditEntry(
  input: AuditEntryInput,
  clock: AuditClock = systemAuditClock,
): AuditEntry {
  const entry: AuditEntry = {
    id: clock.nextId(),
    timestamp: clock.now().toISOString(),
    action: input.action,
    description: input.description,
  }
  if (input.before !== undefined) entry.before = input.before
  if (input.after !== undefined) entry.after = input.after
  return entry
}

/**
 * Appends one entry to a history, always returning a NEW array and never
 * mutating `history` - the only way this module lets a caller extend the
 * trail. There is deliberately no exported function that removes, reorders,
 * or replaces an existing entry.
 */
export function appendAuditEntry(
  history: readonly AuditEntry[],
  entry: AuditEntry,
): AuditEntry[] {
  return [...history, entry]
}

/**
 * Convenience: build an entry and append it in one call, still pure given
 * the clock.
 */
export function recordAuditEntry(
  history: readonly AuditEntry[],
  input: AuditEntryInput,
  clock: AuditClock = systemAuditClock,
): AuditEntry[] {
  return appendAuditEntry(history, createAuditEntry(input, clock))
}
