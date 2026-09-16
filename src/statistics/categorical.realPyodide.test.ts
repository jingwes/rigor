// @vitest-environment node
/**
 * The release-blocking numerical verification for Milestone 9's
 * `chi-square-test`/`fishers-exact-test` analysis types, following the exact
 * pattern set by `engine.realPyodide.test.ts`/`anova.realPyodide.test.ts`: a
 * REAL Pyodide interpreter, real NumPy/SciPy loaded via Pyodide's own
 * `loadPackage`, driven through the exact same `engine.ts` code the browser
 * worker runs. Nothing here is mocked.
 *
 * --- Golden example 1: a 2x2 table -------------------------------------
 * A constructed teaching example - two groups of 30 each, outcome
 * "improved" vs "not improved":
 *
 *   table = [[20, 10],
 *            [10, 20]]   (rows: Group A, Group B; columns: improved, not improved)
 *
 * All expected values below were computed independently via real `Rscript`
 * (R's `stats` package, run on the machine that wrote this test) on this
 * exact table - never invented by running our own code and asserting
 * self-consistency:
 *
 *  - `chisq.test(matrix(c(20,10,10,20), nrow=2, byrow=TRUE))` (R's default,
 *    `correct = TRUE` - Yates' continuity correction, which R (like SciPy's
 *    `chi2_contingency` default) only actually applies for a 2x2 table):
 *      X-squared = 5.4, df = 1, p-value = 0.02013675
 *      expected = [[15, 15], [15, 15]]
 *    (Local Python `scipy.stats.chi2_contingency` on the same table, run
 *    independently on the machine that wrote this test, reproduced these
 *    exact numbers: chi2 = 5.4, p = 0.020136751550346364.)
 *
 *  - Cramer's V = sqrt(chi2 / (n * (min(rows,cols) - 1))) with n = 60, chi2
 *    = 5.4 (the SAME Yates-corrected chi2 above, since Rigor's
 *    `chi_square_test_json` always uses `chi2_contingency`'s default
 *    correction behavior): V = sqrt(5.4 / 60) = 0.3 exactly.
 *
 *  - `fisher.test(matrix(c(20,10,10,20), nrow=2, byrow=TRUE))`:
 *      p-value = 0.01938319
 *    (R reports p = 0.01938319; local `scipy.stats.fisher_exact` on the same
 *    table independently reproduced p = 0.01938318826178997.)
 *    NOTE: R's `fisher.test` odds ratio (3.901234, the conditional MLE) is
 *    NOT the same estimator as SciPy's `fisher_exact` odds ratio (the simple
 *    cross-product ratio a*d/(b*c) = 20*20/(10*10) = 4) - Rigor reports
 *    SciPy's estimator throughout, so only the p-value is cross-checked
 *    against R here; the odds ratio itself is verified below by hand.
 *
 *  - Odds ratio (SciPy convention, a*d/(b*c)): 20*20 / (10*10) = 4 exactly.
 *    Wald 95% CI for the log-odds-ratio (hand-computed, independent of this
 *    codebase): log(4) = 1.3862943611, SE = sqrt(1/20+1/10+1/10+1/20) =
 *    sqrt(0.3) = 0.5477225575, CI = exp(1.3862943611 +/- 1.96*0.5477225575)
 *    = [1.3671910092, 11.7028316568] (cross-checked in R with the same
 *    formula: matches to full precision).
 *
 *  - Risk difference: risk(Group A) = 20/30 = 0.6666666667, risk(Group B) =
 *    10/30 = 0.3333333333, difference = 0.3333333333. Wald 95% CI
 *    (hand-computed/R cross-checked): SE = sqrt(0.6666666667*0.3333333333/30
 *    + 0.3333333333*0.6666666667/30) = 0.1207841568, CI =
 *    [0.0947697260, 0.5718969407].
 *
 * --- Golden example 2: a larger (2x3) table -----------------------------
 * Two groups ("Control" n=30, "Treatment" n=35), three outcome categories
 * ("Mild", "Moderate", "Severe"):
 *
 *   table = [[10, 15, 5],
 *            [20, 10, 5]]
 *
 * Verified via real `Rscript`'s `chisq.test(tbl, correct = FALSE)` (no
 * Yates correction - it never applies to a table this shape regardless of
 * the `correct` argument, since SciPy/R only apply it when df == 1):
 *   X-squared = 3.9722222, df = 2, p-value = 0.1372281
 *   expected = [[13.84615385, 11.53846154, 4.61538462],
 *               [16.15385, 13.46154, 5.38461538]]
 * (R raises its own "Chi-squared approximation may be incorrect" warning
 * here because two expected cells are below 5 - exactly the low-expected-
 * count situation `categoricalTestSelection.ts` flags as a caution for
 * tables larger than 2x2, where chi-square is still used regardless.)
 *
 * Cramer's V = sqrt(3.9722222 / (65 * (min(2,3) - 1))) = sqrt(3.9722222/65)
 * = 0.2472066 (hand-computed/R cross-checked).
 *
 * Fisher's exact test is intentionally NOT run on this table - it is 2x3,
 * not 2x2, and this version of Rigor deliberately does not implement
 * Fisher-Freeman-Halton or generalize odds ratio/risk difference beyond
 * 2x2 (see `fishers_exact_test_json`'s 2x2-only validation, asserted below).
 *
 * Tolerances: full-precision R/hand cross-checks use tight tolerances
 * (~1e-4 to 1e-9).
 */
import { loadPyodide } from 'pyodide'
import type { PyodideInterface } from 'pyodide'
import { beforeAll, describe, expect, it } from 'vitest'

import { installStatisticsPython, runAnalysis } from './engine'
import type {
  ChiSquareTestResult,
  FishersExactTestResult,
  StatisticsRequest,
} from './types'
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

const TABLE_2X2 = [
  [20, 10],
  [10, 20],
]

const TABLE_2X3 = [
  [10, 15, 5],
  [20, 10, 5],
]

function chiSquareRequest(table: number[][]): StatisticsRequest {
  return { id: 'chi2-golden', analysisType: 'chi-square-test', payload: { table } }
}

function fishersRequest(table: number[][]): StatisticsRequest {
  return { id: 'fisher-golden', analysisType: 'fishers-exact-test', payload: { table } }
}

describe('chi-square test - golden values (2x2)', () => {
  it("matches R's chisq.test(..., correct = TRUE) (the default, Yates-corrected for 2x2)", () => {
    const result = expectSuccess<ChiSquareTestResult>(
      runAnalysis(pyodide, chiSquareRequest(TABLE_2X2)),
    )
    expect(result.chiSquare).toBeCloseTo(5.4, 6)
    expect(result.degreesOfFreedom).toBe(1)
    expect(result.pValue).toBeCloseTo(0.02013675, 6)
    expect(result.n).toBe(60)
    expect(result.observed).toEqual(TABLE_2X2)
    expect(result.expected).toEqual([
      [15, 15],
      [15, 15],
    ])
  })

  it("Cramer's V matches the hand-computed value from the SAME (Yates-corrected) chi-square", () => {
    const result = expectSuccess<ChiSquareTestResult>(
      runAnalysis(pyodide, chiSquareRequest(TABLE_2X2)),
    )
    expect(result.cramersV).toBeCloseTo(0.3, 6)
  })
})

describe("Fisher's exact test - golden values (2x2)", () => {
  it("p-value matches R's fisher.test", () => {
    const result = expectSuccess<FishersExactTestResult>(
      runAnalysis(pyodide, fishersRequest(TABLE_2X2)),
    )
    expect(result.pValue).toBeCloseTo(0.01938319, 6)
  })

  it("odds ratio matches SciPy's convention (a*d/(b*c) = 4), not R's conditional MLE (3.901234)", () => {
    const result = expectSuccess<FishersExactTestResult>(
      runAnalysis(pyodide, fishersRequest(TABLE_2X2)),
    )
    expect(result.oddsRatio).toBeCloseTo(4, 9)
    expect(result.oddsRatio).not.toBeCloseTo(3.901234, 3)
  })

  it('odds ratio 95% CI matches the hand-computed Wald log-odds-ratio CI', () => {
    const result = expectSuccess<FishersExactTestResult>(
      runAnalysis(pyodide, fishersRequest(TABLE_2X2)),
    )
    expect(result.oddsRatioCi95Low as number).toBeCloseTo(1.3671910092, 4)
    expect(result.oddsRatioCi95High as number).toBeCloseTo(11.7028316568, 4)
  })

  it('risk difference and its 95% CI match the hand-computed Wald difference-of-proportions CI', () => {
    const result = expectSuccess<FishersExactTestResult>(
      runAnalysis(pyodide, fishersRequest(TABLE_2X2)),
    )
    expect(result.riskDifference).toBeCloseTo(0.3333333333, 6)
    expect(result.riskDifferenceCi95Low).toBeCloseTo(0.094769726, 4)
    expect(result.riskDifferenceCi95High).toBeCloseTo(0.5718969407, 4)
  })

  it('rejects a table that is not 2x2', () => {
    const response = runAnalysis(pyodide, fishersRequest(TABLE_2X3))
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toMatch(/2x2/i)
    }
  })
})

describe('chi-square test - golden values (larger, 2x3 table)', () => {
  it("matches R's chisq.test(tbl, correct = FALSE) (no Yates correction applies for a non-2x2 table)", () => {
    const result = expectSuccess<ChiSquareTestResult>(
      runAnalysis(pyodide, chiSquareRequest(TABLE_2X3)),
    )
    expect(result.chiSquare).toBeCloseTo(3.9722222, 5)
    expect(result.degreesOfFreedom).toBe(2)
    expect(result.pValue).toBeCloseTo(0.1372281, 5)
    expect(result.n).toBe(65)

    const expected = result.expected
    expect(expected[0][0]).toBeCloseTo(13.84615385, 4)
    expect(expected[0][1]).toBeCloseTo(11.53846154, 4)
    expect(expected[0][2]).toBeCloseTo(4.61538462, 4)
    expect(expected[1][0]).toBeCloseTo(16.15384615, 4)
    expect(expected[1][1]).toBeCloseTo(13.46153846, 4)
    expect(expected[1][2]).toBeCloseTo(5.38461538, 4)
  })

  it("Cramer's V matches the hand-computed value for a non-2x2 table (min(rows,cols) = 2)", () => {
    const result = expectSuccess<ChiSquareTestResult>(
      runAnalysis(pyodide, chiSquareRequest(TABLE_2X3)),
    )
    expect(result.cramersV).toBeCloseTo(0.2472066, 5)
  })
})

describe('categorical analyses - validation and edge cases', () => {
  it('rejects a table with fewer than 2 rows', () => {
    const response = runAnalysis(pyodide, chiSquareRequest([[10, 20]]))
    expect(response.success).toBe(false)
  })

  it('rejects a table with a zero-total row', () => {
    const response = runAnalysis(
      pyodide,
      chiSquareRequest([
        [0, 0],
        [5, 10],
      ]),
    )
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toMatch(/row/i)
    }
  })

  it('rejects a table with a zero-total column', () => {
    const response = runAnalysis(
      pyodide,
      chiSquareRequest([
        [0, 5],
        [0, 10],
      ]),
    )
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.message).toMatch(/column/i)
    }
  })

  it('rejects non-integer counts', () => {
    const response = runAnalysis(
      pyodide,
      chiSquareRequest([
        [1.5, 2],
        [3, 4],
      ]),
    )
    expect(response.success).toBe(false)
  })

  it('rejects negative counts', () => {
    const response = runAnalysis(
      pyodide,
      chiSquareRequest([
        [-1, 2],
        [3, 4],
      ]),
    )
    expect(response.success).toBe(false)
  })

  it('every p-value produced is formatPValue-safe (never "P = 0.000")', () => {
    const chi2 = expectSuccess<ChiSquareTestResult>(
      runAnalysis(pyodide, chiSquareRequest(TABLE_2X2)),
    )
    const fisher = expectSuccess<FishersExactTestResult>(
      runAnalysis(pyodide, fishersRequest(TABLE_2X2)),
    )
    const chi2Larger = expectSuccess<ChiSquareTestResult>(
      runAnalysis(pyodide, chiSquareRequest(TABLE_2X3)),
    )
    expect(formatPValue(chi2.pValue)).not.toBe('P = 0.000')
    expect(formatPValue(fisher.pValue)).not.toBe('P = 0.000')
    expect(formatPValue(chi2Larger.pValue)).not.toBe('P = 0.000')
  })
})
