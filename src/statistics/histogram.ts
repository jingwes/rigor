/**
 * Milestone 6: histogram binning for the "Assumptions and checks" normality
 * diagnostics display.
 *
 * Per the Milestone 6 spec, binning happens here in TypeScript from the raw
 * values already available in the browser - there is no need to send this
 * through the Pyodide/SciPy worker (`normality-diagnostics` there only
 * computes the Shapiro-Wilk statistic/p-value and skewness). Pure,
 * dependency-free arithmetic; no coupling to `Dataset`/`AnalysisResult`.
 */

export interface HistogramBin {
  /** Inclusive lower bound. */
  x0: number
  /** Exclusive upper bound (inclusive for the final bin only). */
  x1: number
  count: number
}

export interface Histogram {
  bins: HistogramBin[]
  binWidth: number
}

/**
 * Sturges' rule: a simple, widely used default for the number of histogram
 * bins from a sample size, appropriate for the small, high-school-scale
 * sample sizes Rigor targets. Always at least 1 bin.
 */
export function sturgesBinCount(n: number): number {
  if (n <= 1) return 1
  return Math.max(1, Math.ceil(Math.log2(n) + 1))
}

/**
 * Bins `values` into equal-width bins spanning [min, max]. Returns an empty
 * histogram (no bins) for an empty input, rather than throwing - callers
 * should treat that as "nothing to draw" instead of an error.
 *
 * When every value is identical (span of 0), all observations fall into a
 * single bin centered on that value, rather than dividing by zero.
 */
export function computeHistogram(
  values: readonly number[],
  binCount?: number,
): Histogram {
  if (values.length === 0) {
    return { bins: [], binWidth: 0 }
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const requestedBins = binCount ?? sturgesBinCount(values.length)
  const span = max - min

  if (span === 0) {
    return {
      bins: [{ x0: min - 0.5, x1: max + 0.5, count: values.length }],
      binWidth: 1,
    }
  }

  const nBins = Math.max(1, Math.floor(requestedBins))
  const binWidth = span / nBins
  const bins: HistogramBin[] = Array.from({ length: nBins }, (_, i) => ({
    x0: min + i * binWidth,
    x1: min + (i + 1) * binWidth,
    count: 0,
  }))

  for (const value of values) {
    // The maximum value belongs in the last bin (bins are otherwise
    // half-open [x0, x1)).
    const index =
      value >= max
        ? nBins - 1
        : Math.min(nBins - 1, Math.floor((value - min) / binWidth))
    bins[index].count += 1
  }

  return { bins, binWidth }
}
