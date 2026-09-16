import { useMemo, useRef, useState } from 'react'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type {
  NormalityDiagnosticsResult,
  PairedTTestResult,
  WelchTwoSampleTTestResult,
} from '../../statistics/types'
import { describeDesign } from '../experiment-design/describeDesign'
import { DotPlot } from '../../components/charts/DotPlot'
import { PairedDotPlot } from '../../components/charts/PairedDotPlot'
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
import type { MethodsAnalysis } from '../report/generateMethodsText'
import { NormalityDiagnosticsSection } from './NormalityDiagnosticsSection'

const EFFECT_SIZE_LABEL: Record<
  WelchTwoSampleTTestResult['effectSizeMethod'] | PairedTTestResult['effectSizeMethod'],
  string
> = {
  hedges_g: "Hedges' g",
  cohens_d_z: 'Cohen’s d₂ (paired)',
}

const TEST_DISPLAY_NAME: Record<MethodsAnalysis['analysisType'], string> = {
  'welch-two-sample-t-test': "Welch's two-sample t-test",
  'paired-t-test': 'Paired-samples t-test',
}

export interface ResultsViewProps {
  design: ExperimentDesign
  analysis: MethodsAnalysis
  groupALabel: string
  groupBLabel: string
  /** Post-exclusion values actually sent to the worker for arm/condition "a". */
  valuesA: number[]
  /** Post-exclusion values actually sent to the worker for arm/condition "b". */
  valuesB: number[]
  normalityA: NormalityDiagnosticsResult | null
  normalityAError?: string
  normalityB: NormalityDiagnosticsResult | null
  normalityBError?: string
  onSaveProject: (settings: {
    intervalType: IntervalType
    chartCustomization: ChartCustomizationOptions
  }) => void
  onOpenReport: () => void
}

/**
 * Milestone 6's results page: the six-section structure the project's spec
 * requires, in order - "Your experiment", "Your data", "Estimated effect",
 * "Statistical analysis", "Assumptions and checks", "Interpretation". The
 * estimate/effect size is shown BEFORE the p-value (never the reverse), and
 * p-values are always run through `formatPValue` (never "P = 0.000").
 */
export function ResultsView({
  design,
  analysis,
  groupALabel,
  groupBLabel,
  valuesA,
  valuesB,
  normalityA,
  normalityAError,
  normalityB,
  normalityBError,
  onSaveProject,
  onOpenReport,
}: ResultsViewProps) {
  const [intervalType, setIntervalType] = useState<IntervalType>('ci95')
  const [customization, setCustomization] = useState<ChartCustomizationOptions>(
    () => ({
      ...DEFAULT_CHART_CUSTOMIZATION,
      xAxisTitle: design.groups.count >= 1 ? 'Group' : undefined,
      yAxisTitle: design.outcome.name || undefined,
      yAxisUnit: design.outcome.unit,
    }),
  )
  const chartContainerRef = useRef<HTMLDivElement>(null)

  const summaryLines = useMemo(() => describeDesign(design), [design])
  const isPaired = analysis.analysisType === 'paired-t-test'
  const allValues = useMemo(() => [...valuesA, ...valuesB], [valuesA, valuesB])

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

  const interpretationText = generateInterpretationText({
    design,
    analysis,
    groupALabel,
    groupBLabel,
  })

  const effectSizeMethod = analysis.result.effectSizeMethod
  const effectSizeLabel = EFFECT_SIZE_LABEL[effectSizeMethod]

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
          {isPaired ? (
            <PairedDotPlot
              pairs={valuesA.map((before, i) => ({
                id: `pair-${i}`,
                before,
                after: valuesB[i],
              }))}
              beforeLabel={groupALabel}
              afterLabel={groupBLabel}
              intervalType={intervalType}
              customization={customization}
            />
          ) : (
            <DotPlot
              groups={[
                { label: groupALabel, values: valuesA },
                { label: groupBLabel, values: valuesB },
              ]}
              intervalType={intervalType}
              customization={customization}
            />
          )}
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
          groupKeys={[groupALabel, groupBLabel]}
          values={allValues}
        />
      </section>

      <section aria-labelledby="estimated-effect-title">
        <h3 id="estimated-effect-title">Estimated effect</h3>
        <dl className="results-stats">
          <div>
            <dt>Mean difference ({groupALabel} − {groupBLabel})</dt>
            <dd>
              {formatStatistic(analysis.result.meanDifference)}
              {design.outcome.unit ? ` ${design.outcome.unit}` : ''}
            </dd>
          </div>
          <div>
            <dt>95% confidence interval</dt>
            <dd>
              {formatStatistic(analysis.result.meanDifferenceCi95Low)} to{' '}
              {formatStatistic(analysis.result.meanDifferenceCi95High)}
              {design.outcome.unit ? ` ${design.outcome.unit}` : ''}
            </dd>
          </div>
          <div>
            <dt>Effect size ({effectSizeLabel})</dt>
            <dd>
              {analysis.result.effectSize === null
                ? 'not available (zero variance)'
                : formatStatistic(analysis.result.effectSize)}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="statistical-analysis-title">
        <h3 id="statistical-analysis-title">Statistical analysis</h3>
        <dl className="results-stats">
          <div>
            <dt>Test</dt>
            <dd>{TEST_DISPLAY_NAME[analysis.analysisType]}</dd>
          </div>
          <div>
            <dt>Test statistic (t)</dt>
            <dd>{formatStatistic(analysis.result.tStatistic)}</dd>
          </div>
          <div>
            <dt>Degrees of freedom</dt>
            <dd>{formatStatistic(analysis.result.degreesOfFreedom)}</dd>
          </div>
          <div>
            <dt>P-value</dt>
            <dd>{formatPValue(analysis.result.pValue)}</dd>
          </div>
        </dl>
      </section>

      <NormalityDiagnosticsSection
        groups={[
          { label: groupALabel, values: valuesA, diagnostics: normalityA, error: normalityAError },
          { label: groupBLabel, values: valuesB, diagnostics: normalityB, error: normalityBError },
        ]}
      />

      <section aria-labelledby="interpretation-title">
        <h3 id="interpretation-title">Interpretation</h3>
        <p>{interpretationText}</p>
      </section>

      <div className="wizard-nav">
        <button
          type="button"
          className="primary-action"
          onClick={() => onSaveProject({ intervalType, chartCustomization: customization })}
        >
          Save project (.rigor.json)
        </button>
        <button type="button" onClick={onOpenReport}>
          View printable report
        </button>
      </div>
    </article>
  )
}
