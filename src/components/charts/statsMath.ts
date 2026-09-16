/**
 * Milestone 5: presentation-layer interval math for chart error bars.
 *
 * This is deliberately small, pure, dependency-free arithmetic - it exists so
 * a `DotPlot` can draw a mean +/- SD / SEM / 95% CI overlay instantly, without
 * a round trip to the Pyodide/SciPy statistics worker (`src/statistics/`).
 * It is NOT a substitute for that worker's actual hypothesis tests and must
 * never be presented as one - it only ever answers "where should the error
 * bar go on screen for these raw numbers".
 *
 * All functions are pure and take plain `number[]` - no coupling to
 * `Dataset`/`ExperimentDesign`/`AnalysisResult` from other milestones.
 */

/** The three ways a chart can summarize spread/uncertainty around a mean. */
export type IntervalType = 'sd' | 'sem' | 'ci95'

export interface IntervalResult {
  mean: number
  /** Half-width of the interval (mean +/- halfWidth = [lower, upper]). */
  halfWidth: number
  lower: number
  upper: number
}

/** Arithmetic mean. Callers must pass at least one value. */
export function mean(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error('mean: requires at least one value')
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Sample standard deviation (Bessel-corrected, divides by n-1), the
 * conventional choice when the values are a sample of observations rather
 * than an entire population. Undefined for n < 2 (returns `null`).
 */
export function sampleStandardDeviation(
  values: readonly number[],
): number | null {
  const n = values.length
  if (n < 2) return null
  const m = mean(values)
  const sumSquaredDeviations = values.reduce((sum, v) => sum + (v - m) ** 2, 0)
  return Math.sqrt(sumSquaredDeviations / (n - 1))
}

/**
 * Standard error of the mean: sd / sqrt(n). Describes the uncertainty in the
 * *estimated mean*, not the spread of individual observations. Undefined for
 * n < 2 (returns `null`).
 */
export function standardErrorOfMean(values: readonly number[]): number | null {
  const sd = sampleStandardDeviation(values)
  if (sd === null) return null
  return sd / Math.sqrt(values.length)
}

/**
 * Two-tailed critical t-value for a 95% confidence interval, by degrees of
 * freedom. Table values for df 1-30 (standard values from a t-distribution
 * table); for df > 30 the distribution is close enough to normal that the
 * z-critical value (1.96) is used instead. This is a well-known
 * simplification appropriate for an instant presentation-layer chart
 * overlay - not a substitute for the exact statistics computed by the
 * Pyodide/SciPy worker.
 */
const T_TABLE_95: readonly number[] = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201,
  2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074,
  2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
]

export function tCriticalValue95(degreesOfFreedom: number): number {
  if (degreesOfFreedom < 1) {
    throw new Error('tCriticalValue95: degrees of freedom must be >= 1')
  }
  if (degreesOfFreedom > 30) return 1.96
  return T_TABLE_95[Math.floor(degreesOfFreedom) - 1]
}

/**
 * 95% confidence interval for the mean, using the t-distribution
 * (mean +/- t * SEM). Undefined for n < 2 (returns `null`).
 */
export function confidenceInterval95(
  values: readonly number[],
): IntervalResult | null {
  const n = values.length
  if (n < 2) return null
  const sem = standardErrorOfMean(values)
  if (sem === null) return null
  const t = tCriticalValue95(n - 1)
  const halfWidth = t * sem
  const m = mean(values)
  return { mean: m, halfWidth, lower: m - halfWidth, upper: m + halfWidth }
}

/**
 * Compute the requested interval type around the mean of `values`.
 * Returns `null` when there are too few observations (n < 2) to define a
 * spread/uncertainty interval - callers should render the mean/points only
 * in that case, rather than a fabricated error bar.
 */
export function computeInterval(
  values: readonly number[],
  type: IntervalType,
): IntervalResult | null {
  if (values.length === 0) return null
  const m = mean(values)

  if (type === 'ci95') {
    return confidenceInterval95(values)
  }

  const halfWidth =
    type === 'sd'
      ? sampleStandardDeviation(values)
      : standardErrorOfMean(values)
  if (halfWidth === null) return null
  return { mean: m, halfWidth, lower: m - halfWidth, upper: m + halfWidth }
}
