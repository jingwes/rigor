import { useId, useMemo } from 'react'
import { scaleLinear, scaleLog, scalePoint } from 'd3-scale'
import { computeInterval } from './statsMath'
import { describeDotPlot } from './accessibleSummary'
import { getGroupVisualStyle } from './groupStyles'
import { PointMarker } from './PointMarker'
import { computeJitterOffsets } from './jitter'
import {
  evaluateLogScaleRequest,
  evaluateNonZeroBaselineWarning,
  evaluateUnitsMixupWarning,
} from '../../rules/visualizationRules'
import type { Warning } from '../../rules/types'
import {
  mergeChartCustomization,
  type ChartCustomizationOptions,
  type IntervalType,
} from './types'

export interface DotPlotGroup {
  label: string
  values: number[]
}

export interface DotPlotProps {
  groups: DotPlotGroup[]
  intervalType: IntervalType
  customization?: Partial<ChartCustomizationOptions>
  /**
   * Whether zero is a meaningful reference point for this quantity, passed
   * through to the non-zero-baseline warning. Defaults to `true`.
   */
  zeroIsMeaningful?: boolean
}

const MARGIN = { top: 40, right: 24, bottom: 56, left: 64 }
const LEGEND_HEIGHT = 28

function computeYDomain(
  allValues: number[],
  yAxisMin: number | undefined,
  zeroIsMeaningful: boolean,
  useLog: boolean,
): [number, number] {
  const dataMin = Math.min(...allValues)
  const dataMax = Math.max(...allValues)
  const span = dataMax - dataMin || Math.abs(dataMax) || 1
  const padding = span * 0.15

  if (useLog) {
    // Log domains can never include zero/negative values - callers only
    // reach this branch when evaluateLogScaleRequest confirmed all values
    // are positive.
    const lower =
      yAxisMin !== undefined && yAxisMin > 0 ? yAxisMin : dataMin / 1.5
    return [lower, dataMax * 1.2]
  }

  if (yAxisMin !== undefined) {
    return [yAxisMin, dataMax + padding]
  }

  const defaultMin = zeroIsMeaningful ? Math.min(0, dataMin) : dataMin - padding
  return [defaultMin, dataMax + padding]
}

/**
 * Raw-observation dot plot: one or more groups of numeric values, each
 * rendered as individually visible (horizontally jittered) points along a
 * shared numeric axis, with a mean +/- SD/SEM/95% CI overlay per group.
 * Works the same for 2 groups or 3+.
 */
export function DotPlot({
  groups,
  intervalType,
  customization,
  zeroIsMeaningful = true,
}: DotPlotProps) {
  const options = mergeChartCustomization(customization)
  const titleId = useId()
  const descId = useId()

  const allValues = useMemo(() => groups.flatMap((g) => g.values), [groups])

  const logEvaluation = useMemo(
    () => evaluateLogScaleRequest(allValues),
    [allValues],
  )
  const useLogScale = options.yScaleType === 'log' && logEvaluation.allowed

  const baselineWarning: Warning | null =
    options.yAxisMin !== undefined
      ? evaluateNonZeroBaselineWarning({
          yAxisMin: options.yAxisMin,
          zeroIsMeaningful,
        })
      : null

  const unitsWarning = evaluateUnitsMixupWarning(allValues, options.yAxisUnit)

  const activeWarnings = [
    options.yScaleType === 'log' ? logEvaluation.warning : null,
    baselineWarning,
    unitsWarning,
  ].filter((w): w is Warning => w !== null)

  const innerWidth = options.widthPx - MARGIN.left - MARGIN.right
  const legendHeight = options.showLegend ? LEGEND_HEIGHT : 0
  const innerHeight =
    options.heightPx - MARGIN.top - MARGIN.bottom - legendHeight

  const xScale = scalePoint<string>()
    .domain(groups.map((g) => g.label))
    .range([0, innerWidth])
    .padding(0.5)

  const yDomain = computeYDomain(
    allValues.length > 0 ? allValues : [0, 1],
    options.yAxisMin,
    zeroIsMeaningful,
    useLogScale,
  )
  const yScale = useLogScale
    ? scaleLog().domain(yDomain).range([innerHeight, 0]).clamp(true)
    : scaleLinear().domain(yDomain).range([innerHeight, 0]).clamp(true)

  const yTicks = yScale.ticks(6)
  const bandwidth = groups.length > 0 ? xScale.step() : innerWidth
  const jitterWidth = Math.min(bandwidth * 0.6, 80)

  const summary = describeDotPlot(groups, intervalType)

  return (
    <figure
      className="chart-figure"
      style={{ fontSize: options.fontSizePx, width: options.widthPx }}
    >
      {options.figureTitle && (
        <figcaption className="chart-title">{options.figureTitle}</figcaption>
      )}
      <svg
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        width={options.widthPx}
        height={options.heightPx}
        viewBox={`0 0 ${options.widthPx} ${options.heightPx}`}
      >
        <title id={titleId}>{options.figureTitle ?? 'Dot plot'}</title>
        <desc id={descId}>{summary}</desc>

        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {/* Y gridlines + ticks */}
          {yTicks.map((tick) => (
            <g
              key={`ytick-${tick}`}
              transform={`translate(0, ${yScale(tick)})`}
            >
              <line
                x1={0}
                x2={innerWidth}
                stroke="currentColor"
                strokeOpacity={0.15}
              />
              <text
                x={-8}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={options.fontSizePx * 0.85}
              >
                {tick}
              </text>
            </g>
          ))}

          {/* Y axis line */}
          <line x1={0} x2={0} y1={0} y2={innerHeight} stroke="currentColor" />
          {/* X axis line */}
          <line
            x1={0}
            x2={innerWidth}
            y1={innerHeight}
            y2={innerHeight}
            stroke="currentColor"
          />

          {/* Y axis title */}
          {(options.yAxisTitle || options.yAxisUnit) && (
            <text
              transform={`translate(${-MARGIN.left + 16}, ${innerHeight / 2}) rotate(-90)`}
              textAnchor="middle"
              fontSize={options.fontSizePx}
            >
              {[
                options.yAxisTitle,
                options.yAxisUnit && `(${options.yAxisUnit})`,
              ]
                .filter(Boolean)
                .join(' ')}
            </text>
          )}

          {/* X axis title */}
          {options.xAxisTitle && (
            <text
              x={innerWidth / 2}
              y={innerHeight + 44}
              textAnchor="middle"
              fontSize={options.fontSizePx}
            >
              {options.xAxisTitle}
            </text>
          )}

          {groups.map((group, groupIndex) => {
            const style = getGroupVisualStyle(groupIndex)
            const cx = xScale(group.label) ?? innerWidth / 2
            const displayLabel =
              options.groupLabelOverrides?.[group.label] ?? group.label
            const offsets = computeJitterOffsets(
              group.values.length,
              groupIndex + 1,
            )
            const interval = computeInterval(group.values, intervalType)

            return (
              <g key={group.label} data-testid={`group-${group.label}`}>
                {/* Error bar overlay, drawn behind points */}
                {interval && (
                  <g className="chart-error-bar">
                    <line
                      x1={cx}
                      x2={cx}
                      y1={yScale(interval.lower)}
                      y2={yScale(interval.upper)}
                      stroke={style.color}
                      strokeWidth={options.lineWidthPx}
                    />
                    <line
                      x1={cx - 6}
                      x2={cx + 6}
                      y1={yScale(interval.lower)}
                      y2={yScale(interval.lower)}
                      stroke={style.color}
                      strokeWidth={options.lineWidthPx}
                    />
                    <line
                      x1={cx - 6}
                      x2={cx + 6}
                      y1={yScale(interval.upper)}
                      y2={yScale(interval.upper)}
                      stroke={style.color}
                      strokeWidth={options.lineWidthPx}
                    />
                    <line
                      x1={cx - 10}
                      x2={cx + 10}
                      y1={yScale(interval.mean)}
                      y2={yScale(interval.mean)}
                      stroke={style.color}
                      strokeWidth={options.lineWidthPx * 1.5}
                    />
                  </g>
                )}

                {/* Raw observations - always rendered, regardless of
                    interval type or customization. */}
                {group.values.map((value, i) => (
                  <PointMarker
                    key={`${group.label}-point-${i}`}
                    className="chart-point"
                    shape={style.shape}
                    cx={cx + offsets[i] * jitterWidth}
                    cy={yScale(value)}
                    size={options.pointRadiusPx}
                    color={style.color}
                  />
                ))}

                {/* Group label on the X axis - always visible text, never
                    color-only group identification. */}
                <text
                  x={cx}
                  y={innerHeight + 20}
                  textAnchor="middle"
                  fontSize={options.fontSizePx}
                >
                  {displayLabel}
                </text>
              </g>
            )
          })}
        </g>

        {options.showLegend && (
          <g
            transform={`translate(${MARGIN.left}, ${options.heightPx - legendHeight + 8})`}
          >
            {groups.map((group, i) => {
              const style = getGroupVisualStyle(i)
              const displayLabel =
                options.groupLabelOverrides?.[group.label] ?? group.label
              return (
                <g
                  key={`legend-${group.label}`}
                  transform={`translate(${i * 120}, 0)`}
                >
                  <PointMarker
                    shape={style.shape}
                    cx={6}
                    cy={0}
                    size={options.pointRadiusPx}
                    color={style.color}
                  />
                  <text x={16} y={4} fontSize={options.fontSizePx * 0.9}>
                    {displayLabel}
                  </text>
                </g>
              )
            })}
          </g>
        )}
      </svg>

      <p className="visually-hidden">{summary}</p>

      {activeWarnings.length > 0 && (
        <ul className="chart-warnings" role="status">
          {activeWarnings.map((warning) => (
            <li
              key={warning.id}
              className={`chart-warning-${warning.severity}`}
            >
              {warning.message}
            </li>
          ))}
        </ul>
      )}
    </figure>
  )
}
