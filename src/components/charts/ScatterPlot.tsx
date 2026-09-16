import { useId } from 'react'
import { scaleLinear } from 'd3-scale'
import { PointMarker } from './PointMarker'
import { describeScatterPlot, type RegressionLineDescriptor } from './describeScatterPlot'
import { mergeChartCustomization, type ChartCustomizationOptions } from './types'

export interface ScatterPlotPoint {
  x: number
  y: number
}

export interface ScatterPlotProps {
  points: ScatterPlotPoint[]
  xLabel: string
  yLabel: string
  /**
   * Optional fitted-regression-line overlay. Purely additive: the raw
   * points are always rendered at their true data coordinates regardless of
   * whether this is present - this can never move or hide a point.
   */
  regressionLine?: RegressionLineDescriptor
  customization?: Partial<ChartCustomizationOptions>
}

const MARGIN = { top: 40, right: 24, bottom: 56, left: 64 }

function domainWithPadding(values: number[]): [number, number] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || Math.abs(max) || 1
  const padding = span * 0.1
  return [min - padding, max + padding]
}

/**
 * Milestone 10's raw-observation scatter plot for two continuous variables.
 * Every point is always shown at its true (x, y) position - the optional
 * regression-line overlay is drawn on top and never changes where points
 * are plotted. Mirrors `DotPlot`'s conventions (d3-scale, an SVG `<title>`/
 * `<desc>` pair plus a visually-hidden text summary generated from the same
 * data, and shared `ChartCustomizationOptions` for width/height/font size).
 */
export function ScatterPlot({
  points,
  xLabel,
  yLabel,
  regressionLine,
  customization,
}: ScatterPlotProps) {
  const options = mergeChartCustomization(customization)
  const titleId = useId()
  const descId = useId()

  const innerWidth = options.widthPx - MARGIN.left - MARGIN.right
  const innerHeight = options.heightPx - MARGIN.top - MARGIN.bottom

  const xValues = points.length > 0 ? points.map((p) => p.x) : [0, 1]
  const yValues = points.length > 0 ? points.map((p) => p.y) : [0, 1]

  const xDomain = domainWithPadding(xValues)
  const yDomain = domainWithPadding(yValues)

  const xScale = scaleLinear().domain(xDomain).range([0, innerWidth]).clamp(true)
  const yScale = scaleLinear().domain(yDomain).range([innerHeight, 0]).clamp(true)

  const xTicks = xScale.ticks(6)
  const yTicks = yScale.ticks(6)

  const regressionEndpoints = regressionLine
    ? [
        { x: xDomain[0], y: regressionLine.slope * xDomain[0] + regressionLine.intercept },
        { x: xDomain[1], y: regressionLine.slope * xDomain[1] + regressionLine.intercept },
      ]
    : null

  const summary = describeScatterPlot(points, xLabel, yLabel, regressionLine)

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
        <title id={titleId}>{options.figureTitle ?? 'Scatter plot'}</title>
        <desc id={descId}>{summary}</desc>

        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {yTicks.map((tick) => (
            <g key={`ytick-${tick}`} transform={`translate(0, ${yScale(tick)})`}>
              <line x1={0} x2={innerWidth} stroke="currentColor" strokeOpacity={0.15} />
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

          {xTicks.map((tick) => (
            <g key={`xtick-${tick}`} transform={`translate(${xScale(tick)}, 0)`}>
              <line y1={0} y2={innerHeight} stroke="currentColor" strokeOpacity={0.15} />
              <text
                y={innerHeight + 18}
                textAnchor="middle"
                fontSize={options.fontSizePx * 0.85}
              >
                {tick}
              </text>
            </g>
          ))}

          <line x1={0} x2={0} y1={0} y2={innerHeight} stroke="currentColor" />
          <line x1={0} x2={innerWidth} y1={innerHeight} y2={innerHeight} stroke="currentColor" />

          <text
            transform={`translate(${-MARGIN.left + 16}, ${innerHeight / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={options.fontSizePx}
          >
            {yLabel}
          </text>

          <text
            x={innerWidth / 2}
            y={innerHeight + 40}
            textAnchor="middle"
            fontSize={options.fontSizePx}
          >
            {xLabel}
          </text>

          {regressionEndpoints && (
            <line
              data-testid="scatter-regression-line"
              x1={xScale(regressionEndpoints[0].x)}
              y1={yScale(regressionEndpoints[0].y)}
              x2={xScale(regressionEndpoints[1].x)}
              y2={yScale(regressionEndpoints[1].y)}
              stroke="currentColor"
              strokeWidth={options.lineWidthPx * 1.5}
              className="scatter-regression-line"
            />
          )}

          {/* Raw observations - always rendered at their true coordinates,
              regardless of whether a regression line overlay is present. */}
          {points.map((point, index) => (
            <PointMarker
              key={`point-${index}`}
              className="chart-point"
              shape="circle"
              cx={xScale(point.x)}
              cy={yScale(point.y)}
              size={options.pointRadiusPx}
              color="currentColor"
            />
          ))}
        </g>
      </svg>

      <p className="visually-hidden">{summary}</p>
    </figure>
  )
}
