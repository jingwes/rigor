/**
 * Milestone 10: screen-reader-accessible text summary for `ScatterPlot`,
 * generated from the exact same points/labels/regression-line data driving
 * the visual chart - see `accessibleSummary.ts`'s module docstring for why
 * this pattern (a summary generated from the same data, never hand-authored
 * separately) is used throughout this codebase.
 *
 * Kept in its own file rather than added to `accessibleSummary.ts`: that
 * module is dedicated to the group-comparison charts (dot plot, paired dot
 * plot, categorical bar chart); correlation/regression is a separate,
 * additive feature area (see `src/features/correlation/`), so its own chart
 * summary lives alongside it here instead of growing an unrelated module.
 */
import { mean } from './statsMath'

export interface ScatterPoint {
  x: number
  y: number
}

export interface RegressionLineDescriptor {
  slope: number
  intercept: number
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : 'n/a'
}

/**
 * "Scatter plot of Height (cm) and Weight (kg) for 30 observations. Mean
 * Height (cm) = 5.20, mean Weight (kg) = 7.10. A fitted regression line is
 * also shown."
 */
export function describeScatterPlot(
  points: ScatterPoint[],
  xLabel: string,
  yLabel: string,
  regressionLine?: RegressionLineDescriptor,
): string {
  const xMean = points.length > 0 ? mean(points.map((p) => p.x)) : NaN
  const yMean = points.length > 0 ? mean(points.map((p) => p.y)) : NaN

  const base =
    `Scatter plot of ${xLabel} and ${yLabel} for ${points.length} ` +
    `observation${points.length === 1 ? '' : 's'}. Mean ${xLabel} = ` +
    `${formatNumber(xMean)}, mean ${yLabel} = ${formatNumber(yMean)}. ` +
    'Every individual observation is plotted as a point.'

  if (!regressionLine) return base

  return (
    base +
    ' A fitted regression line is also shown (slope = ' +
    `${formatNumber(regressionLine.slope)}, intercept = ${formatNumber(regressionLine.intercept)}).`
  )
}
