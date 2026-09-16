import { describe, expect, it } from 'vitest'
import { selectCategoricalTest } from './categoricalTestSelection'

describe('selectCategoricalTest', () => {
  it('chooses chi-square for a 2x2 table where every expected count is >= 5', () => {
    const expected = [
      [15, 15],
      [15, 15],
    ]
    const selection = selectCategoricalTest(expected)
    expect(selection.test).toBe('chi-square')
    expect(selection.hasLowExpectedCounts).toBe(false)
    expect(selection.reason).toMatch(/5 or greater/i)
  })

  it("chooses Fisher's exact for a genuinely small 2x2 table (an expected count below 5)", () => {
    const expected = [
      [2.5, 2.5],
      [2.5, 2.5],
    ]
    const selection = selectCategoricalTest(expected)
    expect(selection.test).toBe('fishers-exact')
    expect(selection.hasLowExpectedCounts).toBe(true)
    expect(selection.reason).toMatch(/fisher/i)
    expect(selection.reason).toMatch(/below 5/i)
  })

  it('is right at the boundary: an expected count of exactly 5 does NOT trigger Fisher\'s (only < 5 does)', () => {
    const expected = [
      [5, 20],
      [20, 5],
    ]
    const selection = selectCategoricalTest(expected)
    expect(selection.test).toBe('chi-square')
    expect(selection.hasLowExpectedCounts).toBe(false)
  })

  it('always chooses chi-square for a table larger than 2x2, regardless of expected counts (e.g. a 2x3 table with low counts)', () => {
    const expected = [
      [13.85, 11.54, 4.62],
      [16.15, 13.46, 5.38],
    ]
    const selection = selectCategoricalTest(expected)
    expect(selection.test).toBe('chi-square')
    expect(selection.hasLowExpectedCounts).toBe(true)
    expect(selection.reason).toMatch(/larger than 2x2/i)
    expect(selection.reason).toMatch(/caution/i)
  })

  it('always chooses chi-square for a table larger than 2x2 with all high expected counts, and does not mention a caution', () => {
    const expected = [
      [20, 20, 20],
      [20, 20, 20],
    ]
    const selection = selectCategoricalTest(expected)
    expect(selection.test).toBe('chi-square')
    expect(selection.hasLowExpectedCounts).toBe(false)
    expect(selection.reason).not.toMatch(/caution/i)
  })

  it('always chooses chi-square for a 3x2 table', () => {
    const expected = [
      [5, 5],
      [5, 5],
      [5, 5],
    ]
    const selection = selectCategoricalTest(expected)
    expect(selection.test).toBe('chi-square')
  })
})
