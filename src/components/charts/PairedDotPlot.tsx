import { useId, useMemo } from 'react'
import { scaleLinear, scaleLog, scalePoint } from 'd3-scale'
import { computeInterval } from './statsMath'
import { describePairedDotPlot } from './accessibleSummary'
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

export interface PairedObservation {
  id: string
  before: number
  after: number
}

export interface PairedDotPlotProps {
  pairs: PairedObservation[]
  beforeLabel: string
  afterLabel: string
  /**
   * Optional mean +/- interval overlay drawn on each column (before/after).
   * Omit to show only the raw points and connecting lines.
   */
  intervalType?: IntervalType
  customization?: Partial<ChartCustomizationOptions>
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
 * Matched before/after (or matched-pair) dot plot: two aligned columns of
 * raw observations with a line connecting each matched pair, so
 * within-pair change is visible alongside the two group distributions.
 */
export function PairedDotPlot({
  pairs,
  beforeLabel,
  afterLabel,
  intervalType,
  customization,
  zeroIsMeaningful = true,
}: PairedDotPlotProps) {
  const options = mergeChartCustomization(customization)
  const titleId = useId()
  const descId = useId()

  const beforeValues = useMemo(() => pairs.map((p) => p.before), [pairs])
  const afterValues = useMemo(() => pairs.map((p) => p.after), [pairs])
  const allValues = useMemo(
    () => [...beforeValues, ...afterValues],
    [beforeValues, afterValues],
  )

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

  const beforeDisplayLabel =
    options.groupLabelOverrides?.[beforeLabel] ?? beforeLabel
  const afterDisplayLabel =
    options.groupLabelOverrides?.[afterLabel] ?? afterLabel

  const xScale = scalePoint<string>()
    .domain([beforeDisplayLabel, afterDisplayLabel])
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
  const beforeX = xScale(beforeDisplayLabel) ?? innerWidth * 0.25
  const afterX = xScale(afterDisplayLabel) ?? innerWidth * 0.75
  const jitterWidth = Math.min(xScale.step() * 0.5, 60)
  const jitterOffsets = computeJitterOffsets(pairs.length, 1)

  const beforeStyle = getGroupVisualStyle(0)
  const afterStyle = getGroupVisualStyle(1)

  const beforeInterval = intervalType
    ? computeInterval(beforeValues, intervalType)
    : null
  const afterInterval = intervalType
    ? computeInterval(afterValues, intervalType)
    : null

  const summary = describePairedDotPlot(pairs, beforeLabel, afterLabel)

  function renderIntervalOverlay(
    interval: ReturnType<typeof computeInterval>,
    x: number,
    color: string,
  ) {
    if (!interval) return null
    return (
      <g className="chart-error-bar">
        <line
          x1={x}
          x2={x}
          y1={yScale(interval.lower)}
          y2={yScale(interval.upper)}
          stroke={color}
          strokeWidth={options.lineWidthPx}
        />
        <line
          x1={x - 6}
          x2={x + 6}
          y1={yScale(interval.lower)}
          y2={yScale(interval.lower)}
          stroke={color}
          strokeWidth={options.lineWidthPx}
        />
        <line
          x1={x - 6}
          x2={x + 6}
          y1={yScale(interval.upper)}
          y2={yScale(interval.upper)}
          stroke={color}
          strokeWidth={options.lineWidthPx}
        />
        <line
          x1={x - 10}
          x2={x + 10}
          y1={yScale(interval.mean)}
          y2={yScale(interval.mean)}
          stroke={color}
          strokeWidth={options.lineWidthPx * 1.5}
        />
      </g>
    )
  }

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
        <title id={titleId}>{options.figureTitle ?? 'Paired dot plot'}</title>
        <desc id={descId}>{summary}</desc>

        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
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

          <line x1={0} x2={0} y1={0} y2={innerHeight} stroke="currentColor" />
          <line
            x1={0}
            x2={innerWidth}
            y1={innerHeight}
            y2={innerHeight}
            stroke="currentColor"
          />

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

          {/* Connecting lines - drawn first, underneath the points. */}
          {pairs.map((pair, i) => {
            const bx = beforeX + jitterOffsets[i] * jitterWidth
            const ax = afterX + jitterOffsets[i] * jitterWidth
            return (
              <line
                key={`connector-${pair.id}`}
                data-testid="pair-connector"
                x1={bx}
                x2={ax}
                y1={yScale(pair.before)}
                y2={yScale(pair.after)}
                stroke="currentColor"
                strokeOpacity={0.4}
                strokeWidth={Math.max(options.lineWidthPx * 0.75, 1)}
              />
            )
          })}

          {renderIntervalOverlay(beforeInterval, beforeX, beforeStyle.color)}
          {renderIntervalOverlay(afterInterval, afterX, afterStyle.color)}

          {/* Raw observations - always rendered regardless of interval
              overlay or customization. */}
          {pairs.map((pair, i) => (
            <PointMarker
              key={`before-${pair.id}`}
              className="chart-point"
              shape={beforeStyle.shape}
              cx={beforeX + jitterOffsets[i] * jitterWidth}
              cy={yScale(pair.before)}
              size={options.pointRadiusPx}
              color={beforeStyle.color}
            />
          ))}
          {pairs.map((pair, i) => (
            <PointMarker
              key={`after-${pair.id}`}
              className="chart-point"
              shape={afterStyle.shape}
              cx={afterX + jitterOffsets[i] * jitterWidth}
              cy={yScale(pair.after)}
              size={options.pointRadiusPx}
              color={afterStyle.color}
            />
          ))}

          <text
            x={beforeX}
            y={innerHeight + 20}
            textAnchor="middle"
            fontSize={options.fontSizePx}
          >
            {beforeDisplayLabel}
          </text>
          <text
            x={afterX}
            y={innerHeight + 20}
            textAnchor="middle"
            fontSize={options.fontSizePx}
          >
            {afterDisplayLabel}
          </text>
        </g>

        {options.showLegend && (
          <g
            transform={`translate(${MARGIN.left}, ${options.heightPx - legendHeight + 8})`}
          >
            {[
              { label: beforeDisplayLabel, style: beforeStyle },
              { label: afterDisplayLabel, style: afterStyle },
            ].map((entry, i) => (
              <g key={entry.label} transform={`translate(${i * 120}, 0)`}>
                <PointMarker
                  shape={entry.style.shape}
                  cx={6}
                  cy={0}
                  size={options.pointRadiusPx}
                  color={entry.style.color}
                />
                <text x={16} y={4} fontSize={options.fontSizePx * 0.9}>
                  {entry.label}
                </text>
              </g>
            ))}
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
