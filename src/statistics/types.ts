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

export type AnalysisResult =
  | { analysisType: 'descriptives'; result: DescriptivesResult }
  | {
      analysisType: 'welch-two-sample-t-test'
      result: WelchTwoSampleTTestResult
    }
  | { analysisType: 'paired-t-test'; result: PairedTTestResult }
  | { analysisType: 'normality-diagnostics'; result: NormalityDiagnosticsResult }

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
