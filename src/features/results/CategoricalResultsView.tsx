import { useRef } from 'react'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import { describeDesign } from '../experiment-design/describeDesign'
import { CategoricalBarChart } from '../../components/charts/CategoricalBarChart'
import {
  downloadDataUrl,
  exportSvgAsDataUrl,
  exportSvgAsPngDataUrl,
} from '../../components/charts/exportChart'
import { formatPValue } from '../report/formatPValue'
import { formatStatistic } from '../report/formatStatistic'
import { generateInterpretationText } from '../report/generateInterpretationText'
import type { CategoricalAssociationAnalysis } from '../report/generateMethodsText'

export interface CategoricalResultsViewProps {
  design: ExperimentDesign
  analysis: { analysisType: 'categorical-association'; result: CategoricalAssociationAnalysis }
  onOpenReport: () => void
}

/**
 * Milestone 9's results page for a chi-square/Fisher's-exact
 * contingency-table analysis (binary/categorical outcome, 2+ independent
 * groups). Mirrors `AnovaResultsView`'s section structure - "Your
 * experiment", "Your data" (the table + bar chart), the test result, and
 * "Interpretation" - but there are no per-group normality diagnostics here
 * (that concept doesn't apply to a categorical outcome).
 */
export function CategoricalResultsView({
  design,
  analysis,
  onOpenReport,
}: CategoricalResultsViewProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const summaryLines = describeDesign(design)
  const { table, chiSquare, fishersExact, testSelection } = analysis.result
  const is2x2 = table.rowLabels.length === 2 && table.colLabels.length === 2
  const usedFisher = testSelection.test === 'fishers-exact'

  function findSvg(): SVGSVGElement | null {
    return chartContainerRef.current?.querySelector('svg') ?? null
  }

  function handleExportSvg() {
    const svg = findSvg()
    if (!svg) return
    downloadDataUrl(exportSvgAsDataUrl(svg), 'rigor-chart.svg')
  }

  async function handleExportPng() {
    const svg = findSvg()
    if (!svg) return
    const dataUrl = await exportSvgAsPngDataUrl(svg, { scale: 2 })
    downloadDataUrl(dataUrl, 'rigor-chart.png')
  }

  const interpretationText = generateInterpretationText({ design, analysis })

  return (
    <article aria-labelledby="results-title">
      <h2 id="results-title">Your results</h2>

      <section aria-labelledby="your-experiment-title">
        <h3 id="your-experiment-title">Your experiment</h3>
        <dl className="summary-list">
          {summaryLines.map((line) => (
            <div className="summary-row" key={line.label}>
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="your-data-title">
        <h3 id="your-data-title">Your data</h3>
        <table className="results-table">
          <thead>
            <tr>
              <th scope="col">Group</th>
              {table.colLabels.map((col) => (
                <th scope="col" key={col}>
                  {col}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {table.rowLabels.map((rowLabel, rowIndex) => {
              const rowCounts = table.counts[rowIndex]
              const rowTotal = rowCounts.reduce((sum, count) => sum + count, 0)
              return (
                <tr key={rowLabel}>
                  <th scope="row">{rowLabel}</th>
                  {rowCounts.map((count, colIndex) => (
                    <td key={table.colLabels[colIndex]}>{count}</td>
                  ))}
                  <td>{rowTotal}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div ref={chartContainerRef} className="chart-container">
          <CategoricalBarChart
            groupLabels={table.rowLabels}
            categoryLabels={table.colLabels}
            counts={table.counts}
            outcomeName={design.outcome.name}
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

      <section aria-labelledby="test-result-title">
        <h3 id="test-result-title">Test result</h3>
        <p>{testSelection.reason}</p>
        <dl className="results-stats">
          {usedFisher && fishersExact ? (
            <>
              <div>
                <dt>Test</dt>
                <dd>Fisher's exact test</dd>
              </div>
              <div>
                <dt>P-value</dt>
                <dd>{formatPValue(fishersExact.pValue)}</dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>Test</dt>
                <dd>Chi-square test of association</dd>
              </div>
              <div>
                <dt>Chi-square statistic</dt>
                <dd>{formatStatistic(chiSquare.chiSquare)}</dd>
              </div>
              <div>
                <dt>Degrees of freedom</dt>
                <dd>{chiSquare.degreesOfFreedom}</dd>
              </div>
              <div>
                <dt>P-value</dt>
                <dd>{formatPValue(chiSquare.pValue)}</dd>
              </div>
            </>
          )}
          <div>
            <dt>Cramer's V (strength of association)</dt>
            <dd>{formatStatistic(chiSquare.cramersV)}</dd>
          </div>
        </dl>

        {is2x2 && fishersExact && (
          <>
            <h4>2x2-specific measures</h4>
            <dl className="results-stats">
              <div>
                <dt>
                  Odds ratio ("{table.colLabels[0]}", {table.rowLabels[0]} vs {table.rowLabels[1]})
                </dt>
                <dd>
                  {formatStatistic(fishersExact.oddsRatio)}
                  {fishersExact.oddsRatioCi95Low !== null && fishersExact.oddsRatioCi95High !== null
                    ? ` (95% CI: ${formatStatistic(fishersExact.oddsRatioCi95Low)} to ${formatStatistic(fishersExact.oddsRatioCi95High)})`
                    : ' (CI not available - a table cell was zero)'}
                </dd>
              </div>
              <div>
                <dt>Risk difference</dt>
                <dd>
                  {formatStatistic(fishersExact.riskDifference)} (95% CI:{' '}
                  {formatStatistic(fishersExact.riskDifferenceCi95Low)} to{' '}
                  {formatStatistic(fishersExact.riskDifferenceCi95High)})
                </dd>
              </div>
            </dl>
          </>
        )}

        <details>
          <summary>Expected counts (used to choose the test)</summary>
          <table className="results-table">
            <thead>
              <tr>
                <th scope="col">Group</th>
                {table.colLabels.map((col) => (
                  <th scope="col" key={col}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rowLabels.map((rowLabel, rowIndex) => (
                <tr key={rowLabel}>
                  <th scope="row">{rowLabel}</th>
                  {chiSquare.expected[rowIndex].map((value, colIndex) => (
                    <td key={table.colLabels[colIndex]}>{formatStatistic(value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section aria-labelledby="interpretation-title">
        <h3 id="interpretation-title">Interpretation</h3>
        <p>{interpretationText}</p>
      </section>

      <div className="wizard-nav">
        <button type="button" onClick={onOpenReport}>
          View printable report
        </button>
      </div>
    </article>
  )
}
