// @vitest-environment node
/**
 * The release-blocking numerical verification for Milestone 8's
 * `one-way-anova` analysis type, following the exact pattern set by
 * `engine.realPyodide.test.ts`/`normalityDiagnostics.realPyodide.test.ts`: a
 * REAL Pyodide interpreter, real NumPy/SciPy loaded via Pyodide's own
 * `loadPackage`, driven through the exact same `engine.ts` code the browser
 * worker runs. Nothing here is mocked.
 *
 * Golden-value dataset: R's built-in `PlantGrowth` dataset (`weight` by
 * `group`: "ctrl"/"trt1"/"trt2", a classic teaching example for one-way
 * ANOVA), pulled directly from R via `data(PlantGrowth)`:
 *
 *   ctrl (n=10): 4.17 5.58 5.18 6.11 4.50 4.61 5.17 4.53 5.33 5.14
 *   trt1 (n=10): 4.81 4.17 4.41 3.59 5.87 3.83 6.03 4.89 4.32 4.69
 *   trt2 (n=10): 6.31 5.12 5.54 5.50 5.37 5.29 4.92 6.15 5.80 5.26
 *
 * All expected values below were computed independently by running this
 * exact raw data through R (a mature, independent implementation, NOT
 * SciPy) on the machine that wrote this test (`Rscript`, R's `stats`
 * package) - never invented by running our own code and asserting
 * self-consistency:
 *
 *  - Per-group descriptives (`mean`/`sd`, ddof=1): computed via R's own
 *    `mean()`/`sd()`:
 *      ctrl: n=10, mean=5.032,  sd=0.5830913784
 *      trt1: n=10, mean=4.661,  sd=0.7936756964
 *      trt2: n=10, mean=5.526,  sd=0.4425732833
 *
 *  - Omnibus test - Welch's (unequal-variance) one-way ANOVA, via R's
 *    `oneway.test(weight ~ group, data = PlantGrowth)` (var.equal = FALSE is
 *    the default):
 *      F = 5.1809724081, num df = 2, denom df = 17.1284186166,
 *      p = 0.0173928215
 *    (R's rounded printed output: "F = 5.181, num df = 2.000, denom df =
 *    17.128, p-value = 0.01739", confirming the full-precision numbers
 *    above.)
 *
 *    For context/cross-check only (NOT asserted as Rigor's own omnibus
 *    result - Rigor always reports the Welch version, never this one): the
 *    CLASSIC equal-variance ANOVA for the same data, via R's
 *    `summary(aov(weight ~ group, data = PlantGrowth))`, is the well-known
 *    textbook result F = 4.846, df = (2, 27), p = 0.0159 - a different,
 *    smaller F than the Welch version above, confirming these are genuinely
 *    two different formulas and Rigor's `_welch_anova` in `anova.py` is not
 *    accidentally computing the classic version.
 *
 *  - Pairwise comparisons - Welch's two-sample t-test for every pair, via
 *    R's `t.test(a, b)` on each pair of raw group vectors:
 *      ctrl vs trt1: t=1.1912603818,  df=16.5235850569, p_raw=0.2503825086,
 *                    meanDiff(ctrl-trt1)=0.371
 *      ctrl vs trt2: t=-2.1340204531, df=16.7857644826, p_raw=0.0478992556,
 *                    meanDiff(ctrl-trt2)=-0.494
 *      trt1 vs trt2: t=-3.0100985421, df=14.1035691228, p_raw=0.0092984047,
 *                    meanDiff(trt1-trt2)=-0.865
 *
 *  - Holm-Bonferroni-adjusted p-values across those 3 raw p-values, via R's
 *    `pairwise.t.test(PlantGrowth$weight, PlantGrowth$group, p.adjust.method
 *    = "holm", pool.sd = FALSE)` (pool.sd = FALSE makes R use per-pair Welch
 *    t-tests, matching Rigor's own pairwise method) and independently via
 *    `p.adjust(c(0.2503825086, 0.0478992556, 0.0092984047), method =
 *    "holm")`, both giving the same result:
 *      ctrl vs trt1: 0.25038251
 *      ctrl vs trt2: 0.09579851
 *      trt1 vs trt2: 0.02789521
 *
 *  - Hedges' g per pair: hand-computed from the published mean/sd/n values
 *    above using the documented pooled-SD + small-sample-correction formula
 *    (see `two_group.py`'s `_hedges_g` docstring), independently of this
 *    codebase:
 *      ctrl vs trt1: g ~= 0.5102373665
 *      ctrl vs trt2: g ~= -0.9140377642
 *      trt1 vs trt2: g ~= -1.2892771190
 *
 * Tolerances: full-precision R cross-checks use tight tolerances (~1e-4 to
 * 1e-6); the one deliberately-rounded published-textbook cross-check
 * (classic ANOVA F/p, shown only in comments above for context) is not
 * separately asserted here since Rigor never reports it.
 */
import { loadPyodide } from 'pyodide'
import type { PyodideInterface } from 'pyodide'
import { beforeAll, describe, expect, it } from 'vitest'

import { installStatisticsPython, runAnalysis } from './engine'
import type { OneWayAnovaResult, StatisticsRequest } from './types'
import { formatPValue } from '../features/report/formatPValue'

let pyodide: PyodideInterface

beforeAll(async () => {
  pyodide = await loadPyodide()
  await pyodide.loadPackage(['numpy', 'scipy'])
  installStatisticsPython(pyodide)
}, 120_000)

function expectSuccess<T>(response: ReturnType<typeof runAnalysis>): T {
  if (!response.success) {
    throw new Error(`expected success, got error: ${response.error.message}`)
  }
  return response.result.result as T
}

const CTRL = [4.17, 5.58, 5.18, 6.11, 4.5, 4.61, 5.17, 4.53, 5.33, 5.14]
const TRT1 = [4.81, 4.17, 4.41, 3.59, 5.87, 3.83, 6.03, 4.89, 4.32, 4.69]
const TRT2 = [6.31, 5.12, 5.54, 5.5, 5.37, 5.29, 4.92, 6.15, 5.8, 5.26]

function buildRequest(): StatisticsRequest {
  return {
    id: 'anova-golden',
    analysisType: 'one-way-anova',
    payload: {
      groups: [
        { label: 'ctrl', values: CTRL },
        { label: 'trt1', values: TRT1 },
        { label: 'trt2', values: TRT2 },
      ],
    },
  }
}

function findPair(
  result: OneWayAnovaResult,
  a: string,
  b: string,
): OneWayAnovaResult['pairwiseComparisons'][number] {
  const pair = result.pairwiseComparisons.find(
    (p) => p.groupALabel === a && p.groupBLabel === b,
  )
  if (!pair) throw new Error(`no pairwise comparison found for ${a} vs ${b}`)
  return pair
}

describe('one-way ANOVA - golden values (R PlantGrowth dataset)', () => {
  it('per-group descriptives match R mean()/sd()', () => {
    const result = expectSuccess<OneWayAnovaResult>(runAnalysis(pyodide, buildRequest()))
    expect(result.groups).toHaveLength(3)

    const ctrl = result.groups.find((g) => g.label === 'ctrl')
    const trt1 = result.groups.find((g) => g.label === 'trt1')
    const trt2 = result.groups.find((g) => g.label === 'trt2')

    expect(ctrl?.n).toBe(10)
    expect(ctrl?.mean).toBeCloseTo(5.032, 9)
    expect(ctrl?.sd as number).toBeCloseTo(0.5830913784, 6)

    expect(trt1?.n).toBe(10)
    expect(trt1?.mean).toBeCloseTo(4.661, 9)
    expect(trt1?.sd as number).toBeCloseTo(0.7936756964, 6)

    expect(trt2?.n).toBe(10)
    expect(trt2?.mean).toBeCloseTo(5.526, 9)
    expect(trt2?.sd as number).toBeCloseTo(0.4425732833, 6)
  })

  it("matches R's oneway.test(weight ~ group, data = PlantGrowth) (Welch, the default)", () => {
    const result = expectSuccess<OneWayAnovaResult>(runAnalysis(pyodide, buildRequest()))
    expect(result.omnibus.method).toBe('welch_anova')
    expect(result.omnibus.fStatistic).toBeCloseTo(5.1809724081, 6)
    expect(result.omnibus.numeratorDf).toBe(2)
    expect(result.omnibus.denominatorDf).toBeCloseTo(17.1284186166, 5)
    expect(result.omnibus.pValue).toBeCloseTo(0.0173928215, 6)

    // Sanity: this must NOT equal the classic equal-variance ANOVA's F
    // (4.8460878624) - if it did, `_welch_anova` would be silently computing
    // the wrong formula.
    expect(result.omnibus.fStatistic).not.toBeCloseTo(4.8460878624, 2)
  })

  it("matches R's pairwise Welch t-tests (t/df/raw p/mean difference) for every pair", () => {
    const result = expectSuccess<OneWayAnovaResult>(runAnalysis(pyodide, buildRequest()))
    expect(result.pairwiseComparisons).toHaveLength(3)

    const ctrlTrt1 = findPair(result, 'ctrl', 'trt1')
    expect(ctrlTrt1.tStatistic).toBeCloseTo(1.1912603818, 5)
    expect(ctrlTrt1.degreesOfFreedom).toBeCloseTo(16.5235850569, 4)
    expect(ctrlTrt1.pValueRaw).toBeCloseTo(0.2503825086, 6)
    expect(ctrlTrt1.meanDifference).toBeCloseTo(0.371, 6)
    expect(ctrlTrt1.effectSize as number).toBeCloseTo(0.5102373665, 4)

    const ctrlTrt2 = findPair(result, 'ctrl', 'trt2')
    expect(ctrlTrt2.tStatistic).toBeCloseTo(-2.1340204531, 5)
    expect(ctrlTrt2.degreesOfFreedom).toBeCloseTo(16.7857644826, 4)
    expect(ctrlTrt2.pValueRaw).toBeCloseTo(0.0478992556, 6)
    expect(ctrlTrt2.meanDifference).toBeCloseTo(-0.494, 6)
    expect(ctrlTrt2.effectSize as number).toBeCloseTo(-0.9140377642, 4)

    const trt1Trt2 = findPair(result, 'trt1', 'trt2')
    expect(trt1Trt2.tStatistic).toBeCloseTo(-3.0100985421, 5)
    expect(trt1Trt2.degreesOfFreedom).toBeCloseTo(14.1035691228, 4)
    expect(trt1Trt2.pValueRaw).toBeCloseTo(0.0092984047, 6)
    expect(trt1Trt2.meanDifference).toBeCloseTo(-0.865, 6)
    expect(trt1Trt2.effectSize as number).toBeCloseTo(-1.2892771190, 4)
  })

  it(
    "matches R's pairwise.t.test(..., p.adjust.method = 'holm', pool.sd = FALSE) " +
      'Holm-Bonferroni-adjusted p-values',
    () => {
      const result = expectSuccess<OneWayAnovaResult>(runAnalysis(pyodide, buildRequest()))
      expect(result.pairwiseCorrectionMethod).toBe('holm_bonferroni')

      const ctrlTrt1 = findPair(result, 'ctrl', 'trt1')
      const ctrlTrt2 = findPair(result, 'ctrl', 'trt2')
      const trt1Trt2 = findPair(result, 'trt1', 'trt2')

      expect(ctrlTrt1.pValueAdjusted).toBeCloseTo(0.25038251, 5)
      expect(ctrlTrt2.pValueAdjusted).toBeCloseTo(0.09579851, 5)
      expect(trt1Trt2.pValueAdjusted).toBeCloseTo(0.02789521, 5)

      // Holm-Bonferroni only ever makes a p-value larger (or leaves it
      // equal) - never smaller - and every adjusted p-value here must be
      // strictly greater than its own raw p-value except where a smaller
      // neighbor's carried-forward maximum doesn't apply.
      for (const pair of result.pairwiseComparisons) {
        expect(pair.pValueAdjusted).toBeGreaterThanOrEqual(pair.pValueRaw)
      }
    },
  )

  it('never exposes a raw p-value as if it were the adjusted/primary result, and both are formatPValue-safe', () => {
    const result = expectSuccess<OneWayAnovaResult>(runAnalysis(pyodide, buildRequest()))
    for (const pair of result.pairwiseComparisons) {
      expect(pair).toHaveProperty('pValueRaw')
      expect(pair).toHaveProperty('pValueAdjusted')
      // Every p-value this analysis produces must be safe to run through the
      // shared formatter without ever collapsing to "P = 0.000".
      expect(formatPValue(pair.pValueRaw)).not.toBe('P = 0.000')
      expect(formatPValue(pair.pValueAdjusted)).not.toBe('P = 0.000')
    }
    expect(formatPValue(result.omnibus.pValue)).not.toBe('P = 0.000')

    // At least one comparison in this dataset must show a real, non-trivial
    // Holm correction (i.e. adjusted strictly greater than raw) - proving
    // the correction is actually being applied, not a no-op. The Holm
    // step-down procedure always leaves the SINGLE largest raw p-value in a
    // set unchanged (its multiplier is 1) - that's expected, not a bug - but
    // the smaller ones must be inflated.
    const trt1Trt2 = findPair(result, 'trt1', 'trt2')
    expect(trt1Trt2.pValueAdjusted).toBeGreaterThan(trt1Trt2.pValueRaw)
    const ctrlTrt2 = findPair(result, 'ctrl', 'trt2')
    expect(ctrlTrt2.pValueAdjusted).toBeGreaterThan(ctrlTrt2.pValueRaw)
  })
})

describe('one-way ANOVA - validation and edge cases', () => {
  it('rejects fewer than 3 groups', () => {
    const request: StatisticsRequest = {
      id: 'anova-2-groups',
      analysisType: 'one-way-anova',
      payload: {
        groups: [
          { label: 'a', values: [1, 2, 3] },
          { label: 'b', values: [4, 5, 6] },
        ],
      },
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toMatch(/at least 3/i)
    }
  })

  it('rejects a group with fewer than 2 values', () => {
    const request: StatisticsRequest = {
      id: 'anova-thin-group',
      analysisType: 'one-way-anova',
      payload: {
        groups: [
          { label: 'a', values: [1, 2, 3] },
          { label: 'b', values: [4, 5, 6] },
          { label: 'c', values: [7] },
        ],
      },
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toMatch(/at least 2/i)
    }
  })

  it('rejects duplicate group labels', () => {
    const request: StatisticsRequest = {
      id: 'anova-dup-labels',
      analysisType: 'one-way-anova',
      payload: {
        groups: [
          { label: 'a', values: [1, 2, 3] },
          { label: 'a', values: [4, 5, 6] },
          { label: 'c', values: [7, 8, 9] },
        ],
      },
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toMatch(/unique/i)
    }
  })

  it('rejects a group with zero variance (undefined Welch weight)', () => {
    const request: StatisticsRequest = {
      id: 'anova-zero-variance',
      analysisType: 'one-way-anova',
      payload: {
        groups: [
          { label: 'a', values: [5, 5, 5, 5] },
          { label: 'b', values: [1, 2, 3, 4] },
          { label: 'c', values: [10, 11, 12, 13] },
        ],
      },
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toMatch(/zero variance/i)
    }
  })

  it('supports more than 3 groups (4 groups -> 6 pairwise comparisons)', () => {
    const request: StatisticsRequest = {
      id: 'anova-4-groups',
      analysisType: 'one-way-anova',
      payload: {
        groups: [
          { label: 'w', values: [1, 2, 3, 2.5] },
          { label: 'x', values: [4, 5, 6, 5.5] },
          { label: 'y', values: [7, 8, 9, 8.5] },
          { label: 'z', values: [2, 3, 4, 3.5] },
        ],
      },
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(true)
    if (response.success) {
      const result = response.result.result as OneWayAnovaResult
      expect(result.groups).toHaveLength(4)
      expect(result.pairwiseComparisons).toHaveLength(6)
      expect(Number.isFinite(result.omnibus.fStatistic)).toBe(true)
      expect(Number.isFinite(result.omnibus.pValue)).toBe(true)
    }
  })
})
