import { describe, expect, it } from 'vitest'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type { AuditClock } from '../../models/AuditEntry'
import {
  hydrateAnalysisPlanAudit,
  initialAnalysisPlanAuditState,
  lockAnalysisPlan,
  reachResults,
  resetAnalysisPlanAudit,
} from './analysisPlanAudit'

function design(overrides: Partial<ExperimentDesign> = {}): ExperimentDesign {
  return {
    researchQuestion: 'Does fertilizer X increase plant height?',
    outcome: { name: 'plant height', type: 'continuous', unit: 'cm' },
    groups: { count: 2, names: ['Control', 'Treatment'] },
    relationship: 'independent',
    experimentalUnit: { label: 'Plant' },
    technicalReplication: { present: false },
    repeatedMeasures: { present: false },
    exclusionsPredefined: false,
    ...overrides,
  }
}

function clockAt(times: string[]): AuditClock {
  let i = 0
  return { now: () => new Date(times[Math.min(i, times.length - 1)]), nextId: () => `id-${i++}` }
}

describe('reachResults before any lock', () => {
  it('never appends anything before the plan has been locked (no state to gate against)', () => {
    const clock = clockAt(['2026-09-17T17:00:00.000Z'])
    const state = reachResults(initialAnalysisPlanAuditState, design(), clock)
    expect(state.history).toEqual([])
    expect(state).toBe(initialAnalysisPlanAuditState)
  })
})

describe('lock -> results-viewed happy path', () => {
  it('locking appends exactly one plan-locked entry, then reaching results appends results-viewed once', () => {
    const clock = clockAt(['2026-09-17T17:42:00.000Z', '2026-09-17T17:42:05.000Z'])
    let state = lockAnalysisPlan(initialAnalysisPlanAuditState, design(), clock)
    expect(state.history.map((e) => e.action)).toEqual(['plan-locked'])

    state = reachResults(state, design(), clock)
    expect(state.history.map((e) => e.action)).toEqual(['plan-locked', 'results-viewed'])
  })

  it('does not append a second results-viewed on repeated re-renders with an unchanged design', () => {
    const clock = clockAt(['2026-09-17T17:42:00.000Z'])
    let state = lockAnalysisPlan(initialAnalysisPlanAuditState, design(), clock)
    state = reachResults(state, design(), clock)
    const afterFirstView = state.history

    state = reachResults(state, design(), clock)
    state = reachResults(state, design(), clock)

    expect(state.history).toEqual(afterFirstView)
    expect(state.history.map((e) => e.action)).toEqual(['plan-locked', 'results-viewed'])
  })
})

describe('post-lock modification detection', () => {
  it('fires design-modified + a fresh results-viewed when a tracked field changes after lock (group name)', () => {
    const clock = clockAt([
      '2026-09-17T17:42:00.000Z',
      '2026-09-17T17:42:05.000Z',
      '2026-09-17T17:44:00.000Z',
    ])
    let state = lockAnalysisPlan(initialAnalysisPlanAuditState, design(), clock)
    state = reachResults(state, design(), clock)

    const changedDesign = design({ groups: { count: 2, names: ['Control', 'High-dose'] } })
    state = reachResults(state, changedDesign, clock)

    expect(state.history.map((e) => e.action)).toEqual([
      'plan-locked',
      'results-viewed',
      'design-modified',
      'results-viewed',
    ])
    const modifiedEntry = state.history[2]
    expect(modifiedEntry.description).toContain('Modified after results were viewed')
    expect(modifiedEntry.description).toContain('Control, High-dose')
    expect(modifiedEntry.before).toMatchObject({ groupNames: ['Control', 'Treatment'] })
    expect(modifiedEntry.after).toMatchObject({ groupNames: ['Control', 'High-dose'] })
  })

  it('does NOT fire for untracked/irrelevant changes (research question, notes)', () => {
    const clock = clockAt(['2026-09-17T17:42:00.000Z'])
    let state = lockAnalysisPlan(initialAnalysisPlanAuditState, design(), clock)
    state = reachResults(state, design(), clock)
    const afterFirstView = state.history

    const irrelevantlyChangedDesign = design({
      researchQuestion: 'A totally different question',
      notes: 'new note',
    })
    state = reachResults(state, irrelevantlyChangedDesign, clock)

    expect(state.history).toEqual(afterFirstView)
    expect(state.history.map((e) => e.action)).toEqual(['plan-locked', 'results-viewed'])
  })

  it('does not fire before locking, even if the design would otherwise look "changed"', () => {
    const clock = clockAt(['2026-09-17T17:42:00.000Z'])
    const state = reachResults(initialAnalysisPlanAuditState, design({ relationship: 'paired' }), clock)
    expect(state.history).toEqual([])
  })

  it('re-baselines after logging a modification, so re-reaching results again does not re-fire', () => {
    const clock = clockAt(['2026-09-17T17:42:00.000Z'])
    let state = lockAnalysisPlan(initialAnalysisPlanAuditState, design(), clock)
    state = reachResults(state, design(), clock)

    const changedDesign = design({ relationship: 'paired' })
    state = reachResults(state, changedDesign, clock)
    const afterModification = state.history

    state = reachResults(state, changedDesign, clock)
    expect(state.history).toEqual(afterModification)
  })

  it('a second, distinct modification after the first appends its own design-modified entry', () => {
    const clock = clockAt(['2026-09-17T17:42:00.000Z'])
    let state = lockAnalysisPlan(initialAnalysisPlanAuditState, design(), clock)
    state = reachResults(state, design(), clock)

    state = reachResults(state, design({ relationship: 'paired' }), clock)
    state = reachResults(state, design({ relationship: 'paired', outcome: { name: 'leaf count', type: 'continuous' } }), clock)

    expect(state.history.map((e) => e.action)).toEqual([
      'plan-locked',
      'results-viewed',
      'design-modified',
      'results-viewed',
      'design-modified',
      'results-viewed',
    ])
  })

  it('re-locking after a change appends a new plan-locked entry without touching prior entries', () => {
    const clock = clockAt(['2026-09-17T17:42:00.000Z'])
    let state = lockAnalysisPlan(initialAnalysisPlanAuditState, design(), clock)
    state = reachResults(state, design(), clock)
    const changedDesign = design({ groups: { count: 2, names: ['Control', 'High-dose'] } })
    state = reachResults(state, changedDesign, clock)
    const beforeRelock = state.history

    state = lockAnalysisPlan(state, changedDesign, clock)

    expect(state.history.slice(0, beforeRelock.length)).toEqual(beforeRelock)
    expect(state.history.map((e) => e.action)).toEqual([
      'plan-locked',
      'results-viewed',
      'design-modified',
      'results-viewed',
      'plan-locked',
    ])
  })
})

describe('resetAnalysisPlanAudit', () => {
  it('returns a fresh, empty state for starting a new analysis session', () => {
    expect(resetAnalysisPlanAudit()).toEqual(initialAnalysisPlanAuditState)
  })
})

describe('Milestone 12: hydrateAnalysisPlanAudit (reconstructing state from a reopened project)', () => {
  it('reconstructs an unlocked state from a history with no plan-locked entry', () => {
    const state = hydrateAnalysisPlanAudit([], design())
    expect(state).toEqual({ history: [], lockedFields: undefined, viewedSinceLock: false })
  })

  it('reconstructs a locked, already-viewed state, without appending anything to the given history', () => {
    const clock = clockAt(['2026-09-17T17:42:00.000Z', '2026-09-17T17:42:05.000Z'])
    let live = lockAnalysisPlan(initialAnalysisPlanAuditState, design(), clock)
    live = reachResults(live, design(), clock)

    const hydrated = hydrateAnalysisPlanAudit(live.history, design())

    expect(hydrated.history).toEqual(live.history)
    expect(hydrated.history).toBe(live.history) // never copies/reorders the given history
    expect(hydrated.lockedFields).toEqual(live.lockedFields)
    expect(hydrated.viewedSinceLock).toBe(true)
  })

  it('does not cause a spurious duplicate results-viewed when reachResults runs again after hydrating', () => {
    const clock = clockAt(['2026-09-17T17:42:00.000Z', '2026-09-17T17:42:05.000Z'])
    let live = lockAnalysisPlan(initialAnalysisPlanAuditState, design(), clock)
    live = reachResults(live, design(), clock)

    const hydrated = hydrateAnalysisPlanAudit(live.history, design())
    const afterReachingAgain = reachResults(hydrated, design(), clock)

    expect(afterReachingAgain.history).toEqual(live.history)
  })

  it('reconstructs viewedSinceLock=false when the plan was locked but results were never viewed before saving', () => {
    const clock = clockAt(['2026-09-17T17:42:00.000Z'])
    const live = lockAnalysisPlan(initialAnalysisPlanAuditState, design(), clock)

    const hydrated = hydrateAnalysisPlanAudit(live.history, design())

    expect(hydrated.viewedSinceLock).toBe(false)
    expect(hydrated.lockedFields).toEqual(live.lockedFields)
  })

  it('only counts a results-viewed entry AFTER the most recent design-modified as "viewed since lock"', () => {
    const clock = clockAt(['2026-09-17T17:42:00.000Z', '2026-09-17T17:42:05.000Z'])
    let live = lockAnalysisPlan(initialAnalysisPlanAuditState, design(), clock)
    live = reachResults(live, design(), clock)
    const changedDesign = design({ groups: { count: 2, names: ['Control', 'High-dose'] } })
    live = reachResults(live, changedDesign, clock)

    // reachResults itself appends BOTH design-modified and a fresh
    // results-viewed atomically, so hydrating right after should still see
    // viewedSinceLock=true (the real, up-to-date design was already
    // re-baselined by `reachResults` above).
    const hydrated = hydrateAnalysisPlanAudit(live.history, changedDesign)
    expect(hydrated.viewedSinceLock).toBe(true)
    expect(hydrated.lockedFields).toEqual(live.lockedFields)
  })
})
