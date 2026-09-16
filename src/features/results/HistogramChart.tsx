import { useId, useMemo } from 'react'
import { computeHistogram } from '../../statistics/histogram'

export interface HistogramChartProps {
  values: number[]
  label: string
  widthPx?: number
  heightPx?: number
}

/**
 * A small, presentation-only histogram for the "Assumptions and checks"
 * section - built from `computeHistogram` (pure TypeScript binning, no
 * round trip through Pyodide). Purely descriptive: it never decides
 * anything about which statistical test is used.
 */
export function HistogramChart({
  values,
  label,
  widthPx = 260,
  heightPx = 140,
}: HistogramChartProps) {
  const titleId = useId()
  const histogram = useMemo(() => computeHistogram(values), [values])
  const maxCount = Math.max(1, ...histogram.bins.map((bin) => bin.count))

  const margin = { top: 8, right: 8, bottom: 24, left: 8 }
  const innerWidth = widthPx - margin.left - margin.right
  const innerHeight = heightPx - margin.top - margin.bottom
  const barGap = 2
  const barWidth =
    histogram.bins.length > 0
      ? innerWidth / histogram.bins.length - barGap
      : innerWidth

  if (histogram.bins.length === 0) {
    return <p>Not enough data to draw a histogram.</p>
  }

  return (
    <figure className="histogram-chart">
      <svg
        role="img"
        aria-labelledby={titleId}
        width={widthPx}
        height={heightPx}
        viewBox={`0 0 ${widthPx} ${heightPx}`}
      >
        <title id={titleId}>{`Histogram of ${label}`}</title>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {histogram.bins.map((bin, i) => {
            const barHeight = (bin.count / maxCount) * innerHeight
            const x = i * (barWidth + barGap)
            const y = innerHeight - barHeight
            return (
              <g key={`bin-${i}`}>
                <rect
                  x={x}
                  y={y}
                  width={Math.max(barWidth, 1)}
                  height={Math.max(barHeight, 0)}
                  fill="currentColor"
                  opacity={0.75}
                />
                <text
                  x={x + barWidth / 2}
                  y={innerHeight + 14}
                  textAnchor="middle"
                  fontSize={9}
                >
                  {bin.count}
                </text>
              </g>
            )
          })}
          <line
            x1={0}
            x2={innerWidth}
            y1={innerHeight}
            y2={innerHeight}
            stroke="currentColor"
          />
        </g>
      </svg>
      <figcaption className="visually-hidden">
        {`Histogram of ${label}: ${histogram.bins
          .map((bin) => `${bin.count} observation(s) between ${bin.x0.toFixed(2)} and ${bin.x1.toFixed(2)}`)
          .join('; ')}.`}
      </figcaption>
    </figure>
  )
}
