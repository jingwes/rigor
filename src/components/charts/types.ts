/**
 * Milestone 5: shared, presentation-only types for the chart components.
 *
 * Deliberately generic - these components never see a `Dataset`,
 * `ExperimentDesign`, or `AnalysisResult` from other milestones. Wiring a
 * chart up to real analysis data is Milestone 6's job.
 */

import type { IntervalType } from './statsMath'

export type { IntervalType }

export type YAxisScaleType = 'linear' | 'log'

/**
 * Customization is rendering-only: changing any of these values must never
 * change the underlying numbers a chart displays (the raw points and the
 * computed interval bounds are always derived straight from the input
 * data).
 */
export interface ChartCustomizationOptions {
  /** Overall figure title, shown above the plot. */
  figureTitle?: string
  /** X-axis title (e.g. "Group"). */
  xAxisTitle?: string
  /** Y-axis title (e.g. "Reaction time"). */
  yAxisTitle?: string
  /** Unit shown alongside the Y-axis title/values (e.g. "ms", "%", "cm"). */
  yAxisUnit?: string
  /** Override a group's display label without changing its data. */
  groupLabelOverrides?: Record<string, string>
  /** Radius of each raw-observation point marker, in pixels. */
  pointRadiusPx: number
  /** Stroke width for error bars and connecting lines, in pixels. */
  lineWidthPx: number
  /** Base font size for all chart text, in pixels. */
  fontSizePx: number
  /** Whether to show the legend (group -> color/shape key). */
  showLegend: boolean
  /**
   * Linear or logarithmic Y-axis. Log is only ever actually applied when
   * every value is > 0 - see `evaluateLogScaleRequest` in
   * `src/rules/visualizationRules.ts`. Requesting log with non-positive
   * data falls back to linear rather than producing a broken chart.
   */
  yScaleType: YAxisScaleType
  /**
   * Explicit Y-axis minimum ("baseline"). `undefined` means "choose
   * automatically" (which defaults to including zero when zero is a
   * meaningful reference point for the plotted quantity, per the project's
   * "never default to something misleading" rule).
   */
  yAxisMin?: number
  widthPx: number
  heightPx: number
}

export const DEFAULT_CHART_CUSTOMIZATION: ChartCustomizationOptions = {
  pointRadiusPx: 4,
  lineWidthPx: 1.5,
  fontSizePx: 13,
  showLegend: true,
  yScaleType: 'linear',
  widthPx: 480,
  heightPx: 360,
}

export function mergeChartCustomization(
  options?: Partial<ChartCustomizationOptions>,
): ChartCustomizationOptions {
  return { ...DEFAULT_CHART_CUSTOMIZATION, ...options }
}
