import { describe, expect, it } from 'vitest'
import { formatPValue } from './formatPValue'

describe('formatPValue', () => {
  it('never shows "P = 0.000" for a tiny p-value', () => {
    expect(formatPValue(0.0000001)).toBe('P < 0.001')
    expect(formatPValue(0.0000001)).not.toBe('P = 0.000')
  })

  it('rounds a p-value just above the threshold to three decimals, not "< 0.001"', () => {
    expect(formatPValue(0.00137363833)).toBe('P = 0.001')
  })

  it('uses "P < 0.001" for anything below the threshold', () => {
    expect(formatPValue(0.0009)).toBe('P < 0.001')
    expect(formatPValue(0.000999999)).toBe('P < 0.001')
  })

  it('rounds to three decimal places at or above the threshold', () => {
    expect(formatPValue(0.021)).toBe('P = 0.021')
    expect(formatPValue(0.0213116411)).toBe('P = 0.021')
    expect(formatPValue(0.5)).toBe('P = 0.500')
    expect(formatPValue(1)).toBe('P = 1.000')
  })

  it('never lets rounding produce "P = 0.000"', () => {
    // 0.0009999 rounds to 0.001 at 3dp but is below the < 0.001 threshold's
    // own display boundary - must still read as "< 0.001", not "= 0.001"
    // nor "= 0.000".
    expect(formatPValue(0.0009999)).toBe('P < 0.001')
  })

  it('handles a non-finite p-value without crashing or fabricating a number', () => {
    expect(formatPValue(Number.NaN)).toBe('P is undefined')
  })
})
