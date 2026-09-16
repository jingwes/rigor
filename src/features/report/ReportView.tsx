import type { AnalysisReportContext } from '../results/AnalysisFlow'
import { describeDesign } from '../experiment-design/describeDesign'
import { DotPlot } from '../../components/charts/DotPlot'
import { PairedDotPlot } from '../../components/charts/PairedDotPlot'
import { formatPValue } from './formatPValue'
import { formatStatistic } from './formatStatistic'
import { generateInterpretationText } from './generateInterpretationText'
import { generateMethodsText } from './generateMethodsText'

export interface ReportViewProps {
  context: AnalysisReportContext
  onClose: () => void
}

const TEST_DISPLAY_NAME = {
  'welch-two-sample-t-test': "Welch's two-sample t-test (two-sided)",
  'paired-t-test': 'Paired-samples t-test (two-sided)',
} as const

/**
 * Milestone 6: a dedicated, print-friendly report view. Reachable from the
 * results page ("View printable report"); relies entirely on the browser's
 * native print-to-PDF (`window.print()`) rather than a PDF library. Per the
 * Milestone 6 scope, this OMITS the "Analysis history" section the full
 * project spec eventually calls for - analysis-plan locking/audit history
 * is Milestone 11 and doesn't exist yet, so nothing here fakes it.
 */
export function ReportView({ context, onClose }: ReportViewProps) {
  const {
    design,
    dataset,
    analysis,
    groupALabel,
    groupBLabel,
    valuesA,
    valuesB,
    normalityA,
    normalityB,
    excludedObservationCount,
  } = context

  const summaryLines = describeDesign(design)
  const isPaired = analysis.analysisType === 'paired-t-test'
  const methodsText = generateMethodsText({
    design,
    analysis,
    groupALabel,
    groupBLabel,
    excludedObservationCount,
  })
  const interpretationText = generateInterpretationText({
    design,
    analysis,
    groupALabel,
    groupBLabel,
  })

  const excludedIssues = dataset.issues.filter((issue) => issue.severity === 'excluded')
  const warningIssues = dataset.issues.filter((issue) => issue.severity === 'warning')

  return (
    <article className="printable-report" aria-labelledby="report-title">
      <div className="report-controls no-print">
        <button type="button" onClick={() => window.print()} className="primary-action">
          Print / save as PDF
        </button>
        <button type="button" onClick={onClose} className="wizard-back">
          Back to results
        </button>
      </div>

      <h1 id="report-title">Rigor analysis report</h1>
      <p className="wizard-note">
        Generated {new Date().toISOString()} by {__APP_NAME__.charAt(0).toUpperCase()}
        {__APP_NAME__.slice(1)} v{__APP_VERSION__}.
      </p>

      <section aria-labelledby="report-question-title">
        <h2 id="report-question-title">Research question</h2>
        <p>{design.researchQuestion || 'Not specified.'}</p>
      </section>

      <section aria-labelledby="report-design-title">
        <h2 id="report-design-title">Experimental design</h2>
        <dl className="summary-list">
          {summaryLines.map((line) => (
            <div className="summary-row" key={line.label}>
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="report-data-processing-title">
        <h2 id="report-data-processing-title">Data processing</h2>
        <p>
          {dataset.rows.length} row{dataset.rows.length === 1 ? '' : 's'} were entered.{' '}
          {excludedIssues.length > 0
            ? `${excludedIssues.length} value(s) across the dataset were excluded from analysis ` +
              'due to a validation problem.'
            : 'No values were excluded.'}{' '}
          {warningIssues.length > 0
            ? `${warningIssues.length} warning(s) were flagged but did not cause exclusion.`
            : 'No warnings were flagged.'}
        </p>
        {excludedIssues.length > 0 && (
          <ul>
            {excludedIssues.map((issue, index) => (
              <li key={index}>{issue.message}</li>
            ))}
          </ul>
        )}
        <p>
          There is no user-driven data-exclusion feature in this version of Rigor - the
          exclusions above are only ones this app's own validation flagged automatically while
          parsing your data.
        </p>
      </section>

      <section aria-labelledby="report-visualization-title">
        <h2 id="report-visualization-title">Visualization</h2>
        <p>
          Chart type: {isPaired ? 'paired dot plot' : 'dot plot'} of raw observations, with a
          mean and 95% confidence interval overlay per {isPaired ? 'condition' : 'group'}.
        </p>
        {isPaired ? (
          <PairedDotPlot
            pairs={valuesA.map((before, i) => ({ id: `pair-${i}`, before, after: valuesB[i] }))}
            beforeLabel={groupALabel}
            afterLabel={groupBLabel}
            intervalType="ci95"
          />
        ) : (
          <DotPlot
            groups={[
              { label: groupALabel, values: valuesA },
              { label: groupBLabel, values: valuesB },
            ]}
            intervalType="ci95"
          />
        )}
      </section>

      <section aria-labelledby="report-analysis-title">
        <h2 id="report-analysis-title">Statistical analysis</h2>
        <dl className="results-stats">
          <div>
            <dt>Test</dt>
            <dd>{TEST_DISPLAY_NAME[analysis.analysisType]}</dd>
          </div>
          <div>
            <dt>Mean difference</dt>
            <dd>
              {formatStatistic(analysis.result.meanDifference)}
              {design.outcome.unit ? ` ${design.outcome.unit}` : ''} (95% CI:{' '}
              {formatStatistic(analysis.result.meanDifferenceCi95Low)} to{' '}
              {formatStatistic(analysis.result.meanDifferenceCi95High)}
              {design.outcome.unit ? ` ${design.outcome.unit}` : ''})
            </dd>
          </div>
          <div>
            <dt>Effect size</dt>
            <dd>
              {analysis.result.effectSize === null
                ? 'not available'
                : `${formatStatistic(analysis.result.effectSize)} (${analysis.result.effectSizeMethod})`}
            </dd>
          </div>
          <div>
            <dt>Test statistic</dt>
            <dd>
              t = {formatStatistic(analysis.result.tStatistic)}, df ={' '}
              {formatStatistic(analysis.result.degreesOfFreedom)}
            </dd>
          </div>
          <div>
            <dt>P-value</dt>
            <dd>{formatPValue(analysis.result.pValue)}</dd>
          </div>
        </dl>

        <h3>Assumptions and checks (diagnostic only, does not determine the test used)</h3>
        {[
          { label: groupALabel, diagnostics: normalityA },
          { label: groupBLabel, diagnostics: normalityB },
        ].map(({ label, diagnostics }) => (
          <p key={label}>
            {label}: {diagnostics ? (
              <>
                n = {diagnostics.n}, Shapiro-Wilk W ={' '}
                {diagnostics.shapiroWilkW === null ? 'not available' : diagnostics.shapiroWilkW.toFixed(3)},
                P ={' '}
                {diagnostics.shapiroWilkPValue === null
                  ? 'not available'
                  : formatPValue(diagnostics.shapiroWilkPValue)}
                , skewness ={' '}
                {diagnostics.skewness === null ? 'not available' : diagnostics.skewness.toFixed(3)}.
                {diagnostics.n < 20 && (
                  <>
                    {' '}
                    With this sample size, there is limited information for assessing the shape of
                    the underlying population distribution.
                  </>
                )}
              </>
            ) : (
              'diagnostics not available.'
            )}
          </p>
        ))}
      </section>

      <section aria-labelledby="report-methods-title">
        <h2 id="report-methods-title">Methods</h2>
        <p>{methodsText}</p>
      </section>

      <section aria-labelledby="report-interpretation-title">
        <h2 id="report-interpretation-title">Interpretation</h2>
        <p>{interpretationText}</p>
      </section>

      <section aria-labelledby="report-software-title">
        <h2 id="report-software-title">Software</h2>
        <p>
          {__APP_NAME__.charAt(0).toUpperCase()}
          {__APP_NAME__.slice(1)} v{__APP_VERSION__} (open-source, browser-based; Python/SciPy run
          via Pyodide, entirely client-side - no data leaves your browser).
        </p>
      </section>
    </article>
  )
}
