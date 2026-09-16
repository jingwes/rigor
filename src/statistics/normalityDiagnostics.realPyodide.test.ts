// @vitest-environment node
/**
 * The release-blocking numerical verification for Milestone 6's
 * `normality-diagnostics` analysis type, following the exact pattern set by
 * `engine.realPyodide.test.ts`: a REAL Pyodide interpreter, real NumPy/SciPy
 * loaded via Pyodide's own `loadPackage`, driven through the exact same
 * `engine.ts` code the browser worker runs. Nothing here is mocked.
 *
 * Golden values are taken from an independent, mature implementation (R's
 * `shapiro.test()`), NOT SciPy, and R's skewness was hand-computed from the
 * adjusted Fisher-Pearson formula (the same formula `scipy.stats.skew(...,
 * bias=False)` documents using) rather than by re-running our own code:
 *
 *  - Sample 1: the same `mtcars` automatic-transmission `mpg` values
 *    (n = 19) already used as the Welch's-t-test golden fixture in
 *    `engine.realPyodide.test.ts` (raw values pulled directly from R).
 *    Independently run through R's `shapiro.test()`:
 *    W = 0.9767742646, p = 0.8987357869. Skewness (adjusted Fisher-Pearson,
 *    computed by hand from the raw values in R) = 0.0164577959.
 *
 *  - Sample 2: the Wikipedia "Standard deviation" worked example
 *    {2, 4, 4, 4, 5, 5, 7, 9} (n = 8), also already used as the
 *    `descriptives` golden fixture. Independently run through R's
 *    `shapiro.test()`: W = 0.9166338307, p = 0.4031496113. Skewness
 *    (adjusted Fisher-Pearson, by hand in R) = 0.8184875534.
 *
 * This module never lets a normality p-value influence which test is run -
 * see `src/rules/analysisRules.ts` (Milestone 2), which decides that from
 * the experiment design alone, before any data exists. These tests only
 * check that the diagnostic NUMBERS returned here are correct.
 */
import { loadPyodide } from 'pyodide'
import type { PyodideInterface } from 'pyodide'
import { beforeAll, describe, expect, it } from 'vitest'

import { installStatisticsPython, runAnalysis } from './engine'
import type { NormalityDiagnosticsResult, StatisticsRequest } from './types'

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

const MTCARS_AUTOMATIC_MPG = [
  21.4, 18.7, 18.1, 14.3, 24.4, 22.8, 19.2, 17.8, 16.4, 17.3, 15.2, 10.4, 10.4,
  14.7, 21.5, 15.5, 15.2, 13.3, 19.2,
]

describe('normality-diagnostics - golden values (R shapiro.test, independent of SciPy)', () => {
  it('matches R shapiro.test(mtcars automatic mpg) and hand-computed skewness', () => {
    const request: StatisticsRequest = {
      id: 'normality-mtcars',
      analysisType: 'normality-diagnostics',
      payload: { values: MTCARS_AUTOMATIC_MPG },
    }
    const result = expectSuccess<NormalityDiagnosticsResult>(
      runAnalysis(pyodide, request),
    )

    expect(result.n).toBe(19)
    expect(result.shapiroWilkW as number).toBeCloseTo(0.9767742646, 5)
    expect(result.shapiroWilkPValue as number).toBeCloseTo(0.8987357869, 4)
    expect(result.skewness as number).toBeCloseTo(0.0164577959, 4)
  })

  it("matches R shapiro.test on Wikipedia's standard-deviation example", () => {
    const request: StatisticsRequest = {
      id: 'normality-wikipedia-sd',
      analysisType: 'normality-diagnostics',
      payload: { values: [2, 4, 4, 4, 5, 5, 7, 9] },
    }
    const result = expectSuccess<NormalityDiagnosticsResult>(
      runAnalysis(pyodide, request),
    )

    expect(result.n).toBe(8)
    expect(result.shapiroWilkW as number).toBeCloseTo(0.9166338307, 5)
    expect(result.shapiroWilkPValue as number).toBeCloseTo(0.4031496113, 4)
    expect(result.skewness as number).toBeCloseTo(0.8184875534, 4)
  })

  it('n < 3: W/p/skewness are null (undefined below scipy.stats.shapiro\'s minimum), not fabricated', () => {
    const request: StatisticsRequest = {
      id: 'normality-n2',
      analysisType: 'normality-diagnostics',
      payload: { values: [1, 2] },
    }
    const result = expectSuccess<NormalityDiagnosticsResult>(
      runAnalysis(pyodide, request),
    )
    expect(result.n).toBe(2)
    expect(result.shapiroWilkW).toBeNull()
    expect(result.shapiroWilkPValue).toBeNull()
    expect(result.skewness).toBeNull()
  })

  it('n = 1 is still handled (no crash), with shape statistics null', () => {
    const request: StatisticsRequest = {
      id: 'normality-n1',
      analysisType: 'normality-diagnostics',
      payload: { values: [42] },
    }
    const result = expectSuccess<NormalityDiagnosticsResult>(
      runAnalysis(pyodide, request),
    )
    expect(result.n).toBe(1)
    expect(result.shapiroWilkW).toBeNull()
  })

  it('rejects an empty array rather than crashing', () => {
    const request: StatisticsRequest = {
      id: 'normality-empty',
      analysisType: 'normality-diagnostics',
      payload: { values: [] },
    }
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(false)
  })

  it('rejects non-finite values before they reach SciPy', () => {
    const request = {
      id: 'normality-non-finite',
      analysisType: 'normality-diagnostics',
      payload: { values: [1, Number.NaN, 3] },
    } as unknown as StatisticsRequest
    const response = runAnalysis(pyodide, request)
    expect(response.success).toBe(false)
  })
})
