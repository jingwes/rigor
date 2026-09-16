/**
 * The typed request/response contract for Rigor's statistics worker
 * (Milestone 4). This module has no dependency on Pyodide, React, or the
 * worker itself - it only defines the shapes that cross the boundary.
 *
 * This worker only ever COMPUTES numbers for an analysis its caller has
 * already chosen. Deciding WHICH test applies to a given experiment design
 * is `src/rules/analysisRules.ts`'s job, not this module's - keep the two
 * separate.
 */

// --- Request payloads -----------------------------------------------------

export interface DescriptivesPayload {
  values: number[]
}

export interface WelchTwoSampleTTestPayload {
  /** Group A's observations. */
  a: number[]
  /** Group B's observations. */
  b: number[]
}

export interface PairedTTestPayload {
  /** "Before"/condition-A observations, in subject/pair order. */
  a: number[]
  /** "After"/condition-B observations, in the same subject/pair order as `a`. */
  b: number[]
}

/**
 * Milestone 6: normality diagnostics for a single numeric sample
 * (Shapiro-Wilk + skewness). DISPLAY ONLY - see `NormalityDiagnosticsResult`
 * below. Nothing computed here is ever fed back into which test is chosen;
 * that decision belongs entirely to `src/rules/analysisRules.ts`, made from
 * the experiment design alone, before any data (let alone a normality
 * p-value) exists.
 */
export interface NormalityDiagnosticsPayload {
  values: number[]
}

/**
 * Milestone 8: one-way ANOVA for 3+ independent continuous groups. Each
 * entry is one group's raw observations plus the label the student gave it
 * (the position-based `a`/`b` mapping the 2-group payloads use doesn't scale
 * to N groups, so labels travel with the data here instead).
 */
export interface OneWayAnovaGroupPayload {
  label: string
  values: number[]
}

export interface OneWayAnovaPayload {
  /** 3 or more groups. */
  groups: OneWayAnovaGroupPayload[]
}

/**
 * Milestone 9: a groups x outcome-categories contingency table of raw
 * counts. `table[rowIndex][colIndex]` is the count for that group/category
 * pair - row/column LABELS are not part of this payload (the worker only
 * ever sees counts), so the TypeScript caller (`buildContingencyTable.ts`,
 * `CategoricalResultsView.tsx`) is responsible for zipping the labels back
 * onto `observed`/`expected` in the result, which are returned in the exact
 * same row/column order as `table`.
 */
export interface ContingencyTablePayload {
  /** Rows = groups, columns = outcome categories. At least 2x2. */
  table: number[][]
}

/**
 * Milestone 10: Pearson correlation + simple linear regression between two
 * continuous variables, each assumed to be measured once per independent
 * experimental unit. Unlike every other payload in this file, there is no
 * notion of "groups" here - `x[i]`/`y[i]` are the paired X/Y measurements for
 * the i-th unit. Equal length, n >= 3 (see `correlation.py`).
 */
export interface PearsonCorrelationRegressionPayload {
  x: number[]
  y: number[]
}

/**
 * A request for one of the fixed, predefined analyses this worker exposes.
 * `analysisType` is the sole discriminant; there is no way to pass raw
 * Python through this contract.
 */
export type StatisticsRequest =
  | { id: string; analysisType: 'descriptives'; payload: DescriptivesPayload }
  | {
      id: string
      analysisType: 'welch-two-sample-t-test'
      payload: WelchTwoSampleTTestPayload
    }
  | { id: string; analysisType: 'paired-t-test'; payload: PairedTTestPayload }
  | {
      id: string
      analysisType: 'normality-diagnostics'
      payload: NormalityDiagnosticsPayload
    }
  | { id: string; analysisType: 'one-way-anova'; payload: OneWayAnovaPayload }
  | {
      id: string
      analysisType: 'chi-square-test'
      payload: ContingencyTablePayload
    }
  | {
      id: string
      analysisType: 'fishers-exact-test'
      payload: ContingencyTablePayload
    }
  | {
      id: string
      analysisType: 'pearson-correlation-regression'
      payload: PearsonCorrelationRegressionPayload
    }

export type AnalysisType = StatisticsRequest['analysisType']

// --- Result payloads -------------------------------------------------------

export interface DescriptivesResult {
  n: number
  mean: number
  median: number
  /** Sample standard deviation (ddof=1). `null` when n < 2 (undefined). */
  sd: number | null
  /** 25th percentile. */
  q1: number
  /** 75th percentile. */
  q3: number
  /** q3 - q1. */
  iqr: number
  min: number
  max: number
  /** 95% CI lower bound for the mean, via the t-distribution. `null` when n < 2. */
  ci95Low: number | null
  /** 95% CI upper bound for the mean, via the t-distribution. `null` when n < 2. */
  ci95High: number | null
}

export interface WelchTwoSampleTTestResult {
  nA: number
  nB: number
  meanA: number
  meanB: number
  sdA: number | null
  sdB: number | null
  /** mean(a) - mean(b). Positive means group A's mean is larger. */
  meanDifference: number
  meanDifferenceCi95Low: number
  meanDifferenceCi95High: number
  tStatistic: number
  /** Welch-Satterthwaite degrees of freedom (fractional). */
  degreesOfFreedom: number
  /** Two-sided p-value. */
  pValue: number
  /** Hedges' g (bias-corrected standardized mean difference), or `null` if undefined. */
  effectSize: number | null
  effectSizeMethod: 'hedges_g'
}

export interface PairedTTestResult {
  nPairs: number
  /** mean(a - b) across pairs. */
  meanDifference: number
  sdDifference: number
  meanDifferenceCi95Low: number
  meanDifferenceCi95High: number
  tStatistic: number
  /** nPairs - 1. */
  degreesOfFreedom: number
  /** Two-sided p-value. */
  pValue: number
  /** Cohen's d_z (meanDifference / sdDifference), or `null` if undefined. */
  effectSize: number | null
  effectSizeMethod: 'cohens_d_z'
}

/**
 * Diagnostic-only normality checks for a single sample. `shapiroWilkW`/
 * `shapiroWilkPValue`/`skewness` are `null` when `n < 3` (SciPy's
 * `shapiro`/`skew` are undefined below that) - the UI must show the
 * small-sample disclaimer in that case rather than a fabricated statistic.
 *
 * IMPORTANT: nothing that reads this result may use it to pick a
 * statistical test. It exists purely so a student can look at their data's
 * shape; the analysis was already decided by the rules engine before any
 * data existed.
 */
export interface NormalityDiagnosticsResult {
  n: number
  /** Shapiro-Wilk W statistic. `null` when n < 3. */
  shapiroWilkW: number | null
  /** Shapiro-Wilk two-sided p-value. `null` when n < 3. */
  shapiroWilkPValue: number | null
  /** Bias-corrected (adjusted Fisher-Pearson) sample skewness. `null` when n < 3. */
  skewness: number | null
}

/**
 * Milestone 8: per-group descriptive summary for a one-way ANOVA, identical
 * in shape to `DescriptivesResult` plus the group's own label.
 */
export interface OneWayAnovaGroupSummary extends DescriptivesResult {
  label: string
}

/**
 * The omnibus (overall) test result. `method` is always `'welch_anova'` -
 * see `anova.py`'s module docstring for why Rigor uses Welch's unequal-
 * variance one-way ANOVA (verified against real R output) rather than the
 * classic equal-variance `f_oneway`, consistent with this app's existing
 * preference for Welch's t-test over Student's t-test for two groups.
 *
 * Deliberately has NO effect-size field - see `anova.py`'s docstring for why
 * eta-squared/omega-squared is omitted rather than guessed.
 */
export interface OneWayAnovaOmnibusResult {
  method: 'welch_anova'
  fStatistic: number
  /** k - 1, where k is the number of groups. */
  numeratorDf: number
  /** Welch-Satterthwaite-style denominator df (fractional). */
  denominatorDf: number
  /** Two-sided p-value for the omnibus test. */
  pValue: number
}

/**
 * One pairwise post-hoc comparison (Welch's two-sample t-test between two
 * of the groups in this analysis). `pValueRaw` is the UNCORRECTED p-value
 * for this pair alone - it must never be shown to a student as "the"
 * result. `pValueAdjusted` (Holm-Bonferroni, corrected across every pair in
 * this analysis) is the value to display and interpret.
 */
export interface OneWayAnovaPairwiseComparison {
  groupALabel: string
  groupBLabel: string
  /** mean(groupA) - mean(groupB). */
  meanDifference: number
  tStatistic: number
  degreesOfFreedom: number
  /** Raw, uncorrected two-sided p-value for this single pair. Display only for transparency, never as the primary result. */
  pValueRaw: number
  /** Holm-Bonferroni-adjusted two-sided p-value, corrected across all pairs in this analysis. This is the value to display and interpret. */
  pValueAdjusted: number
  /** Hedges' g (bias-corrected standardized mean difference), or `null` if undefined. */
  effectSize: number | null
  effectSizeMethod: 'hedges_g'
}

export interface OneWayAnovaResult {
  /** Per-group descriptives, in the same order as the request's `groups`. */
  groups: OneWayAnovaGroupSummary[]
  omnibus: OneWayAnovaOmnibusResult
  /** Every unordered pair of groups, in the order the groups were given. */
  pairwiseComparisons: OneWayAnovaPairwiseComparison[]
  pairwiseCorrectionMethod: 'holm_bonferroni'
}

/**
 * Milestone 9: the general r x c chi-square test of association
 * (`scipy.stats.chi2_contingency`). Valid for any table with >= 2 rows and
 * >= 2 columns - not restricted to 2x2. `observed`/`expected` are returned
 * in the same row/column order as the request's `table`, so the caller can
 * zip real row/column labels back onto them. `cramersV` is always
 * computed (it generalizes to any table size) - see `categorical.py` for
 * the formula and its independent verification.
 *
 * `expected` is exposed specifically so `src/rules/categoricalTestSelection.ts`
 * can apply Cochran's rule (and so the UI can show it transparently) -
 * nothing in this worker uses it to pick a test itself.
 */
export interface ChiSquareTestResult {
  chiSquare: number
  degreesOfFreedom: number
  /** Two-sided p-value. */
  pValue: number
  /** Observed counts, same shape/order as the request's `table`. */
  observed: number[][]
  /** Expected counts under the null of independence, same shape/order as `table`. */
  expected: number[][]
  /** Total N across the whole table. */
  n: number
  /** Cramer's V: sqrt(chiSquare / (n * (min(rows, cols) - 1))). */
  cramersV: number
}

/**
 * Milestone 9: Fisher's exact test for a 2x2 table only, plus the
 * 2x2-specific odds ratio and risk difference (each with its own 95% CI).
 * See `categorical.py`'s docstring for the exact formulas and their
 * independent verification against real R output.
 *
 * `oddsRatioCi95Low`/`oddsRatioCi95High` are `null` when any cell of the
 * table is zero (the log-odds-ratio Wald CI is undefined in that case) -
 * `oddsRatio`/`pValue` themselves are still always reported (SciPy handles
 * zero cells for those).
 */
export interface FishersExactTestResult {
  /** Sample odds ratio (a*d)/(b*c) for table [[a, b], [c, d]], from `scipy.stats.fisher_exact`. */
  oddsRatio: number
  /** Two-sided p-value. */
  pValue: number
  /** Wald 95% CI for the odds ratio (log-odds-ratio scale). `null` if any cell is zero. */
  oddsRatioCi95Low: number | null
  oddsRatioCi95High: number | null
  /**
   * Difference in the proportion of the first outcome category (column 0)
   * between the two groups (row 0 - row 1). See `categorical.py` for the
   * exact convention.
   */
  riskDifference: number
  /** Wald 95% CI for the risk difference. */
  riskDifferenceCi95Low: number
  riskDifferenceCi95High: number
}

/**
 * Milestone 10: the correlation coefficient (with its Fisher-z CI, `null`
 * for n < 4 - see `correlation.py`) plus its two-sided p-value.
 */
export interface PearsonCorrelationResult {
  r: number
  pValue: number
  ci95Low: number | null
  ci95High: number | null
}

/**
 * Milestone 10: the simple-linear-regression fit (y ~ x) that goes with
 * `PearsonCorrelationResult` above. `pValue` here tests the same null
 * hypothesis as the correlation's own p-value (that the true
 * slope/correlation is zero) and is numerically identical for a simple
 * one-predictor regression - both are reported since each result object is
 * meant to stand on its own.
 */
export interface SimpleLinearRegressionResult {
  slope: number
  intercept: number
  slopeCi95Low: number
  slopeCi95High: number
  pValue: number
  rSquared: number
  /** Fitted y-values at each input x, in the same order as the request's `x`. */
  fittedValues: number[]
  /** y - fitted, same order as the request's `x`/`y`. */
  residuals: number[]
}

export interface PearsonCorrelationRegressionResult {
  n: number
  correlation: PearsonCorrelationResult
  regression: SimpleLinearRegressionResult
}

export type AnalysisResult =
  | { analysisType: 'descriptives'; result: DescriptivesResult }
  | {
      analysisType: 'welch-two-sample-t-test'
      result: WelchTwoSampleTTestResult
    }
  | { analysisType: 'paired-t-test'; result: PairedTTestResult }
  | { analysisType: 'normality-diagnostics'; result: NormalityDiagnosticsResult }
  | { analysisType: 'one-way-anova'; result: OneWayAnovaResult }
  | { analysisType: 'chi-square-test'; result: ChiSquareTestResult }
  | { analysisType: 'fishers-exact-test'; result: FishersExactTestResult }
  | {
      analysisType: 'pearson-correlation-regression'
      result: PearsonCorrelationRegressionResult
    }

export interface StatisticsErrorInfo {
  message: string
  details?: string
}

export type StatisticsResponse =
  | { id: string; success: true; result: AnalysisResult }
  | { id: string; success: false; error: StatisticsErrorInfo }

/** Coarse-grained progress reporting for the (slow, one-time) Pyodide load. */
export type LoadingStage =
  | 'idle'
  | 'loading-pyodide'
  | 'loading-packages'
  | 'installing-statistics-module'
  | 'ready'

export interface WorkerProgressMessage {
  type: 'progress'
  stage: LoadingStage
}

export interface WorkerResultMessage {
  type: 'result'
  response: StatisticsResponse
}

/** Messages the worker posts back to `workerClient.ts`. */
export type WorkerOutboundMessage = WorkerProgressMessage | WorkerResultMessage

/**
 * Messages `workerClient.ts` posts to the worker. `warm-up` lets a caller
 * trigger (and await, via progress) the Pyodide load ahead of the first
 * real analysis, without running any computation; `analyze` carries an
 * actual `StatisticsRequest`. This is the only inbound message shape the
 * worker accepts - there is no variant that carries raw Python.
 */
export type WorkerInboundMessage =
  { kind: 'warm-up' } | { kind: 'analyze'; request: StatisticsRequest }
