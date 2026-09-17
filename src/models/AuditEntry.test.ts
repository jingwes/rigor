import { describe, expect, it } from 'vitest'
import {
  appendAuditEntry,
  createAuditEntry,
  recordAuditEntry,
  type AuditClock,
  type AuditEntry,
} from './AuditEntry'

function fixedClock(iso: string, ids: string[]): AuditClock {
  let index = 0
  return {
    now: () => new Date(iso),
    nextId: () => ids[index++] ?? `overflow-${index}`,
  }
}

describe('createAuditEntry', () => {
  it('produces a fully-formed entry with the injected timestamp/id', () => {
    const clock = fixedClock('2026-09-17T17:42:00.000Z', ['id-1'])
    const entry = createAuditEntry(
      { action: 'plan-locked', description: 'Analysis plan locked' },
      clock,
    )
    expect(entry).toEqual({
      id: 'id-1',
      timestamp: '2026-09-17T17:42:00.000Z',
      action: 'plan-locked',
      description: 'Analysis plan locked',
    })
  })

  it('includes before/after only when provided', () => {
    const clock = fixedClock('2026-09-17T17:44:00.000Z', ['id-2'])
    const entry = createAuditEntry(
      {
        action: 'design-modified',
        description: 'Modified after results were viewed',
        before: { groupNames: ['A', 'B'] },
        after: { groupNames: ['Alpha', 'B'] },
      },
      clock,
    )
    expect(entry.before).toEqual({ groupNames: ['A', 'B'] })
    expect(entry.after).toEqual({ groupNames: ['Alpha', 'B'] })
  })

  it('defaults to the real system clock when none is injected', () => {
    const before = Date.now()
    const entry = createAuditEntry({ action: 'results-viewed', description: 'Results viewed' })
    const after = Date.now()
    expect(entry.id).toBeTruthy()
    const ts = new Date(entry.timestamp).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })
})

describe('appendAuditEntry', () => {
  it('appends in order without mutating the original array', () => {
    const clock = fixedClock('2026-09-17T17:42:00.000Z', ['a'])
    const first = createAuditEntry({ action: 'plan-locked', description: 'Analysis plan locked' }, clock)
    const history: AuditEntry[] = []
    const next = appendAuditEntry(history, first)

    expect(history).toEqual([]) // original untouched
    expect(next).toEqual([first])
    expect(next).not.toBe(history)

    const clock2 = fixedClock('2026-09-17T17:43:00.000Z', ['b'])
    const second = createAuditEntry({ action: 'results-viewed', description: 'Results viewed' }, clock2)
    const third = appendAuditEntry(next, second)

    // Order is preserved and the previous array reference is untouched.
    expect(next).toEqual([first])
    expect(third).toEqual([first, second])
    expect(third[0]).toBe(first)
    expect(third[1]).toBe(second)
  })

  it('never removes or reorders entries across repeated appends', () => {
    let history: AuditEntry[] = []
    const actions: Array<AuditEntry['action']> = [
      'plan-locked',
      'results-viewed',
      'design-modified',
      'results-viewed',
    ]
    const snapshots: AuditEntry[][] = []
    actions.forEach((action, i) => {
      const clock = fixedClock(`2026-09-17T17:4${i}:00.000Z`, [`id-${i}`])
      history = appendAuditEntry(history, createAuditEntry({ action, description: action }, clock))
      snapshots.push(history)
    })

    // Each earlier snapshot is still exactly its original prefix - nothing
    // was ever mutated out from under it.
    for (let i = 0; i < snapshots.length; i++) {
      expect(snapshots[i]).toHaveLength(i + 1)
      expect(snapshots[i].map((e) => e.action)).toEqual(actions.slice(0, i + 1))
    }
    expect(history.map((e) => e.action)).toEqual(actions)
  })
})

describe('recordAuditEntry', () => {
  it('builds and appends in one call, still pure', () => {
    const clock = fixedClock('2026-09-17T17:42:00.000Z', ['id-x'])
    const history: AuditEntry[] = []
    const result = recordAuditEntry(
      history,
      { action: 'plan-locked', description: 'Analysis plan locked' },
      clock,
    )
    expect(history).toEqual([])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ action: 'plan-locked', description: 'Analysis plan locked' })
  })
})
