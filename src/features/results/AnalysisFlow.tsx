import { useEffect, useMemo, useState } from 'react'
import type { Dataset } from '../../models/Dataset'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type { ProjectAnalysisResult, RigorProject } from '../../models/ProjectFile'
import { PROJECT_FILE_SCHEMA_VERSION } from '../../models/ProjectFile'
import { recommendAnalysis } from '../../rules/analysisRules'
import { analyzeReplicationStructure } from '../../rules/replicationRules'
import type { NormalityDiagnosticsResult } from '../../statistics/types'
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
  buildOneWayAnovaRequest,
  buildStatisticsRequest,
  buildStatisticsRequestFromAggregatedUnits,
  type BuildOneWayAnovaRequestResult,
  type BuildStatisticsRequestResult,
} from '../analysis-plan/buildStatisticsRequest'
import { downloadProjectFile } from '../report/exportProject'
import type { MethodsAnalysis, TwoGroupMethodsAnalysis } from '../report/generateMethodsText'
import { AnalysisExplanation } from './AnalysisExplanation'
import { AnovaResultsView, type AnovaGroupNormalityState } from './AnovaResultsView'
import { PseudoreplicationCheckStep } from './PseudoreplicationCheckStep'
import { ResultsView } from './ResultsView'

export interface AnalysisFlowProps {
  design: ExperimentDesign
  dataset: Dataset
  onExit: () => void
  onOpenReport: (context: AnalysisReportContext) => void
}

/**
 * Everything the printable report view needs, handed up once results exist.
 * A discriminated union: the original 2-group shape (`kind: 'two-group'`,
 * unchanged from Milestone 6/7) or Milestone 8's 3+-group ANOVA shape
 * (`kind: 'one-way-anova'`) - `ReportView` branches on `kind`.
 */
export type AnalysisReportContext =
  | {
      kind: 'two-group'
      design: ExperimentDesign
      dataset: Dataset
      analysis: TwoGroupMethodsAnalysis
      groupALabel: string
      groupBLabel: string
      valuesA: number[]
      valuesB: number[]
      normalityA?: NormalityDiagnosticsResult
      normalityB?: NormalityDiagnosticsResult
      excludedObservationCount: number
      /**
       * Milestone 7: present only when the analysis ran on aggregated
       * (technical-replicate-averaged) experimental-unit values rather than
       * raw independent-groups/paired rows - the audit record of that
       * decision.
       */
      aggregation?: NestedAggregationResult
    }
  | {
      kind: 'one-way-anova'
      design: ExperimentDesign
      dataset: Dataset
      analysis: Extract<MethodsAnalysis, { analysisType: 'one-way-anova' }>
      /** The exact groups (label + post-exclusion values) sent to the worker. */
      groups: { label: string; values: number[] }[]
      /** Normality diagnostics per group, keyed by group label (only entries that finished successfully). */
      normalityByGroup: Record<string, NormalityDiagnosticsResult>
      excludedObservationCount: number
    }

const IMPLEMENTED_ANALYSIS_TYPES = new Set([
  'welch-two-sample-t-test',
  'paired-t-test',
  'one-way-anova',
])

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
      analysis: TwoGroupMethodsAnalysis
      normalityA: NormalityState
      normalityB: NormalityState
    }

/** Milestone 8: the one-way-ANOVA analog of `FlowState`, above. */
type AnovaFlowState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready'
      analysis: Extract<MethodsAnalysis, { analysisType: 'one-way-anova' }>
      normalityByGroup: Record<string, AnovaGroupNormalityState>
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

  const isTwoGroupAnalysis =
    isImplemented &&
    recommendation.status === 'supported' &&
    (recommendation.analysisType === 'welch-two-sample-t-test' ||
      recommendation.analysisType === 'paired-t-test')

  const isAnovaRecommended =
    recommendation.status === 'supported' && recommendation.analysisType === 'one-way-anova'

  const buildResult: BuildStatisticsRequestResult | undefined = useMemo(() => {
    if (!isTwoGroupAnalysis || recommendation.status !== 'supported') return undefined
    const analysisType = recommendation.analysisType as
      | 'welch-two-sample-t-test'
      | 'paired-t-test'

    if (isNestedIndependent) {
      if (analysisType !== 'welch-two-sample-t-test' || !aggregationResult) return undefined
      return buildStatisticsRequestFromAggregatedUnits(design, aggregationResult.units)
    }

    return buildStatisticsRequest(design, dataset, analysisType)
  }, [design, dataset, isTwoGroupAnalysis, recommendation, isNestedIndependent, aggregationResult])

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

      const analysis = mainResponse.result as TwoGroupMethodsAnalysis
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

  // --- Milestone 8: one-way ANOVA (3+ independent continuous groups) -------
  // A parallel, self-contained state machine alongside the 2-group one
  // above, rather than reshaping it - the 2-group path's types/behavior stay
  // untouched, and this only ever activates when the rules engine actually
  // recommends `'one-way-anova'`.
  const anovaBuildResult: BuildOneWayAnovaRequestResult | undefined = useMemo(() => {
    if (!isAnovaRecommended) return undefined
    // Milestone 8 only reconciles the independent-groups dataset format;
    // a nested (technical-replicate) dataset for 3+ groups isn't handled
    // yet (see Milestone 7's aggregation, which is 2-group-only) - fall
    // through to an honest "not enough data" explanation rather than a
    // guessed treatment.
    if (dataset.format !== 'independent-groups') return undefined
    return buildOneWayAnovaRequest(design, dataset)
  }, [isAnovaRecommended, design, dataset])

  const [anovaState, setAnovaState] = useState<AnovaFlowState>({ kind: 'loading' })
  const [anovaLoadingStage, setAnovaLoadingStage] = useState<LoadingStage>('idle')

  useEffect(() => {
    if (!anovaBuildResult || anovaBuildResult.status !== 'ready') return
    return onStatisticsProgress(setAnovaLoadingStage)
  }, [anovaBuildResult])

  useEffect(() => {
    if (!anovaBuildResult || anovaBuildResult.status !== 'ready') return
    let cancelled = false

    async function run() {
      if (!anovaBuildResult || anovaBuildResult.status !== 'ready') return
      setAnovaState({ kind: 'loading' })
      const response = await runStatistics(anovaBuildResult.request)
      if (cancelled) return

      if (!response.success) {
        setAnovaState({ kind: 'error', message: response.error.message })
        return
      }

      const analysis = response.result as Extract<
        MethodsAnalysis,
        { analysisType: 'one-way-anova' }
      >
      const { groups } = anovaBuildResult.request.payload
      setAnovaState({
        kind: 'ready',
        analysis,
        normalityByGroup: Object.fromEntries(
          groups.map((g) => [g.label, { status: 'loading' } as AnovaGroupNormalityState]),
        ),
      })

      const normalityResponses = await Promise.all(
        groups.map((g) =>
          runStatistics({ analysisType: 'normality-diagnostics', payload: { values: g.values } }),
        ),
      )
      if (cancelled) return

      const normalityByGroup: Record<string, AnovaGroupNormalityState> = {}
      groups.forEach((group, index) => {
        const response = normalityResponses[index]
        normalityByGroup[group.label] = response.success
          ? { status: 'ready', result: response.result.result as NormalityDiagnosticsResult }
          : { status: 'error', message: response.error.message }
      })
      setAnovaState({ kind: 'ready', analysis, normalityByGroup })
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [anovaBuildResult])

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

  if (isAnovaRecommended) {
    if (dataset.format !== 'independent-groups') {
      return (
        <AnalysisExplanation
          recommendation={recommendation}
          insufficientDataMessage="This version of Rigor's one-way ANOVA only supports the independent-groups data format - a nested/technical-replicate dataset for 3+ groups isn't reconciled yet."
        />
      )
    }

    if (!anovaBuildResult || anovaBuildResult.status === 'insufficient-data') {
      return (
        <AnalysisExplanation
          recommendation={recommendation}
          insufficientDataMessage={anovaBuildResult?.message}
        />
      )
    }

    if (anovaState.kind === 'loading') {
      return (
        <section aria-labelledby="analysis-loading-title" role="status">
          <h2 id="analysis-loading-title">Running your analysis</h2>
          <p>{LOADING_STAGE_LABEL[anovaLoadingStage]}</p>
        </section>
      )
    }

    if (anovaState.kind === 'error') {
      return (
        <section aria-labelledby="analysis-error-title">
          <h2 id="analysis-error-title">The analysis couldn't be completed</h2>
          <p className="field-error">{anovaState.message}</p>
          <div className="wizard-nav">
            <button type="button" onClick={onExit} className="wizard-back">
              Back to home
            </button>
          </div>
        </section>
      )
    }

    const anovaExcludedObservationCount = excludedRowCount(dataset)
    const anovaGroups = anovaBuildResult.request.payload.groups

    function handleOpenAnovaReport() {
      if (
        anovaState.kind !== 'ready' ||
        !anovaBuildResult ||
        anovaBuildResult.status !== 'ready'
      ) {
        return
      }
      const normalityByGroup: Record<string, NormalityDiagnosticsResult> = {}
      for (const [label, normState] of Object.entries(anovaState.normalityByGroup)) {
        if (normState.status === 'ready') normalityByGroup[label] = normState.result
      }
      onOpenReport({
        kind: 'one-way-anova',
        design,
        dataset,
        analysis: anovaState.analysis,
        groups: anovaGroups,
        normalityByGroup,
        excludedObservationCount: anovaExcludedObservationCount,
      })
    }

    return (
      <AnovaResultsView
        design={design}
        analysis={anovaState.analysis}
        groups={anovaGroups}
        normalityByGroup={anovaState.normalityByGroup}
        onOpenReport={handleOpenAnovaReport}
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
      result: state.analysis.result,
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
      kind: 'two-group',
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
