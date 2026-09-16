import { useRef } from 'react'
import type { CorrelationDesign } from '../../models/CorrelationDesign'
import type { PearsonCorrelationRegressionResult } from '../../statistics/types'
import { ScatterPlot } from '../../components/charts/ScatterPlot'
import {
  downloadDataUrl,
  exportSvgAsDataUrl,
  exportSvgAsPngDataUrl,
} from '../../components/charts/exportChart'
import { formatPValue } from '../report/formatPValue'
import { formatStatistic } from '../report/formatStatistic'
import { generateCorrelationInterpretationText } from './generateCorrelationInterpretationText'

export interface CorrelationResultsViewProps {
  design: CorrelationDesign
  data: { x: number[]; y: number[] }
  result: PearsonCorrelationRegressionResult
  onExit: () => void
}

/**
 * Milestone 10's results page for the correlation/simple-linear-regression
 * analysis: raw scatter plot (with an optional fitted-line overlay), the
 * Pearson correlation (r, its CI, and p-value), the regression fit
 * (slope/intercept, the slope's CI, R-squared), and a non-causal
 * interpretation. Mirrors `CategoricalResultsView`/`AnovaResultsView`'s
 * section structure and SVG/PNG export pattern, but is otherwise a fully
 * separate component - there is no group-comparison design/dataset/analysis
 * involved anywhere in this milestone.
 */
export function CorrelationResultsView({
  design,
  data,
  result,
  onExit,
}: CorrelationResultsViewProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const xLabel = [design.xVariable.name, design.xVariable.unit && `(${design.xVariable.unit})`]
    .filter(Boolean)
    .join(' ')
  const yLabel = [design.yVariable.name, design.yVariable.unit && `(${design.yVariable.unit})`]
    .filter(Boolean)
    .join(' ')

  const points = data.x.map((x, i) => ({ x, y: data.y[i] }))
  const interpretationText = generateCorrelationInterpretationText(design, result)

  function findSvg(): SVGSVGElement | null {
    return chartContainerRef.current?.querySelector('svg') ?? null
  }

  function handleExportSvg() {
    const svg = findSvg()
    if (!svg) return
    downloadDataUrl(exportSvgAsDataUrl(svg), 'rigor-scatter-plot.svg')
  }

  async function handleExportPng() {
    const svg = findSvg()
    if (!svg) return
    const dataUrl = await exportSvgAsPngDataUrl(svg, { scale: 2 })
    downloadDataUrl(dataUrl, 'rigor-scatter-plot.png')
  }

  return (
    <article aria-labelledby="correlation-results-title">
      <h2 id="correlation-results-title">Your results</h2>

      {design.researchQuestion && (
        <section aria-labelledby="correlation-question-title">
          <h3 id="correlation-question-title">Your question</h3>
          <p>{design.researchQuestion}</p>
        </section>
      )}

      <section aria-labelledby="correlation-data-title">
        <h3 id="correlation-data-title">Your data</h3>
        <p>
          n = {result.n} {result.n === 1 ? 'observation' : 'observations'}
        </p>
        <div ref={chartContainerRef} className="chart-container">
          <ScatterPlot
            points={points}
            xLabel={xLabel || 'X'}
            yLabel={yLabel || 'Y'}
            regressionLine={{ slope: result.regression.slope, intercept: result.regression.intercept }}
          />
        </div>
        <div className="wizard-nav">
          <button type="button" onClick={handleExportSvg}>
            Export chart as SVG
          </button>
          <button type="button" onClick={() => void handleExportPng()}>
            Export chart as PNG
          </button>
        </div>
      </section>

      <section aria-labelledby="correlation-test-result-title">
        <h3 id="correlation-test-result-title">Correlation</h3>
        <dl className="results-stats">
          <div>
            <dt>Pearson r</dt>
            <dd>{formatStatistic(result.correlation.r, 3)}</dd>
          </div>
          <div>
            <dt>95% CI for r</dt>
            <dd>
              {result.correlation.ci95Low !== null && result.correlation.ci95High !== null
                ? `${formatStatistic(result.correlation.ci95Low, 3)} to ${formatStatistic(result.correlation.ci95High, 3)}`
                : 'Not available (needs at least 4 observations)'}
            </dd>
          </div>
          <div>
            <dt>P-value</dt>
            <dd>{formatPValue(result.correlation.pValue)}</dd>
          </div>
        </dl>

        <h3>Regression</h3>
        <dl className="results-stats">
          <div>
            <dt>Slope</dt>
            <dd>
              {formatStatistic(result.regression.slope)} (95% CI:{' '}
              {formatStatistic(result.regression.slopeCi95Low)} to{' '}
              {formatStatistic(result.regression.slopeCi95High)})
            </dd>
          </div>
          <div>
            <dt>Intercept</dt>
            <dd>{formatStatistic(result.regression.intercept)}</dd>
          </div>
          <div>
            <dt>R-squared</dt>
            <dd>{formatStatistic(result.regression.rSquared, 3)}</dd>
          </div>
          <div>
            <dt>P-value</dt>
            <dd>{formatPValue(result.regression.pValue)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="correlation-interpretation-title">
        <h3 id="correlation-interpretation-title">Interpretation</h3>
        <p>{interpretationText}</p>
      </section>

      <div className="wizard-nav">
        <button type="button" onClick={onExit} className="wizard-back">
          Back to home
        </button>
      </div>
    </article>
  )
}
