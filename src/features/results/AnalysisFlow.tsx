import { useEffect, useMemo, useState } from 'react'
import type { Dataset } from '../../models/Dataset'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type { ProjectAnalysisResult, RigorProject } from '../../models/ProjectFile'
import { PROJECT_FILE_SCHEMA_VERSION } from '../../models/ProjectFile'
import { recommendAnalysis } from '../../rules/analysisRules'
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
  buildStatisticsRequest,
  type BuildStatisticsRequestResult,
} from '../analysis-plan/buildStatisticsRequest'
import { downloadProjectFile } from '../report/exportProject'
import type { MethodsAnalysis } from '../report/generateMethodsText'
import { AnalysisExplanation } from './AnalysisExplanation'
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

/**
 * Milestone 6's top-level orchestrator: decides (via the Milestone 2 rules
 * engine) whether a real analysis can run at all, builds the statistics
 * request (Milestone 4/6 adapter), calls the real Pyodide/SciPy worker, and
 * either renders real results or an honest explanation - never a fabricated
 * result and never a silent no-op.
 */
export function AnalysisFlow({ design, dataset, onExit, onOpenReport }: AnalysisFlowProps) {
  const recommendation = useMemo(() => recommendAnalysis(design), [design])

  const isImplemented =
    recommendation.status === 'supported' &&
    recommendation.analysisType !== undefined &&
    IMPLEMENTED_ANALYSIS_TYPES.has(recommendation.analysisType)

  const buildResult: BuildStatisticsRequestResult | undefined = useMemo(() => {
    if (!isImplemented || recommendation.status !== 'supported') return undefined
    const analysisType = recommendation.analysisType as
      | 'welch-two-sample-t-test'
      | 'paired-t-test'
    return buildStatisticsRequest(design, dataset, analysisType)
  }, [design, dataset, isImplemented, recommendation])

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

  if (!isImplemented) {
    return (
      <AnalysisExplanation
        recommendation={recommendation}
        notYetImplemented={recommendation.status === 'supported'}
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
    />
  )
}
