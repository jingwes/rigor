/**
 * Milestone 11: the pure state machine behind analysis-plan locking and the
 * audit history. No React here at all - `useAnalysisPlanAudit.ts` is a thin
 * `useState` wrapper around these functions, so the actual logic (when a
 * `'plan-locked'`/`'results-viewed'`/`'design-modified'` entry gets appended)
 * is independently unit-testable.
 *
 * This never blocks anything: `reachResults` always lets results be shown
 * (it never returns an "I refuse" state) - it only ever decides which
 * honest audit entries to append along the way.
 */

import type { ExperimentDesign } from '../../models/ExperimentDesign'
import { recordAuditEntry, systemAuditClock, type AuditClock, type AuditEntry } from '../../models/AuditEntry'
import {
  describeTrackedFieldChanges,
  diffTrackedDesignFields,
  extractTrackedDesignFields,
  type TrackedDesignFields,
} from '../analysis-plan/trackedDesignFields'

export interface AnalysisPlanAuditState {
  history: AuditEntry[]
  /** The tracked-field snapshot as of the most recent lock (or re-lock). */
  lockedFields?: TrackedDesignFields
  /** Whether a `'results-viewed'` entry has already been logged for the current `lockedFields` snapshot. */
  viewedSinceLock: boolean
}

export const initialAnalysisPlanAuditState: AnalysisPlanAuditState = {
  history: [],
  lockedFields: undefined,
  viewedSinceLock: false,
}

/**
 * "Lock analysis plan and view results": always appends a `'plan-locked'`
 * entry and captures a fresh tracked-fields snapshot. Safe to call again
 * later (e.g. after a modification) - each call is its own honest, timestamped
 * event, never a mutation of a previous one.
 */
export function lockAnalysisPlan(
  state: AnalysisPlanAuditState,
  design: ExperimentDesign,
  clock: AuditClock = systemAuditClock,
): AnalysisPlanAuditState {
  const history = recordAuditEntry(
    state.history,
    { action: 'plan-locked', description: 'Analysis plan locked' },
    clock,
  )
  return {
    history,
    lockedFields: extractTrackedDesignFields(design),
    viewedSinceLock: false,
  }
}

/**
 * Called whenever a results-eligible view is about to be shown to the
 * student, while the plan is already locked. Never blocks - it always
 * leaves the caller free to render the results; it only decides what to
 * append to the history:
 *
 *  - If the current design's tracked fields differ from the last-locked
 *    snapshot, appends a `'design-modified'` entry (with `before`/`after`)
 *    followed by a fresh `'results-viewed'` entry, and re-baselines the
 *    snapshot to the current fields (so the same change isn't logged twice).
 *  - Otherwise, appends a single `'results-viewed'` entry the first time
 *    results are reached under the current lock, and does nothing on
 *    subsequent re-renders/re-visits (no duplicate spam).
 *
 * If the plan isn't locked yet, this is a no-op - callers are expected to
 * only invoke it after `lockAnalysisPlan`.
 */
export function reachResults(
  state: AnalysisPlanAuditState,
  design: ExperimentDesign,
  clock: AuditClock = systemAuditClock,
): AnalysisPlanAuditState {
  if (!state.lockedFields) return state

  const currentFields = extractTrackedDesignFields(design)
  const changes = diffTrackedDesignFields(state.lockedFields, currentFields)

  if (changes.length > 0) {
    let history = recordAuditEntry(
      state.history,
      {
        action: 'design-modified',
        description: describeTrackedFieldChanges(changes),
        before: state.lockedFields,
        after: currentFields,
      },
      clock,
    )
    history = recordAuditEntry(history, { action: 'results-viewed', description: 'Results viewed' }, clock)
    return { history, lockedFields: currentFields, viewedSinceLock: true }
  }

  if (state.viewedSinceLock) return state

  const history = recordAuditEntry(
    state.history,
    { action: 'results-viewed', description: 'Results viewed' },
    clock,
  )
  return { ...state, history, viewedSinceLock: true }
}

/**
 * Starts a brand-new, empty analysis session. `seedHistory` (default: none)
 * lets a caller carry forward audit entries that honestly belong to this new
 * session despite predating it - currently only Milestone 14's
 * `'method-description-override'` entries recorded during the wizard, for
 * the exact design this session is starting with. This is still a genuine
 * reset (no `lockedFields`, not viewed) - `seedHistory` only affects the
 * starting `history`, never the locked/viewed state.
 */
export function resetAnalysisPlanAudit(seedHistory: AuditEntry[] = []): AnalysisPlanAuditState {
  return { ...initialAnalysisPlanAuditState, history: seedHistory }
}

/**
 * Milestone 12: reconstructs a full `AnalysisPlanAuditState` from a reopened
 * project's stored `analysisHistory` plus its (unchanged) `experimentDesign`,
 * so continuing a saved project neither fabricates a fresh, empty history
 * nor forces the student to re-lock a plan they had already locked before
 * saving.
 *
 * This never appends a new entry - `history` is kept exactly as given, an
 * honest historical record. It only reconstructs the two pieces of DERIVED,
 * session-only state a fresh page load would otherwise be missing:
 *
 *  - `lockedFields`: present (captured from `design`, the same design the
 *    project was saved with) whenever `history` contains at least one
 *    `'plan-locked'` entry - i.e. the plan was locked at some point before
 *    the project was saved.
 *  - `viewedSinceLock`: true when a `'results-viewed'` entry appears at or
 *    after the most recent `'plan-locked'`/`'design-modified'` entry, so
 *    resuming a project that already showed its results once doesn't log a
 *    spurious duplicate `'results-viewed'` entry the moment results are
 *    reached again.
 */
export function hydrateAnalysisPlanAudit(
  history: AuditEntry[],
  design: ExperimentDesign,
): AnalysisPlanAuditState {
  const isLocked = history.some((entry) => entry.action === 'plan-locked')
  if (!isLocked) {
    return { history, lockedFields: undefined, viewedSinceLock: false }
  }

  const lastBaselineIndex = history.findLastIndex(
    (entry) => entry.action === 'plan-locked' || entry.action === 'design-modified',
  )
  const viewedSinceLock = history
    .slice(lastBaselineIndex + 1)
    .some((entry) => entry.action === 'results-viewed')

  return {
    history,
    lockedFields: extractTrackedDesignFields(design),
    viewedSinceLock,
  }
}
