import type { AnalysisReportContext } from '../results/AnalysisFlow'
import { describeDesign } from '../experiment-design/describeDesign'
import { DotPlot } from '../../components/charts/DotPlot'
import { PairedDotPlot } from '../../components/charts/PairedDotPlot'
import { CategoricalBarChart } from '../../components/charts/CategoricalBarChart'
import { formatPValue } from './formatPValue'
import { formatStatistic } from './formatStatistic'
import { generateInterpretationText } from './generateInterpretationText'
import { generateMethodsText } from './generateMethodsText'
import { describeAggregationSampleSize } from '../analysis-plan/aggregateByExperimentalUnit'

export interface ReportViewProps {
  context: AnalysisReportContext
  onClose: () => void
}

const TEST_DISPLAY_NAME = {
  'welch-two-sample-t-test': "Welch's two-sample t-test (two-sided)",
  'paired-t-test': 'Paired-samples t-test (two-sided)',
} as const

type TwoGroupContext = Extract<AnalysisReportContext, { kind: 'two-group' }>
type AnovaContext = Extract<AnalysisReportContext, { kind: 'one-way-anova' }>
type CategoricalContext = Extract<AnalysisReportContext, { kind: 'categorical-association' }>

/** The "Visualization" + "Statistical analysis" sections for a 2-group analysis. */
function TwoGroupAnalysisSections({ context }: { context: TwoGroupContext }) {
  const { design, analysis, groupALabel, groupBLabel, valuesA, valuesB, normalityA, normalityB } =
    context
  const isPaired = analysis.analysisType === 'paired-t-test'

  return (
    <>
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
    </>
  )
}

/**
 * Milestone 8: the "Visualization" + "Overall (omnibus) test" + "Post-hoc
 * pairwise comparisons" + "Assumptions and checks" sections for a one-way
 * ANOVA. The omnibus result and the pairwise comparisons are kept in
 * clearly separate sections, and only the Holm-Bonferroni-ADJUSTED
 * p-values are shown for the pairwise comparisons - never the raw ones -
 * with the required "adjusted for multiple testing" explanation.
 */
function AnovaAnalysisSections({ context }: { context: AnovaContext }) {
  const { design, analysis, groups, normalityByGroup } = context
  const { omnibus, pairwiseComparisons } = analysis.result

  return (
    <>
      <section aria-labelledby="report-visualization-title">
        <h2 id="report-visualization-title">Visualization</h2>
        <p>
          Chart type: dot plot of raw observations, with a mean and 95% confidence interval
          overlay per group ({groups.length} groups).
        </p>
        <DotPlot groups={groups} intervalType="ci95" />
      </section>

      <section aria-labelledby="report-omnibus-title">
        <h2 id="report-omnibus-title">Overall (omnibus) test</h2>
        <dl className="results-stats">
          <div>
            <dt>Test</dt>
            <dd>Welch's (unequal-variance) one-way ANOVA</dd>
          </div>
          <div>
            <dt>Test statistic</dt>
            <dd>
              F = {formatStatistic(omnibus.fStatistic)}, df = {formatStatistic(omnibus.numeratorDf)},{' '}
              {formatStatistic(omnibus.denominatorDf)}
            </dd>
          </div>
          <div>
            <dt>P-value</dt>
            <dd>{formatPValue(omnibus.pValue)}</dd>
          </div>
        </dl>
        <p>
          No variance-explained effect size (e.g. eta-squared) is reported for this omnibus test:
          no formula for that statistic under Welch's unequal-variance ANOVA could be
          independently validated with confidence, so it has been omitted rather than guessed.
        </p>
      </section>

      <section aria-labelledby="report-pairwise-title">
        <h2 id="report-pairwise-title">Post-hoc pairwise comparisons</h2>
        <p>
          Testing many pairs independently increases the chance of false-positive results. These
          comparisons have therefore been adjusted for multiple testing (Holm-Bonferroni
          correction). Only the adjusted p-values below should be interpreted as the result of
          each comparison.
        </p>
        <table className="results-table">
          <thead>
            <tr>
              <th scope="col">Groups compared</th>
              <th scope="col">Mean difference</th>
              <th scope="col">Effect size (Hedges' g)</th>
              <th scope="col">Adjusted P-value</th>
            </tr>
          </thead>
          <tbody>
            {pairwiseComparisons.map((pair) => (
              <tr key={`${pair.groupALabel}-${pair.groupBLabel}`}>
                <th scope="row">
                  {pair.groupALabel} vs {pair.groupBLabel}
                </th>
                <td>
                  {formatStatistic(pair.meanDifference)}
                  {design.outcome.unit ? ` ${design.outcome.unit}` : ''}
                </td>
                <td>
                  {pair.effectSize === null ? 'not available' : formatStatistic(pair.effectSize)}
                </td>
                <td>{formatPValue(pair.pValueAdjusted)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="report-assumptions-title">
        <h2 id="report-assumptions-title">
          Assumptions and checks (diagnostic only, does not determine the test used)
        </h2>
        {groups.map(({ label }) => {
          const diagnostics = normalityByGroup[label] ?? null
          return (
            <p key={label}>
              {label}: {diagnostics ? (
                <>
                  n = {diagnostics.n}, Shapiro-Wilk W ={' '}
                  {diagnostics.shapiroWilkW === null
                    ? 'not available'
                    : diagnostics.shapiroWilkW.toFixed(3)}
                  , P ={' '}
                  {diagnostics.shapiroWilkPValue === null
                    ? 'not available'
                    : formatPValue(diagnostics.shapiroWilkPValue)}
                  , skewness ={' '}
                  {diagnostics.skewness === null ? 'not available' : diagnostics.skewness.toFixed(3)}.
                  {diagnostics.n < 20 && (
                    <>
                      {' '}
                      With this sample size, there is limited information for assessing the shape
                      of the underlying population distribution.
                    </>
                  )}
                </>
              ) : (
                'diagnostics not available.'
              )}
            </p>
          )
        })}
      </section>
    </>
  )
}

/**
 * Milestone 9: the "Your data" (contingency table + bar chart) + "Test
 * result" sections for a chi-square/Fisher's-exact categorical-association
 * analysis. Mirrors `CategoricalResultsView`'s content, adapted for print.
 */
function CategoricalAnalysisSections({ context }: { context: CategoricalContext }) {
  const { design, analysis } = context
  const { table, chiSquare, fishersExact, testSelection } = analysis.result
  const is2x2 = table.rowLabels.length === 2 && table.colLabels.length === 2
  const usedFisher = testSelection.test === 'fishers-exact'

  return (
    <>
      <section aria-labelledby="report-visualization-title">
        <h2 id="report-visualization-title">Visualization</h2>
        <p>Chart type: bar chart of raw counts per group and outcome category.</p>
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
                {table.counts[rowIndex].map((count, colIndex) => (
                  <td key={table.colLabels[colIndex]}>{count}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <CategoricalBarChart
          groupLabels={table.rowLabels}
          categoryLabels={table.colLabels}
          counts={table.counts}
          outcomeName={design.outcome.name}
        />
      </section>

      <section aria-labelledby="report-analysis-title">
        <h2 id="report-analysis-title">Statistical analysis</h2>
        <p>{testSelection.reason}</p>
        <dl className="results-stats">
          {usedFisher && fishersExact ? (
            <div>
              <dt>Test</dt>
              <dd>Fisher's exact test - P-value: {formatPValue(fishersExact.pValue)}</dd>
            </div>
          ) : (
            <>
              <div>
                <dt>Test</dt>
                <dd>Chi-square test of association</dd>
              </div>
              <div>
                <dt>Test statistic</dt>
                <dd>
                  chi-square = {formatStatistic(chiSquare.chiSquare)}, df ={' '}
                  {chiSquare.degreesOfFreedom}
                </dd>
              </div>
              <div>
                <dt>P-value</dt>
                <dd>{formatPValue(chiSquare.pValue)}</dd>
              </div>
            </>
          )}
          <div>
            <dt>Cramer's V</dt>
            <dd>{formatStatistic(chiSquare.cramersV)}</dd>
          </div>
          {is2x2 && fishersExact && (
            <>
              <div>
                <dt>Odds ratio</dt>
                <dd>
                  {formatStatistic(fishersExact.oddsRatio)}
                  {fishersExact.oddsRatioCi95Low !== null && fishersExact.oddsRatioCi95High !== null
                    ? ` (95% CI: ${formatStatistic(fishersExact.oddsRatioCi95Low)} to ${formatStatistic(fishersExact.oddsRatioCi95High)})`
                    : ' (CI not available)'}
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
            </>
          )}
        </dl>
      </section>
    </>
  )
}

/**
 * Milestone 6: a dedicated, print-friendly report view. Reachable from the
 * results page ("View printable report"); relies entirely on the browser's
 * native print-to-PDF (`window.print()`) rather than a PDF library. Per the
 * Milestone 6 scope, this OMITS the "Analysis history" section the full
 * project spec eventually calls for - analysis-plan locking/audit history
 * is Milestone 11 and doesn't exist yet, so nothing here fakes it.
 *
 * Milestone 8 additive extension: `context.kind` selects between the
 * original 2-group report body and a one-way-ANOVA report body (see
 * `TwoGroupAnalysisSections`/`AnovaAnalysisSections` above) - the shared
 * chrome (research question, design summary, data processing, methods,
 * interpretation, software) is generated once, from whichever `analysis`
 * variant is actually present.
 */
export function ReportView({ context, onClose }: ReportViewProps) {
  const { design, dataset } = context

  const summaryLines = describeDesign(design)
  const methodsText =
    context.kind === 'two-group'
      ? generateMethodsText({
          design,
          analysis: context.analysis,
          groupALabel: context.groupALabel,
          groupBLabel: context.groupBLabel,
          excludedObservationCount: context.excludedObservationCount,
          aggregation: context.aggregation,
        })
      : generateMethodsText({
          design,
          analysis: context.analysis,
          excludedObservationCount: context.excludedObservationCount,
        })
  const interpretationText =
    context.kind === 'two-group'
      ? generateInterpretationText({
          design,
          analysis: context.analysis,
          groupALabel: context.groupALabel,
          groupBLabel: context.groupBLabel,
        })
      : generateInterpretationText({ design, analysis: context.analysis })

  const excludedIssues = dataset.issues.filter((issue) => issue.severity === 'excluded')
  const warningIssues = dataset.issues.filter((issue) => issue.severity === 'warning')

  const aggregation = context.kind === 'two-group' ? context.aggregation : undefined

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

      {aggregation && (
        <section aria-labelledby="report-aggregation-title">
          <h2 id="report-aggregation-title">Technical replicates</h2>
          <p>{describeAggregationSampleSize(aggregation, design.experimentalUnit.label)}</p>
        </section>
      )}

      {context.kind === 'two-group' && <TwoGroupAnalysisSections context={context} />}
      {context.kind === 'one-way-anova' && <AnovaAnalysisSections context={context} />}
      {context.kind === 'categorical-association' && (
        <CategoricalAnalysisSections context={context} />
      )}

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
