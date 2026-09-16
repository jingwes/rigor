import { describe, expect, it } from 'vitest'
import { validateCorrelationData } from './correlationValidation'

describe('validateCorrelationData', () => {
  it('parses valid x/y rows into usable numeric arrays', () => {
    const outcome = validateCorrelationData(
      ['x', 'y'],
      [
        { x: '1', y: '2' },
        { x: '2', y: '4' },
        { x: '3', y: '6' },
      ],
    )
    expect(outcome.issues).toHaveLength(0)
    expect(outcome.blockingMessage).toBeUndefined()
    expect(outcome.usable).toEqual({ x: [1, 2, 3], y: [2, 4, 6], n: 3 })
  })

  it('accepts an optional unit_id column, case-insensitively, alongside x/y', () => {
    const outcome = validateCorrelationData(
      ['unit_id', 'X', 'Y'],
      [
        { unit_id: 'p1', X: '1', Y: '2' },
        { unit_id: 'p2', X: '2', Y: '4' },
        { unit_id: 'p3', X: '3', Y: '6' },
      ],
    )
    expect(outcome.usable?.n).toBe(3)
    expect(outcome.rows.map((r) => r.unitId)).toEqual(['p1', 'p2', 'p3'])
  })

  it('flags a missing X value as excluded, never silently dropped from the row list', () => {
    const outcome = validateCorrelationData(
      ['x', 'y'],
      [
        { x: '', y: '2' },
        { x: '2', y: '4' },
        { x: '3', y: '6' },
        { x: '4', y: '8' },
      ],
    )
    expect(outcome.rows).toHaveLength(4)
    expect(outcome.issues).toHaveLength(1)
    expect(outcome.issues[0].severity).toBe('excluded')
    expect(outcome.issues[0].message).toMatch(/missing an X value/i)
    expect(outcome.usable?.n).toBe(3)
  })

  it('flags a missing Y value as excluded', () => {
    const outcome = validateCorrelationData(
      ['x', 'y'],
      [
        { x: '1', y: '2' },
        { x: '2', y: '' },
        { x: '3', y: '6' },
        { x: '4', y: '8' },
      ],
    )
    expect(outcome.issues.some((i) => i.message.match(/missing a Y value/i))).toBe(true)
    expect(outcome.usable?.n).toBe(3)
  })

  it('flags a non-numeric X value', () => {
    const outcome = validateCorrelationData(
      ['x', 'y'],
      [
        { x: 'ten', y: '2' },
        { x: '2', y: '4' },
        { x: '3', y: '6' },
        { x: '4', y: '8' },
      ],
    )
    expect(outcome.issues.some((i) => i.message.match(/'ten' is not a number/i))).toBe(true)
    expect(outcome.usable?.n).toBe(3)
  })

  it('flags a non-numeric Y value', () => {
    const outcome = validateCorrelationData(
      ['x', 'y'],
      [
        { x: '1', y: 'high' },
        { x: '2', y: '4' },
        { x: '3', y: '6' },
        { x: '4', y: '8' },
      ],
    )
    expect(outcome.issues.some((i) => i.message.match(/'high' is not a number/i))).toBe(true)
    expect(outcome.usable?.n).toBe(3)
  })

  it('flags a non-finite (Infinity) X value', () => {
    const outcome = validateCorrelationData(
      ['x', 'y'],
      [
        { x: 'Infinity', y: '2' },
        { x: '2', y: '4' },
        { x: '3', y: '6' },
        { x: '4', y: '8' },
      ],
    )
    expect(outcome.issues.some((i) => i.message.match(/infinite/i))).toBe(true)
    expect(outcome.usable?.n).toBe(3)
  })

  it('never silently drops a row with an issue - it stays in `rows`', () => {
    const outcome = validateCorrelationData(
      ['x', 'y'],
      [
        { x: 'nonsense', y: '2' },
        { x: '2', y: '4' },
        { x: '3', y: '6' },
      ],
    )
    expect(outcome.rows).toHaveLength(3)
    expect(outcome.rows.find((r) => r.rawX === 'nonsense')).toBeDefined()
  })

  it('silently skips a fully blank row (no x, no y, no unit id) rather than flagging it', () => {
    const outcome = validateCorrelationData(
      ['x', 'y'],
      [
        { x: '1', y: '2' },
        { x: '', y: '' },
        { x: '2', y: '4' },
        { x: '3', y: '6' },
      ],
    )
    expect(outcome.rows).toHaveLength(3)
    expect(outcome.usable?.n).toBe(3)
  })

  it('blocks with a clear message when there are fewer than 3 valid rows', () => {
    const outcome = validateCorrelationData(
      ['x', 'y'],
      [
        { x: '1', y: '2' },
        { x: '2', y: '4' },
      ],
    )
    expect(outcome.usable).toBeUndefined()
    expect(outcome.blockingMessage).toMatch(/at least 3 valid rows/i)
  })

  it('detects a constant X column and refuses gracefully, without sending degenerate data onward', () => {
    const outcome = validateCorrelationData(
      ['x', 'y'],
      [
        { x: '5', y: '2' },
        { x: '5', y: '4' },
        { x: '5', y: '6' },
        { x: '5', y: '8' },
      ],
    )
    expect(outcome.usable).toBeUndefined()
    expect(outcome.blockingMessage).toMatch(/every valid x value is the same/i)
  })

  it('detects a constant Y column and refuses gracefully', () => {
    const outcome = validateCorrelationData(
      ['x', 'y'],
      [
        { x: '1', y: '9' },
        { x: '2', y: '9' },
        { x: '3', y: '9' },
        { x: '4', y: '9' },
      ],
    )
    expect(outcome.usable).toBeUndefined()
    expect(outcome.blockingMessage).toMatch(/every valid y value is the same/i)
  })

  it('reports a blocking message when the x/y columns cannot be found at all', () => {
    const outcome = validateCorrelationData(['foo', 'bar'], [{ foo: '1', bar: '2' }])
    expect(outcome.usable).toBeUndefined()
    expect(outcome.blockingMessage).toMatch(/needs an 'x' column and a 'y' column/i)
  })
})
