import { useMemo, useRef, useState } from 'react'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type { NormalityDiagnosticsResult, OneWayAnovaResult } from '../../statistics/types'
import { describeDesign } from '../experiment-design/describeDesign'
import { DotPlot } from '../../components/charts/DotPlot'
import { IntervalTypeSelector } from '../../components/charts/IntervalTypeSelector'
import { ChartCustomizationPanel } from '../../components/charts/ChartCustomizationPanel'
import {
  DEFAULT_CHART_CUSTOMIZATION,
  type ChartCustomizationOptions,
  type IntervalType,
} from '../../components/charts/types'
import {
  downloadDataUrl,
  exportSvgAsDataUrl,
  exportSvgAsPngDataUrl,
} from '../../components/charts/exportChart'
import { formatPValue } from '../report/formatPValue'
import { formatStatistic } from '../report/formatStatistic'
import { generateInterpretationText } from '../report/generateInterpretationText'
import { NormalityDiagnosticsSection, type GroupNormalityData } from './NormalityDiagnosticsSection'

export type AnovaGroupNormalityState =
  | { status: 'loading' }
  | { status: 'ready'; result: NormalityDiagnosticsResult }
  | { status: 'error'; message: string }

export interface AnovaResultsViewProps {
  design: ExperimentDesign
  analysis: { analysisType: 'one-way-anova'; result: OneWayAnovaResult }
  /** The exact groups (label + post-exclusion values) sent to the worker. */
  groups: { label: string; values: number[] }[]
  /** Normality diagnostics per group, keyed by group label. */
  normalityByGroup: Record<string, AnovaGroupNormalityState>
  onOpenReport: () => void
}

/**
 * Milestone 8's results page for a one-way ANOVA (3+ independent continuous
 * groups). Mirrors `ResultsView`'s section structure and philosophy - "Your
 * experiment", "Your data", the test result(s), "Assumptions and checks",
 * "Interpretation" - but keeps the OMNIBUS test and the POST-HOC PAIRWISE
 * comparisons in clearly separate, separately-labeled sections (per the
 * project spec's Section 19), and always shows Holm-Bonferroni-ADJUSTED
 * p-values as the pairwise result, never the raw ones, with the required
 * "adjusted for multiple testing" explanation next to them.
 *
 * There is deliberately no "Save project" action here yet (unlike the
 * 2-group `ResultsView`) - the Milestone 6 `.rigor.json` project-file schema
 * only describes 2-group analyses, and extending that schema is out of
 * scope for this milestone; "View printable report" is still available.
 */
export function AnovaResultsView({
  design,
  analysis,
  groups,
  normalityByGroup,
  onOpenReport,
}: AnovaResultsViewProps) {
  const [intervalType, setIntervalType] = useState<IntervalType>('ci95')
  const [customization, setCustomization] = useState<ChartCustomizationOptions>(() => ({
    ...DEFAULT_CHART_CUSTOMIZATION,
    xAxisTitle: 'Group',
    yAxisTitle: design.outcome.name || undefined,
    yAxisUnit: design.outcome.unit,
  }))
  const chartContainerRef = useRef<HTMLDivElement>(null)

  const summaryLines = useMemo(() => describeDesign(design), [design])
  const allValues = useMemo(() => groups.flatMap((g) => g.values), [groups])
  const groupKeys = useMemo(() => groups.map((g) => g.label), [groups])

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

  const normalityGroups: GroupNormalityData[] = groups.map((group) => {
    const state = normalityByGroup[group.label]
    return {
      label: group.label,
      values: group.values,
      diagnostics: state?.status === 'ready' ? state.result : null,
      error: state?.status === 'error' ? state.message : undefined,
    }
  })

  const { omnibus, pairwiseComparisons } = analysis.result

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
        <IntervalTypeSelector value={intervalType} onChange={setIntervalType} />
        <div ref={chartContainerRef} className="chart-container">
          <DotPlot groups={groups} intervalType={intervalType} customization={customization} />
        </div>
        <div className="wizard-nav">
          <button type="button" onClick={handleExportSvg}>
            Export chart as SVG
          </button>
          <button type="button" onClick={() => void handleExportPng()}>
            Export chart as PNG
          </button>
        </div>
        <ChartCustomizationPanel
          value={customization}
          onChange={setCustomization}
          groupKeys={groupKeys}
          values={allValues}
        />
      </section>

      <section aria-labelledby="omnibus-title">
        <h3 id="omnibus-title">Overall (omnibus) test</h3>
        <p>
          This tests whether there is any difference among the {groups.length} groups at all - it
          does not say which specific groups differ. See "Post-hoc pairwise comparisons" below for
          that.
        </p>
        <dl className="results-stats">
          <div>
            <dt>Test</dt>
            <dd>Welch's (unequal-variance) one-way ANOVA</dd>
          </div>
          <div>
            <dt>F statistic</dt>
            <dd>{formatStatistic(omnibus.fStatistic)}</dd>
          </div>
          <div>
            <dt>Degrees of freedom</dt>
            <dd>
              {formatStatistic(omnibus.numeratorDf)}, {formatStatistic(omnibus.denominatorDf)}
            </dd>
          </div>
          <div>
            <dt>P-value</dt>
            <dd>{formatPValue(omnibus.pValue)}</dd>
          </div>
        </dl>
        <p className="wizard-note">
          Welch's version of the one-way ANOVA was used rather than the classic equal-variance
          version because it does not assume the groups have equal variances - consistent with
          this app's use of Welch's t-test (rather than Student's) for two groups. A variance-
          explained effect size (such as eta-squared) is not reported here: no formula for that
          statistic under Welch's unequal-variance ANOVA could be independently validated with
          confidence, so it has been omitted rather than guessed.
        </p>
      </section>

      <section aria-labelledby="pairwise-title">
        <h3 id="pairwise-title">Post-hoc pairwise comparisons</h3>
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
                  {pair.effectSize === null ? 'not available (zero variance)' : formatStatistic(pair.effectSize)}
                </td>
                <td>{formatPValue(pair.pValueAdjusted)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <NormalityDiagnosticsSection groups={normalityGroups} />

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
