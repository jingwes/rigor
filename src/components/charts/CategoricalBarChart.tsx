import { useId, useMemo } from 'react'
import { scaleBand, scaleLinear } from 'd3-scale'
import { max } from 'd3-array'
import { describeCategoricalBarChart } from './accessibleSummary'
import { getCategoryFillStyle, type FillPatternKind } from './categoryFillStyles'
import {
  mergeChartCustomization,
  type ChartCustomizationOptions,
} from './types'

export interface CategoricalBarChartProps {
  /** Row labels (groups), the x-axis clusters, in the order to display. */
  groupLabels: string[]
  /** Column labels (outcome categories), the series within each cluster, shared across all groups. */
  categoryLabels: string[]
  /** `counts[groupIndex][categoryIndex]`, raw observation counts. */
  counts: number[][]
  /**
   * Whether bar height encodes the raw count (default) or the within-group
   * proportion. Either way, the actual COUNT is always shown as a data
   * label on each bar - this only changes what the bar's height represents.
   */
  mode?: 'counts' | 'proportions'
  /** Name of the outcome variable, used in the accessible summary and axis title. */
  outcomeName?: string
  customization?: Partial<ChartCustomizationOptions>
}

const MARGIN = { top: 40, right: 24, bottom: 56, left: 56 }
const LEGEND_HEIGHT = 28

function renderPatternDefs(
  patternIdOf: (index: number) => string,
  categoryCount: number,
) {
  return Array.from({ length: categoryCount }, (_, index) => {
    const style = getCategoryFillStyle(index)
    const id = patternIdOf(index)
    const patternProps = {
      id,
      patternUnits: 'userSpaceOnUse' as const,
      width: 8,
      height: 8,
    }

    switch (style.pattern as FillPatternKind) {
      case 'diagonal':
        return (
          <pattern key={id} {...patternProps} patternTransform="rotate(45)">
            <rect width={8} height={8} fill={style.color} fillOpacity={0.25} />
            <line x1={0} y1={0} x2={0} y2={8} stroke={style.color} strokeWidth={3} />
          </pattern>
        )
      case 'diagonal-reverse':
        return (
          <pattern key={id} {...patternProps} patternTransform="rotate(-45)">
            <rect width={8} height={8} fill={style.color} fillOpacity={0.25} />
            <line x1={0} y1={0} x2={0} y2={8} stroke={style.color} strokeWidth={3} />
          </pattern>
        )
      case 'horizontal':
        return (
          <pattern key={id} {...patternProps}>
            <rect width={8} height={8} fill={style.color} fillOpacity={0.25} />
            <line x1={0} y1={4} x2={8} y2={4} stroke={style.color} strokeWidth={3} />
          </pattern>
        )
      case 'vertical':
        return (
          <pattern key={id} {...patternProps}>
            <rect width={8} height={8} fill={style.color} fillOpacity={0.25} />
            <line x1={4} y1={0} x2={4} y2={8} stroke={style.color} strokeWidth={3} />
          </pattern>
        )
      case 'dots':
        return (
          <pattern key={id} {...patternProps}>
            <rect width={8} height={8} fill={style.color} fillOpacity={0.25} />
            <circle cx={4} cy={4} r={1.6} fill={style.color} />
          </pattern>
        )
      case 'solid':
      default:
        return (
          <pattern key={id} {...patternProps}>
            <rect width={8} height={8} fill={style.color} />
          </pattern>
        )
    }
  })
}

/**
 * A grouped bar chart for a categorical/binary outcome: one cluster of bars
 * per group, one bar per outcome category within each cluster. Every bar
 * category is distinguished by color AND a distinct SVG fill pattern (never
 * color alone), and every bar always shows its raw count as a data label,
 * regardless of `mode`.
 */
export function CategoricalBarChart({
  groupLabels,
  categoryLabels,
  counts,
  mode = 'counts',
  outcomeName,
  customization,
}: CategoricalBarChartProps) {
  const options = mergeChartCustomization(customization)
  const titleId = useId()
  const descId = useId()
  const patternPrefix = useId().replace(/:/g, '')

  const patternIdOf = (index: number) => `${patternPrefix}-cat-pattern-${index}`

  const rowTotals = useMemo(
    () => counts.map((row) => row.reduce((sum, count) => sum + count, 0)),
    [counts],
  )

  const heightValues = useMemo(() => {
    if (mode === 'proportions') {
      return counts.map((row, groupIndex) => {
        const total = rowTotals[groupIndex]
        return row.map((count) => (total > 0 ? count / total : 0))
      })
    }
    return counts
  }, [counts, mode, rowTotals])

  const innerWidth = options.widthPx - MARGIN.left - MARGIN.right
  const legendHeight = options.showLegend ? LEGEND_HEIGHT : 0
  const innerHeight = options.heightPx - MARGIN.top - MARGIN.bottom - legendHeight

  const x0Scale = scaleBand<string>()
    .domain(groupLabels)
    .range([0, innerWidth])
    .paddingInner(0.3)
    .paddingOuter(0.2)

  const x1Scale = scaleBand<string>()
    .domain(categoryLabels)
    .range([0, x0Scale.bandwidth()])
    .padding(0.1)

  const maxHeightValue = max(heightValues.flat()) ?? 0
  const yDomainMax = mode === 'proportions' ? Math.max(maxHeightValue * 1.15, 0.1) : maxHeightValue * 1.15 || 1

  const yScale = scaleLinear()
    .domain([0, yDomainMax])
    .range([innerHeight, 0])
    .clamp(true)

  const yTicks = yScale.ticks(5)

  const summary = describeCategoricalBarChart(groupLabels, categoryLabels, counts, outcomeName)

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
        <title id={titleId}>{options.figureTitle ?? 'Bar chart'}</title>
        <desc id={descId}>{summary}</desc>

        <defs>{renderPatternDefs(patternIdOf, categoryLabels.length)}</defs>

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
                {mode === 'proportions' ? `${Math.round(tick * 100)}%` : tick}
              </text>
            </g>
          ))}

          <line x1={0} x2={0} y1={0} y2={innerHeight} stroke="currentColor" />
          <line x1={0} x2={innerWidth} y1={innerHeight} y2={innerHeight} stroke="currentColor" />

          {(options.yAxisTitle || mode === 'proportions') && (
            <text
              transform={`translate(${-MARGIN.left + 16}, ${innerHeight / 2}) rotate(-90)`}
              textAnchor="middle"
              fontSize={options.fontSizePx}
            >
              {mode === 'proportions' ? 'Proportion' : (options.yAxisTitle ?? 'Count')}
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

          {groupLabels.map((groupLabel, groupIndex) => {
            const groupX = x0Scale(groupLabel) ?? 0
            return (
              <g
                key={groupLabel}
                transform={`translate(${groupX}, 0)`}
                data-testid={`bar-group-${groupLabel}`}
              >
                {categoryLabels.map((categoryLabel, categoryIndex) => {
                  const barX = x1Scale(categoryLabel) ?? 0
                  const barWidth = x1Scale.bandwidth()
                  const rawCount = counts[groupIndex]?.[categoryIndex] ?? 0
                  const heightValue = heightValues[groupIndex]?.[categoryIndex] ?? 0
                  const barY = yScale(heightValue)
                  const barHeight = innerHeight - barY

                  return (
                    <g key={categoryLabel} data-testid={`bar-${groupLabel}-${categoryLabel}`}>
                      <rect
                        x={barX}
                        y={barY}
                        width={barWidth}
                        height={Math.max(barHeight, 0)}
                        fill={`url(#${patternIdOf(categoryIndex)})`}
                        stroke={getCategoryFillStyle(categoryIndex).color}
                        strokeWidth={options.lineWidthPx}
                      />
                      {/* Raw count is ALWAYS shown as a data label, regardless of `mode`. */}
                      <text
                        x={barX + barWidth / 2}
                        y={barY - 6}
                        textAnchor="middle"
                        fontSize={options.fontSizePx * 0.8}
                      >
                        {rawCount}
                      </text>
                    </g>
                  )
                })}

                <text
                  x={x0Scale.bandwidth() / 2}
                  y={innerHeight + 20}
                  textAnchor="middle"
                  fontSize={options.fontSizePx}
                >
                  {groupLabel}
                </text>
              </g>
            )
          })}
        </g>

        {options.showLegend && (
          <g transform={`translate(${MARGIN.left}, ${options.heightPx - legendHeight + 8})`}>
            {categoryLabels.map((categoryLabel, index) => (
              <g key={`legend-${categoryLabel}`} transform={`translate(${index * 130}, 0)`}>
                <rect
                  x={0}
                  y={-8}
                  width={14}
                  height={14}
                  fill={`url(#${patternIdOf(index)})`}
                  stroke={getCategoryFillStyle(index).color}
                />
                <text x={20} y={4} fontSize={options.fontSizePx * 0.9}>
                  {categoryLabel}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>

      <p className="visually-hidden">{summary}</p>
    </figure>
  )
}
