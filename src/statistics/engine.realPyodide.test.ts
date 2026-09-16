// @vitest-environment node
/**
 * The release-blocking numerical verification for Milestone 4.
 *
 * This test loads a REAL Pyodide interpreter (via the `pyodide` npm
 * package's Node-compatible loader, pinned to the exact same version the
 * browser worker loads from the CDN - see `PYODIDE_VERSION` below and in
 * `statistics.worker.ts`), loads real NumPy/SciPy into it via Pyodide's own
 * `loadPackage`, and runs the exact same `engine.ts` code the worker runs.
 * Nothing here is mocked or stubbed: if SciPy's `ttest_ind`/`ttest_rel`
 * ever produced a different number, or if our Python wrapper mis-wired an
 * argument, these assertions would catch it.
 *
 * Golden values are taken from independent, published sources and cross-
 * checked against R's own `t.test()` (a mature, independent implementation,
 * NOT SciPy) - never invented by running our own code and asserting
 * self-consistency:
 *
 *  - Welch's two-sample t-test: the built-in R `mtcars` dataset, comparing
 *    `mpg` for automatic (am == 0, n = 19) vs manual (am == 1, n = 13)
 *    transmission cars. This exact comparison is a widely reproduced
 *    textbook/tutorial example (e.g. MetricGate's Welch's t-test guide
 *    reports t(18.33) = -3.77, p = .001 for the same grouping); we pulled
 *    the raw `mpg` values directly from R via `Rscript` and independently
 *    ran `t.test(a, b)` in R to get full-precision expected values:
 *    t = -3.767123145, df = 18.33225164, p = 0.00137363833,
 *    meanA (automatic) = 17.1473684211, meanB (manual) = 24.3923076923,
 *    sdA = 3.83396638556, sdB = 6.16650380935,
 *    95% CI for the mean difference = [-11.28019435504, -3.20968418747].
 *    Hedges' g was then hand-computed from those published mean/SD/n
 *    values using the documented pooled-SD + small-sample-correction
 *    formula (see `two_group.py`'s `_hedges_g` docstring), independently
 *    of this codebase, giving g ~= -1.44068792531.
 *
 *  - Paired t-test: the northern flicker tail-feather "yellowness" data
 *    from Wiebe and Bortolotti (2002), as tabulated in McDonald's
 *    "Handbook of Biological Statistics" (biostathandbook.com/pairedttest.html),
 *    16 birds, typical vs "odd" regrown feather. McDonald's page reports
 *    (from SAS): t = 4.06, df = 15, P = 0.0010, mean difference = 0.137,
 *    SD of differences = 0.135. We independently re-ran the same 16x2 raw
 *    data through R's `t.test(typical, odd, paired = TRUE)` to get
 *    full-precision expected values: t = 4.064652738, df = 15,
 *    p = 0.00101660031, meanDiff = 0.137125, sdDiff = 0.134943877223,
 *    95% CI = [0.0652184835542, 0.2090315164458] - matching McDonald's
 *    rounded published numbers, confirming the transcribed raw data is
 *    correct. Cohen's d_z was then hand-computed as meanDiff / sdDiff,
 *    giving d_z ~= 1.01616318444.
 *
 *  - Descriptives: the worked standard-deviation example from Wikipedia's
 *    "Standard deviation" article, {2, 4, 4, 4, 5, 5, 7, 9}
 *    (mean = 5, sample SD (ddof=1) = 2.1380899353), cross-checked in R
 *    (`sd()`, `quantile(..., type = 7)`, `qt()`) for the median/IQR/CI
 *    fields the Wikipedia article doesn't itself report.
 *
 * Tolerances: sources above are quoted to varying precision, so each
 * assertion uses a tolerance appropriate to its source's precision (as
 * tight as ~1e-6 for the full-precision R cross-checks, looser where a
 * source only published 2-4 significant figures).
 */
import { loadPyodide } from 'pyodide'
import type { PyodideInterface } from 'pyodide'
import { beforeAll, describe, expect, it } from 'vitest'

import { installStatisticsPython, runAnalysis } from './engine'
import type {
  DescriptivesResult,
  PairedTTestResult,
  StatisticsRequest,
  WelchTwoSampleTTestResult,
} from './types'

// Must match the version pinned in `statistics.worker.ts` / package.json.
const PYODIDE_VERSION = '314.0.7'

let pyodide: PyodideInterface

beforeAll(async () => {
  pyodide = await loadPyodide()
  expect(pyodide.version).toBe(PYODIDE_VERSION)
  await pyodide.loadPackage(['numpy', 'scipy'])
  installStatisticsPython(pyodide)
}, 120_000)

function expectSuccess<T>(response: ReturnType<typeof runAnalysis>): T {
  if (!response.success) {
    throw new Error(`expected success, got error: ${response.error.message}`)
  }
  return response.result.result as T
}

describe('real Pyodide + SciPy sanity', () => {
  it('reports the pinned NumPy and SciPy versions', () => {
    const versions = pyodide.runPython(`
import json
import numpy
import scipy
json.dumps({"numpy": numpy.__version__, "scipy": scipy.__version__})
`) as string
    expect(JSON.parse(versions)).toEqual({ numpy: '2.4.6', scipy: '1.18.0' })
  })
})

describe('descriptives - golden values (Wikipedia "Standard deviation" example)', () => {
  it('matches the published mean/SD and an independent R cross-check', () => {
    const request: StatisticsRequest = {
      id: 'descriptives-golden',
      analysisType: 'descriptives',
      payload: { values: [2, 4, 4, 4, 5, 5, 7, 9] },
    }
    const result = expectSuccess<DescriptivesResult>(
      runAnalysis(pyodide, request),
    )

    expect(result.n).toBe(8)
    expect(result.mean).toBeCloseTo(5, 9)
    expect(result.median).toBeCloseTo(4.5, 9)
    expect(result.sd).not.toBeNull()
    expect(result.sd as number).toBeCloseTo(2.1380899353, 9)
    expect(result.q1).toBeCloseTo(4, 9)
    expect(result.q3).toBeCloseTo(5.5, 9)
    expect(result.iqr).toBeCloseTo(1.5, 9)
    expect(result.min).toBe(2)
    expect(result.max).toBe(9)
    expect(result.ci95Low).not.toBeNull()
    expect(result.ci95High).not.toBeNull()
    expect(result.ci95Low as number).toBeCloseTo(3.21251208176, 6)
    expect(result.ci95High as number).toBeCloseTo(6.78748791824, 6)
  })

  it('n = 1: mean/median/min/max are defined, SD and CI are null (documented)', () => {
    const request: StatisticsRequest = {
      id: 'descriptives-n1',
      analysisType: 'descriptives',
      payload: { values: [42] },
    }
    const result = expectSuccess<DescriptivesResult>(
      runAnalysis(pyodide, request),
    )
    expect(result.n).toBe(1)
    expect(result.mean).toBe(42)
    expect(result.median).toBe(42)
    expect(result.sd).toBeNull()
    expect(result.ci95Low).toBeNull()
    expect(result.ci95High).toBeNull()
  })

  it('rejects an empty array', () => {
    const request: StatisticsRequest = {
      id: 'descriptives-empty',
      analysisType: 'descriptives',
      payload: { values: [] },
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(false)
  })
})

// mtcars: mpg by transmission type (am 0 = automatic, am 1 = manual).
// Raw values pulled directly from R's built-in `mtcars` dataset.
const MTCARS_AUTOMATIC_MPG = [
  21.4, 18.7, 18.1, 14.3, 24.4, 22.8, 19.2, 17.8, 16.4, 17.3, 15.2, 10.4, 10.4,
  14.7, 21.5, 15.5, 15.2, 13.3, 19.2,
]
const MTCARS_MANUAL_MPG = [
  21, 21, 22.8, 32.4, 30.4, 33.9, 27.3, 26, 30.4, 15.8, 19.7, 15, 21.4,
]

describe("Welch's two-sample t-test - golden values (R mtcars mpg ~ am)", () => {
  it('matches R t.test(automatic, manual) to high precision', () => {
    const request: StatisticsRequest = {
      id: 'welch-golden',
      analysisType: 'welch-two-sample-t-test',
      payload: { a: MTCARS_AUTOMATIC_MPG, b: MTCARS_MANUAL_MPG },
    }
    const result = expectSuccess<WelchTwoSampleTTestResult>(
      runAnalysis(pyodide, request),
    )

    expect(result.nA).toBe(19)
    expect(result.nB).toBe(13)
    expect(result.meanA).toBeCloseTo(17.1473684211, 6)
    expect(result.meanB).toBeCloseTo(24.3923076923, 6)
    expect(result.sdA as number).toBeCloseTo(3.83396638556, 6)
    expect(result.sdB as number).toBeCloseTo(6.16650380935, 6)
    expect(result.meanDifference).toBeCloseTo(-7.24493927126, 6)
    expect(result.tStatistic).toBeCloseTo(-3.767123145, 5)
    expect(result.degreesOfFreedom).toBeCloseTo(18.33225164, 4)
    expect(result.pValue).toBeCloseTo(0.00137363833, 6)
    expect(result.meanDifferenceCi95Low).toBeCloseTo(-11.28019435504, 4)
    expect(result.meanDifferenceCi95High).toBeCloseTo(-3.20968418747, 4)
    expect(result.effectSizeMethod).toBe('hedges_g')
    expect(result.effectSize as number).toBeCloseTo(-1.44068792531, 4)
  })
})

describe('paired t-test - golden values (Wiebe & Bortolotti 2002 feather data)', () => {
  const typical = [
    -0.255, -0.213, -0.19, -0.185, -0.045, -0.025, -0.015, 0.003, 0.015, 0.02,
    0.023, 0.04, 0.04, 0.05, 0.055, 0.058,
  ]
  const odd = [
    -0.324, -0.185, -0.299, -0.144, -0.027, -0.039, -0.264, -0.077, -0.017,
    -0.169, -0.096, -0.33, -0.346, -0.191, -0.128, -0.182,
  ]

  it('matches R t.test(typical, odd, paired = TRUE) to high precision', () => {
    const request: StatisticsRequest = {
      id: 'paired-golden',
      analysisType: 'paired-t-test',
      payload: { a: typical, b: odd },
    }
    const result = expectSuccess<PairedTTestResult>(
      runAnalysis(pyodide, request),
    )

    expect(result.nPairs).toBe(16)
    expect(result.meanDifference).toBeCloseTo(0.137125, 6)
    expect(result.sdDifference).toBeCloseTo(0.134943877223, 6)
    expect(result.tStatistic).toBeCloseTo(4.064652738, 5)
    expect(result.degreesOfFreedom).toBe(15)
    expect(result.pValue).toBeCloseTo(0.00101660031, 5)
    expect(result.meanDifferenceCi95Low).toBeCloseTo(0.0652184835542, 4)
    expect(result.meanDifferenceCi95High).toBeCloseTo(0.2090315164458, 4)
    expect(result.effectSizeMethod).toBe('cohens_d_z')
    expect(result.effectSize as number).toBeCloseTo(1.01616318444, 4)
  })

  // Also matches the rounded numbers McDonald's Handbook of Biological
  // Statistics published directly from SAS output (t=4.06, df=15, P=0.0010),
  // confirming the raw data above was transcribed correctly.
  it('also matches the published SAS-derived summary values', () => {
    const request: StatisticsRequest = {
      id: 'paired-golden-published',
      analysisType: 'paired-t-test',
      payload: { a: typical, b: odd },
    }
    const result = expectSuccess<PairedTTestResult>(
      runAnalysis(pyodide, request),
    )
    expect(result.tStatistic).toBeCloseTo(4.06, 2)
    expect(result.degreesOfFreedom).toBe(15)
    expect(result.pValue).toBeCloseTo(0.001, 3)
    expect(result.meanDifference).toBeCloseTo(0.137, 3)
  })
})

describe('Section 47 edge cases', () => {
  it('n = 1 per group is rejected for Welch (variance is undefined)', () => {
    const request: StatisticsRequest = {
      id: 'welch-n1',
      analysisType: 'welch-two-sample-t-test',
      payload: { a: [5], b: [1, 2, 3] },
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toMatch(/at least 2/i)
    }
  })

  it('n = 2 per group is handled correctly for Welch', () => {
    const request: StatisticsRequest = {
      id: 'welch-n2',
      analysisType: 'welch-two-sample-t-test',
      payload: { a: [1, 2], b: [10, 12] },
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(true)
    if (response.success) {
      const result = response.result.result as WelchTwoSampleTTestResult
      expect(result.nA).toBe(2)
      expect(result.nB).toBe(2)
      expect(Number.isFinite(result.tStatistic)).toBe(true)
      expect(Number.isFinite(result.pValue)).toBe(true)
    }
  })

  it('a single pair (n = 1) is rejected for the paired test', () => {
    const request: StatisticsRequest = {
      id: 'paired-n1',
      analysisType: 'paired-t-test',
      payload: { a: [5], b: [7] },
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(false)
  })

  it('zero variance in BOTH groups (identical constants) is a clear error, not NaN', () => {
    const request: StatisticsRequest = {
      id: 'welch-zero-variance-both',
      analysisType: 'welch-two-sample-t-test',
      payload: { a: [5, 5, 5], b: [5, 5, 5] },
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toMatch(/zero variance/i)
    }
  })

  it('zero variance in only ONE group still computes a valid result', () => {
    const request: StatisticsRequest = {
      id: 'welch-zero-variance-one',
      analysisType: 'welch-two-sample-t-test',
      payload: { a: [5, 5, 5, 5], b: [1, 2, 3, 4] },
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(true)
    if (response.success) {
      const result = response.result.result as WelchTwoSampleTTestResult
      expect(Number.isFinite(result.tStatistic)).toBe(true)
      expect(Number.isFinite(result.pValue)).toBe(true)
    }
  })

  it('zero-variance paired differences (identical differences) is a clear error', () => {
    const request: StatisticsRequest = {
      id: 'paired-zero-variance',
      analysisType: 'paired-t-test',
      payload: { a: [1, 2, 3], b: [0, 1, 2] }, // every difference is exactly 1
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toMatch(/zero variance/i)
    }
  })

  it('extremely unequal group sizes still compute a valid Welch result', () => {
    const small = [10, 12]
    const large = Array.from({ length: 200 }, (_, i) => 9 + (i % 5) * 0.1)
    const request: StatisticsRequest = {
      id: 'welch-unequal-sizes',
      analysisType: 'welch-two-sample-t-test',
      payload: { a: small, b: large },
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(true)
    if (response.success) {
      const result = response.result.result as WelchTwoSampleTTestResult
      expect(result.nA).toBe(2)
      expect(result.nB).toBe(200)
      expect(Number.isFinite(result.tStatistic)).toBe(true)
    }
  })

  it('missing/non-finite values are rejected before reaching SciPy, not silently coerced', () => {
    // NaN/Infinity do not survive JSON.stringify (they become `null`), which
    // is exactly the "already-invalid-in-a-different-way" input this worker
    // must not crash on: the Python side rejects the resulting `null` as
    // non-numeric with a clear error rather than silently treating it as 0
    // or dropping it.
    const request = {
      id: 'welch-non-finite',
      analysisType: 'welch-two-sample-t-test',
      payload: { a: [1, Number.NaN, 3], b: [4, 5, 6] },
    } as unknown as StatisticsRequest
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toMatch(/numeric/i)
    }
  })

  it('unequal-length arrays are rejected for the paired test', () => {
    const request: StatisticsRequest = {
      id: 'paired-unequal-length',
      analysisType: 'paired-t-test',
      payload: { a: [1, 2, 3], b: [1, 2] },
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toMatch(/equal-length/i)
    }
  })

  it('identical groups: mean difference exactly 0, p-value near 1', () => {
    const request: StatisticsRequest = {
      id: 'welch-identical-groups',
      analysisType: 'welch-two-sample-t-test',
      payload: { a: [1, 2, 3, 4, 5], b: [1, 2, 3, 4, 5] },
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(true)
    if (response.success) {
      const result = response.result.result as WelchTwoSampleTTestResult
      expect(result.meanDifference).toBe(0)
      expect(result.tStatistic).toBeCloseTo(0, 9)
      expect(result.pValue).toBeCloseTo(1, 9)
    }
  })

  it('extremely large and extremely small values do not overflow/underflow', () => {
    const request: StatisticsRequest = {
      id: 'welch-large-small',
      analysisType: 'welch-two-sample-t-test',
      payload: {
        a: [1e15, 1.0001e15, 1.0002e15, 0.9999e15],
        b: [1e-15, 1.0001e-15, 1.0002e-15, 0.9999e-15],
      },
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(true)
    if (response.success) {
      const result = response.result.result as WelchTwoSampleTTestResult
      expect(Number.isFinite(result.tStatistic)).toBe(true)
      expect(Number.isFinite(result.pValue)).toBe(true)
      expect(Number.isFinite(result.meanDifference)).toBe(true)
    }
  })

  it('near-perfect separation between groups gives a large |t| and tiny p-value', () => {
    const request: StatisticsRequest = {
      id: 'welch-perfect-separation',
      analysisType: 'welch-two-sample-t-test',
      payload: { a: [100, 101, 102, 100.5], b: [1, 2, 3, 1.5] },
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(true)
    if (response.success) {
      const result = response.result.result as WelchTwoSampleTTestResult
      expect(Math.abs(result.tStatistic)).toBeGreaterThan(20)
      expect(result.pValue).toBeLessThan(1e-6)
    }
  })
})
