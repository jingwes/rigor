import { useEffect, useMemo, useState } from 'react'
import type { Dataset } from '../../models/Dataset'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type { ProjectAnalysisResult, RigorProject } from '../../models/ProjectFile'
import { PROJECT_FILE_SCHEMA_VERSION } from '../../models/ProjectFile'
import { recommendAnalysis } from '../../rules/analysisRules'
import { analyzeReplicationStructure } from '../../rules/replicationRules'
import type {
  NormalityDiagnosticsResult,
  PairedTTestResult,
  WelchTwoSampleTTestResult,
} from '../../statistics/types'
import {
  onStatisticsProgress,
  runStatistics,
  type LoadingStage,
} from '../../statistics/workerClient'
import type { ChartCustomizationOptions, IntervalType } from '../../components/charts/types'
import {
  aggregateByExperimentalUnit,
  summarizeAggregation,
  type NestedAggregationResult,
} from '../analysis-plan/aggregateByExperimentalUnit'
import {
  buildStatisticsRequest,
  buildStatisticsRequestFromAggregatedUnits,
  type BuildStatisticsRequestResult,
} from '../analysis-plan/buildStatisticsRequest'
import { downloadProjectFile } from '../report/exportProject'
import type { MethodsAnalysis } from '../report/generateMethodsText'
import { AnalysisExplanation } from './AnalysisExplanation'
import { PseudoreplicationCheckStep } from './PseudoreplicationCheckStep'
import { ResultsView } from './ResultsView'

export interface AnalysisFlowProps {
  design: ExperimentDesign
  dataset: Dataset
  onExit: () => void
  onOpenReport: (context: AnalysisReportContext) => void
}

/** Everything the printable report view needs, handed up once results exist. */
export interface AnalysisReportContext {
  design: ExperimentDesign
  dataset: Dataset
  analysis: MethodsAnalysis
  groupALabel: string
  groupBLabel: string
  valuesA: number[]
  valuesB: number[]
  normalityA?: NormalityDiagnosticsResult
  normalityB?: NormalityDiagnosticsResult
  excludedObservationCount: number
  /**
   * Milestone 7: present only when the analysis ran on aggregated
   * (technical-replicate-averaged) experimental-unit values rather than raw
   * independent-groups/paired rows - the audit record of that decision.
   */
  aggregation?: NestedAggregationResult
}

const IMPLEMENTED_ANALYSIS_TYPES = new Set(['welch-two-sample-t-test', 'paired-t-test'])

const LOADING_STAGE_LABEL: Record<LoadingStage, string> = {
  idle: 'Preparing the statistics engine…',
  'loading-pyodide': 'Loading the statistics engine (this can take a few seconds the first time)…',
  'loading-packages': 'Loading numerical libraries…',
  'installing-statistics-module': 'Preparing the analysis…',
  ready: 'Running the analysis…',
}

type NormalityState =
  | { status: 'loading' }
  | { status: 'ready'; result: NormalityDiagnosticsResult }
  | { status: 'error'; message: string }

type FlowState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready'
      analysis: MethodsAnalysis
      normalityA: NormalityState
      normalityB: NormalityState
    }

function excludedRowCount(dataset: Dataset): number {
  const rowIds = new Set<string>()
  for (const issue of dataset.issues) {
    if (issue.severity === 'excluded' && issue.rowId) rowIds.add(issue.rowId)
  }
  return rowIds.size
}

function describeNestedRelationshipUnsupported(design: ExperimentDesign): string {
  const unitLabel = design.experimentalUnit.label.trim() || 'experimental unit'
  return (
    'Your dataset uses the nested / sub-measurement format (multiple sub-measurements per ' +
    `${unitLabel}), but your design's group relationship is "${design.relationship}", not ` +
    'independent groups. This version of Rigor only knows how to reconcile technical replicates ' +
    `with an independent-groups design (e.g. several ${unitLabel}s split into independent groups, ` +
    'with several sub-measurements taken from each one). More complex nested designs - paired, ' +
    'repeated-measures, or an explicitly nested relationship combined with sub-measurements - may ' +
    'require mixed-effects models, which this version does not yet support. Rather than guess a ' +
    "statistical treatment, Rigor is stopping here. Your data has still been kept, in case this " +
    'becomes available in a future version.'
  )
}

/**
 * Milestone 6's top-level orchestrator: decides (via the Milestone 2 rules
 * engine) whether a real analysis can run at all, builds the statistics
 * request (Milestone 4/6 adapter), calls the real Pyodide/SciPy worker, and
 * either renders real results or an honest explanation - never a fabricated
 * result and never a silent no-op.
 *
 * Milestone 7 additive extension: when the dataset uses the nested
 * (technical-replicate) format together with an "independent" study
 * relationship - the one combination this version knows how to reconcile
 * with sub-measurements - this checks for likely pseudoreplication, requires
 * an explicit "aggregate within experimental unit" confirmation when it
 * finds it, and only then feeds the aggregated per-unit values into the same
 * Welch two-sample t-test path used for independent-groups data. Any other
 * relationship paired with a nested dataset gets an honest "not yet
 * supported" explanation rather than a guessed treatment.
 */
export function AnalysisFlow({ design, dataset, onExit, onOpenReport }: AnalysisFlowProps) {
  const recommendation = useMemo(() => recommendAnalysis(design), [design])

  const isImplemented =
    recommendation.status === 'supported' &&
    recommendation.analysisType !== undefined &&
    IMPLEMENTED_ANALYSIS_TYPES.has(recommendation.analysisType)

  const isNestedDataset = dataset.format === 'nested'
  const isNestedIndependent = isNestedDataset && design.relationship === 'independent'
  const nestedUnsupportedRelationship = isNestedDataset && design.relationship !== 'independent'

  const replicationSummary = useMemo(() => {
    if (!isNestedIndependent) return undefined
    return analyzeReplicationStructure(dataset, { unitLabel: design.experimentalUnit.label })
  }, [dataset, design, isNestedIndependent])

  const [aggregationConfirmed, setAggregationConfirmed] = useState(false)

  const needsAggregationConfirmation =
    isNestedIndependent &&
    (replicationSummary?.isLikelyPseudoreplication ?? false) &&
    !aggregationConfirmed

  const aggregationResult: NestedAggregationResult | undefined = useMemo(() => {
    if (!isNestedIndependent) return undefined
    if ((replicationSummary?.isLikelyPseudoreplication ?? false) && !aggregationConfirmed) {
      return undefined
    }
    return summarizeAggregation(aggregateByExperimentalUnit(dataset))
  }, [isNestedIndependent, dataset, replicationSummary, aggregationConfirmed])

  const buildResult: BuildStatisticsRequestResult | undefined = useMemo(() => {
    if (!isImplemented || recommendation.status !== 'supported') return undefined
    const analysisType = recommendation.analysisType as
      | 'welch-two-sample-t-test'
      | 'paired-t-test'

    if (isNestedIndependent) {
      if (analysisType !== 'welch-two-sample-t-test' || !aggregationResult) return undefined
      return buildStatisticsRequestFromAggregatedUnits(design, aggregationResult.units)
    }

    return buildStatisticsRequest(design, dataset, analysisType)
  }, [design, dataset, isImplemented, recommendation, isNestedIndependent, aggregationResult])

  const [state, setState] = useState<FlowState>({ kind: 'loading' })
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('idle')

  useEffect(() => {
    if (!buildResult || buildResult.status !== 'ready') return
    return onStatisticsProgress(setLoadingStage)
  }, [buildResult])

  useEffect(() => {
    if (!buildResult || buildResult.status !== 'ready') return
    let cancelled = false

    async function run() {
      if (!buildResult || buildResult.status !== 'ready') return
      setState({ kind: 'loading' })
      const mainResponse = await runStatistics(buildResult.request)
      if (cancelled) return

      if (!mainResponse.success) {
        setState({ kind: 'error', message: mainResponse.error.message })
        return
      }

      const analysis = mainResponse.result as MethodsAnalysis
      setState({
        kind: 'ready',
        analysis,
        normalityA: { status: 'loading' },
        normalityB: { status: 'loading' },
      })

      const { a, b } = buildResult.request.payload

      const [normAResponse, normBResponse] = await Promise.all([
        runStatistics({ analysisType: 'normality-diagnostics', payload: { values: a } }),
        runStatistics({ analysisType: 'normality-diagnostics', payload: { values: b } }),
      ])
      if (cancelled) return

      setState({
        kind: 'ready',
        analysis,
        normalityA: normAResponse.success
          ? { status: 'ready', result: normAResponse.result.result as NormalityDiagnosticsResult }
          : { status: 'error', message: normAResponse.error.message },
        normalityB: normBResponse.success
          ? { status: 'ready', result: normBResponse.result.result as NormalityDiagnosticsResult }
          : { status: 'error', message: normBResponse.error.message },
      })
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [buildResult])

  if (nestedUnsupportedRelationship) {
    return (
      <AnalysisExplanation
        recommendation={recommendation}
        nestedDesignUnsupportedMessage={describeNestedRelationshipUnsupported(design)}
      />
    )
  }

  if (!isImplemented) {
    return (
      <AnalysisExplanation
        recommendation={recommendation}
        notYetImplemented={recommendation.status === 'supported'}
      />
    )
  }

  if (needsAggregationConfirmation && replicationSummary) {
    return (
      <PseudoreplicationCheckStep
        summary={replicationSummary}
        unitLabel={design.experimentalUnit.label.trim() || 'experimental unit'}
        onConfirm={() => setAggregationConfirmed(true)}
        onBack={onExit}
      />
    )
  }

  if (!buildResult || buildResult.status === 'insufficient-data') {
    return (
      <AnalysisExplanation
        recommendation={recommendation}
        insufficientDataMessage={buildResult?.message}
      />
    )
  }

  if (state.kind === 'loading') {
    return (
      <section aria-labelledby="analysis-loading-title" role="status">
        <h2 id="analysis-loading-title">Running your analysis</h2>
        <p>{LOADING_STAGE_LABEL[loadingStage]}</p>
      </section>
    )
  }

  if (state.kind === 'error') {
    return (
      <section aria-labelledby="analysis-error-title">
        <h2 id="analysis-error-title">The analysis couldn't be completed</h2>
        <p className="field-error">{state.message}</p>
        <div className="wizard-nav">
          <button type="button" onClick={onExit} className="wizard-back">
            Back to home
          </button>
        </div>
      </section>
    )
  }

  const { a: valuesA, b: valuesB } = buildResult.request.payload
  const excludedObservationCount = excludedRowCount(dataset)
  const aggregationForResult = isNestedIndependent ? aggregationResult : undefined

  function handleSaveProject(settings: {
    intervalType: IntervalType
    chartCustomization: ChartCustomizationOptions
  }) {
    if (state.kind !== 'ready' || !buildResult || buildResult.status !== 'ready') return

    const normalityByGroup: Record<string, NormalityDiagnosticsResult> = {}
    if (state.normalityA.status === 'ready') {
      normalityByGroup[buildResult.groupALabel] = state.normalityA.result
    }
    if (state.normalityB.status === 'ready') {
      normalityByGroup[buildResult.groupBLabel] = state.normalityB.result
    }

    const analysisForProject: ProjectAnalysisResult = {
      analysisType: state.analysis.analysisType,
      result: state.analysis.result as WelchTwoSampleTTestResult | PairedTTestResult,
      groupALabel: buildResult.groupALabel,
      groupBLabel: buildResult.groupBLabel,
      normalityDiagnosticsByGroup: normalityByGroup,
      aggregation: aggregationForResult,
    }

    const project: RigorProject = {
      schemaVersion: PROJECT_FILE_SCHEMA_VERSION,
      appVersion: __APP_VERSION__,
      projectMetadata: { createdAt: new Date().toISOString() },
      experimentDesign: design,
      dataset,
      analysis: analysisForProject,
      visualization: {
        intervalType: settings.intervalType,
        chartCustomization: settings.chartCustomization,
      },
    }

    downloadProjectFile(project)
  }

  function handleOpenReport() {
    if (state.kind !== 'ready' || !buildResult || buildResult.status !== 'ready') return
    onOpenReport({
      design,
      dataset,
      analysis: state.analysis,
      groupALabel: buildResult.groupALabel,
      groupBLabel: buildResult.groupBLabel,
      valuesA: buildResult.request.payload.a,
      valuesB: buildResult.request.payload.b,
      normalityA: state.normalityA.status === 'ready' ? state.normalityA.result : undefined,
      normalityB: state.normalityB.status === 'ready' ? state.normalityB.result : undefined,
      excludedObservationCount,
      aggregation: aggregationForResult,
    })
  }

  return (
    <ResultsView
      design={design}
      analysis={state.analysis}
      groupALabel={buildResult.groupALabel}
      groupBLabel={buildResult.groupBLabel}
      valuesA={valuesA}
      valuesB={valuesB}
      normalityA={state.normalityA.status === 'ready' ? state.normalityA.result : null}
      normalityAError={state.normalityA.status === 'error' ? state.normalityA.message : undefined}
      normalityB={state.normalityB.status === 'ready' ? state.normalityB.result : null}
      normalityBError={state.normalityB.status === 'error' ? state.normalityB.message : undefined}
      onSaveProject={handleSaveProject}
      onOpenReport={handleOpenReport}
      aggregation={aggregationForResult}
    />
  )
}
