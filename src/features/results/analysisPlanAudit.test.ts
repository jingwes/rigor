import { describe, expect, it } from 'vitest'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type { AuditClock } from '../../models/AuditEntry'
import {
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
