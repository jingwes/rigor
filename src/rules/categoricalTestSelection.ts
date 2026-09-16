/**
 * Milestone 9: deciding chi-square vs Fisher's exact for a groups x
 * outcome-categories contingency table, from the REAL observed data's
 * expected counts.
 *
 * Deliberately separate from `src/rules/analysisRules.ts`: that module
 * reasons only about the `ExperimentDesign` (before any data exists), which
 * is exactly why it defers this decision (see its
 * `CATEGORICAL_TEST_CHOICE_PENDING_WARNING`) - the specific test depends on
 * real cell counts that don't exist at the design stage. This module reasons
 * over the actual expected-counts table the statistics worker computed, and
 * is otherwise pure/dependency-free TypeScript (no React, no Pyodide).
 *
 * Convention used (Cochran's rule, the standard textbook guidance): for a
 * 2x2 table, if any expected cell count under the null of independence is
 * below 5, Fisher's exact test is preferred over chi-square (chi-square's
 * approximation becomes unreliable with small expected counts, while
 * Fisher's exact test is exact regardless of cell size). For a table larger
 * than 2x2, Fisher's exact test is not implemented (see the project's scope
 * decision: Fisher-Freeman-Halton and 2x2-only concepts like odds ratio/risk
 * difference are not generalized here) - chi-square is always used, with a
 * caution noted (informational only - it never blocks the analysis) if any
 * expected count is low.
 */

const EXPECTED_COUNT_THRESHOLD = 5

export type CategoricalTestId = 'chi-square' | 'fishers-exact'

export interface CategoricalTestSelection {
  test: CategoricalTestId
  /** Short, plain-language explanation of why this test was chosen. */
  reason: string
  /**
   * True when one or more expected cell counts were below 5. For a 2x2
   * table this is exactly why Fisher's exact test was chosen (see `test`);
   * for a larger table it's an informational caution only - chi-square is
   * still used regardless.
   */
  hasLowExpectedCounts: boolean
}

function hasLowExpectedCount(expected: number[][]): boolean {
  return expected.some((row) => row.some((cell) => cell < EXPECTED_COUNT_THRESHOLD))
}

/**
 * Selects which test is appropriate for a table, given its EXPECTED counts
 * (as computed by the chi-square test itself - see `ChiSquareTestResult.expected`
 * in `src/statistics/types.ts`). `rows`/`cols` here refer to the expected-
 * counts table's own shape, which always matches the observed table's shape.
 */
export function selectCategoricalTest(
  expected: number[][],
): CategoricalTestSelection {
  const rowCount = expected.length
  const colCount = expected[0]?.length ?? 0
  const is2x2 = rowCount === 2 && colCount === 2
  const lowCounts = hasLowExpectedCount(expected)

  if (!is2x2) {
    return {
      test: 'chi-square',
      hasLowExpectedCounts: lowCounts,
      reason: lowCounts
        ? 'A chi-square test of association was used, as is standard for a table larger than 2x2 ' +
          "(Fisher's exact test does not generalize cleanly beyond 2x2 tables in this version of " +
          'Rigor). One or more expected cell counts are below 5, so the chi-square approximation ' +
          'may be less reliable here - interpret the p-value with some caution.'
        : 'A chi-square test of association was used, as is standard for a table larger than 2x2.',
    }
  }

  if (lowCounts) {
    return {
      test: 'fishers-exact',
      hasLowExpectedCounts: true,
      reason:
        "One or more expected cell counts were below 5, so Fisher's exact test was used instead " +
        'of chi-square, which is more reliable with small expected counts.',
    }
  }

  return {
    test: 'chi-square',
    hasLowExpectedCounts: false,
    reason:
      'All expected cell counts were 5 or greater, so a standard chi-square test of association ' +
      'was used.',
  }
}
