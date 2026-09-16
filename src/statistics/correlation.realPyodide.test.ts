// @vitest-environment node
/**
 * The release-blocking numerical verification for Milestone 10's
 * `pearson-correlation-regression` analysis type, following the exact
 * pattern set by `anova.realPyodide.test.ts`/`categorical.realPyodide.test.ts`:
 * a REAL Pyodide interpreter, real NumPy/SciPy loaded via Pyodide's own
 * `loadPackage`, driven through the exact same `engine.ts` code the browser
 * worker runs. Nothing here is mocked.
 *
 * Golden-value dataset: R's built-in `cars` dataset (`speed` vs `dist`), the
 * classic teaching example for simple linear regression, pulled directly
 * from R via `data(cars)`:
 *
 *   speed (n=50): 4,4,7,7,8,9,10,10,10,11,11,12,12,12,12,13,13,13,13,14,14,
 *     14,14,15,15,15,16,16,17,17,17,18,18,18,18,19,19,19,20,20,20,20,20,22,
 *     23,24,24,24,24,25
 *   dist  (n=50): 2,10,4,22,16,10,18,26,34,17,28,14,20,24,28,26,34,34,46,26,
 *     36,60,80,20,26,54,32,40,32,40,50,42,56,76,84,36,46,68,32,48,52,56,64,
 *     66,54,70,92,93,120,85
 *
 * All expected values below were computed independently by running this
 * exact raw data through R (a mature, independent implementation, NOT
 * SciPy) on the machine that wrote this test (`Rscript`, R's `stats`
 * package) - never invented by running our own code and asserting
 * self-consistency:
 *
 *  - Pearson correlation, via `cor.test(cars$speed, cars$dist)`:
 *      r = 0.8068949007, t = 9.4639899903, df = 48,
 *      p-value = 1.48983649629515e-12,
 *      95% CI (Fisher z, R's own default): [0.6816422221, 0.8862036285]
 *
 *    The Fisher-z CI was independently hand-verified (not just trusted from
 *    R's own report) by reconstructing it directly from r and n:
 *      z = atanh(r) = 1.1180652650, se_z = 1/sqrt(n-3) = 0.1458649915,
 *      z_crit = qnorm(0.975) = 1.9599639845
 *      CI = tanh(z -/+ z_crit*se_z) = [0.6816422221, 0.8862036285]
 *    - an exact match to R's own reported CI, confirming both R's formula
 *      and this project's chosen formula (Fisher z) are the same thing.
 *
 *  - Simple linear regression, via `lm(dist ~ speed, data = cars)`:
 *      intercept = -17.5790948905 (SE 6.7584401694)
 *      slope     =   3.9324087591 (SE 0.4155127767)
 *      slope t = 9.4639899903, p-value = 1.48983649629509e-12
 *        (identical, up to floating-point noise, to the correlation
 *        p-value above - expected for simple linear regression, both test
 *        the same null hypothesis)
 *      R-squared = 0.6510793808
 *      95% CI (`confint(fit)`):
 *        intercept: [-31.167849602, -3.990340179]
 *        slope:     [3.096964328, 4.767853190]
 *
 *    The slope/intercept CIs were independently hand-verified by
 *    reconstructing them from the reported estimate/SE and R's own
 *    `qt(0.975, 48) = 2.0106347576` critical value - both reconstructions
 *    matched R's `confint()` output exactly, confirming this project's
 *    slope-CI formula (estimate +/- t_crit * SE) is correct.
 *
 * Tolerances below use ~1e-4 to 1e-9 depending on how many digits R printed/
 * how much floating-point noise accumulates through the two independent
 * paths (R vs SciPy) - the p-value is astronomically small, so it is only
 * asserted to be below a tiny threshold and to format as "P < 0.001" rather
 * than compared digit-for-digit.
 */
import { loadPyodide } from 'pyodide'
import type { PyodideInterface } from 'pyodide'
import { beforeAll, describe, expect, it } from 'vitest'

import { installStatisticsPython, runAnalysis } from './engine'
import type { PearsonCorrelationRegressionResult, StatisticsRequest } from './types'
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

const SPEED = [
  4, 4, 7, 7, 8, 9, 10, 10, 10, 11, 11, 12, 12, 12, 12, 13, 13, 13, 13, 14, 14, 14, 14, 15, 15, 15,
  16, 16, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 20, 20, 20, 20, 20, 22, 23, 24, 24, 24, 24, 25,
]

const DIST = [
  2, 10, 4, 22, 16, 10, 18, 26, 34, 17, 28, 14, 20, 24, 28, 26, 34, 34, 46, 26, 36, 60, 80, 20, 26,
  54, 32, 40, 32, 40, 50, 42, 56, 76, 84, 36, 46, 68, 32, 48, 52, 56, 64, 66, 54, 70, 92, 93, 120,
  85,
]

function buildRequest(x: number[] = SPEED, y: number[] = DIST): StatisticsRequest {
  return {
    id: 'correlation-golden',
    analysisType: 'pearson-correlation-regression',
    payload: { x, y },
  }
}

describe('Pearson correlation + simple linear regression - golden values (R cars dataset)', () => {
  it("matches R's cor.test(cars$speed, cars$dist) for r, its p-value, and its Fisher-z CI", () => {
    const result = expectSuccess<PearsonCorrelationRegressionResult>(
      runAnalysis(pyodide, buildRequest()),
    )
    expect(result.n).toBe(50)
    expect(result.correlation.r).toBeCloseTo(0.8068949007, 8)
    expect(result.correlation.pValue).toBeLessThan(1e-10)
    expect(result.correlation.ci95Low as number).toBeCloseTo(0.6816422221, 6)
    expect(result.correlation.ci95High as number).toBeCloseTo(0.8862036285, 6)
    expect(formatPValue(result.correlation.pValue)).toBe('P < 0.001')
  })

  it("matches R's lm(dist ~ speed, data = cars) for slope/intercept, their CIs, R-squared, and p-value", () => {
    const result = expectSuccess<PearsonCorrelationRegressionResult>(
      runAnalysis(pyodide, buildRequest()),
    )
    const { regression } = result

    expect(regression.slope).toBeCloseTo(3.9324087591, 8)
    expect(regression.intercept).toBeCloseTo(-17.5790948905, 6)
    expect(regression.slopeCi95Low).toBeCloseTo(3.096964328, 5)
    expect(regression.slopeCi95High).toBeCloseTo(4.767853190, 5)
    expect(regression.rSquared).toBeCloseTo(0.6510793808, 8)
    expect(regression.pValue).toBeLessThan(1e-10)
    expect(formatPValue(regression.pValue)).toBe('P < 0.001')
  })

  it('r-squared equals the correlation coefficient squared (internal consistency, not just an R cross-check)', () => {
    const result = expectSuccess<PearsonCorrelationRegressionResult>(
      runAnalysis(pyodide, buildRequest()),
    )
    expect(result.regression.rSquared).toBeCloseTo(result.correlation.r ** 2, 9)
  })

  it('returns fitted values and residuals consistent with the reported slope/intercept', () => {
    const result = expectSuccess<PearsonCorrelationRegressionResult>(
      runAnalysis(pyodide, buildRequest()),
    )
    const { regression } = result
    expect(regression.fittedValues).toHaveLength(50)
    expect(regression.residuals).toHaveLength(50)

    for (let i = 0; i < SPEED.length; i++) {
      const expectedFitted = regression.slope * SPEED[i] + regression.intercept
      expect(regression.fittedValues[i]).toBeCloseTo(expectedFitted, 6)
      expect(regression.residuals[i]).toBeCloseTo(DIST[i] - expectedFitted, 6)
    }
  })
})

describe('Pearson correlation + simple linear regression - validation and edge cases', () => {
  it('rejects fewer than 3 observations', () => {
    const response = runAnalysis(pyodide, buildRequest([1, 2], [3, 4]))
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toMatch(/at least 3/i)
    }
  })

  it('rejects mismatched-length x/y arrays', () => {
    const response = runAnalysis(pyodide, buildRequest([1, 2, 3], [4, 5]))
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toMatch(/same length/i)
    }
  })

  it('rejects a constant x (undefined correlation/slope)', () => {
    const response = runAnalysis(pyodide, buildRequest([5, 5, 5, 5], [1, 2, 3, 4]))
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toMatch(/x has no variance|identical/i)
    }
  })

  it('rejects a constant y (undefined correlation/slope)', () => {
    const response = runAnalysis(pyodide, buildRequest([1, 2, 3, 4], [7, 7, 7, 7]))
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toMatch(/y has no variance|identical/i)
    }
  })

  it('rejects missing/non-finite values, not silently coerced', () => {
    // NaN/Infinity do not survive JSON.stringify (they become `null`), which
    // is exactly the "already-invalid-in-a-different-way" input this worker
    // must not crash on - see `engine.realPyodide.test.ts`'s identical test
    // for the 2-group payload. The Python side rejects the resulting `null`
    // as non-numeric with a clear error rather than silently treating it as
    // 0 or dropping it.
    const request = {
      id: 'correlation-non-finite',
      analysisType: 'pearson-correlation-regression',
      payload: { x: [1, Number.NaN, 3], y: [4, 5, 6] },
    } as unknown as StatisticsRequest
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toMatch(/numeric/i)
    }
  })

  it('computes r/p-value at n=3 but reports a null CI (Fisher-z SE undefined below n=4)', () => {
    const response = runAnalysis(pyodide, buildRequest([1, 2, 3], [2, 4, 7]))
    expect(response.success).toBe(true)
    if (response.success) {
      const result = response.result.result as PearsonCorrelationRegressionResult
      expect(result.n).toBe(3)
      expect(Number.isFinite(result.correlation.r)).toBe(true)
      expect(Number.isFinite(result.correlation.pValue)).toBe(true)
      expect(result.correlation.ci95Low).toBeNull()
      expect(result.correlation.ci95High).toBeNull()
      // The regression slope's own CI does NOT depend on the Fisher-z
      // formula and remains well-defined at n=3 (df=1).
      expect(Number.isFinite(result.regression.slopeCi95Low)).toBe(true)
      expect(Number.isFinite(result.regression.slopeCi95High)).toBe(true)
    }
  })

  it('reports a real (non-null) CI for r once n >= 4', () => {
    const response = runAnalysis(pyodide, buildRequest([1, 2, 3, 4], [2, 4, 7, 8]))
    expect(response.success).toBe(true)
    if (response.success) {
      const result = response.result.result as PearsonCorrelationRegressionResult
      expect(result.n).toBe(4)
      expect(result.correlation.ci95Low).not.toBeNull()
      expect(result.correlation.ci95High).not.toBeNull()
    }
  })
})
