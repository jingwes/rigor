import { describe, expect, it } from 'vitest'
import { computeHistogram, sturgesBinCount } from './histogram'

describe('sturgesBinCount', () => {
  it('returns 1 bin for n <= 1', () => {
    expect(sturgesBinCount(0)).toBe(1)
    expect(sturgesBinCount(1)).toBe(1)
  })

  it('grows logarithmically with n', () => {
    expect(sturgesBinCount(8)).toBe(4)
    expect(sturgesBinCount(16)).toBe(5)
  })
})

describe('computeHistogram', () => {
  it('returns no bins for an empty input', () => {
    expect(computeHistogram([])).toEqual({ bins: [], binWidth: 0 })
  })

  it('puts every value into one bin when all values are identical', () => {
    const result = computeHistogram([5, 5, 5])
    expect(result.bins).toHaveLength(1)
    expect(result.bins[0].count).toBe(3)
  })

  it('bins values into the requested number of equal-width bins', () => {
    const result = computeHistogram([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5)
    expect(result.bins).toHaveLength(5)
    expect(result.binWidth).toBeCloseTo(1.8, 9)
    const totalCount = result.bins.reduce((sum, bin) => sum + bin.count, 0)
    expect(totalCount).toBe(10)
  })

  it('includes the maximum value in the last bin, not dropped/overflowed', () => {
    const result = computeHistogram([0, 10], 2)
    const totalCount = result.bins.reduce((sum, bin) => sum + bin.count, 0)
    expect(totalCount).toBe(2)
    expect(result.bins[result.bins.length - 1].count).toBeGreaterThanOrEqual(1)
  })

  it('uses Sturges rule when no explicit bin count is given', () => {
    const values = Array.from({ length: 8 }, (_, i) => i)
    const result = computeHistogram(values)
    expect(result.bins).toHaveLength(sturgesBinCount(8))
  })
})
