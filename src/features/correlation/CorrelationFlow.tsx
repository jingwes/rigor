import { useEffect, useState } from 'react'
import type { CorrelationDesign } from '../../models/CorrelationDesign'
import type { PearsonCorrelationRegressionResult } from '../../statistics/types'
import {
  onStatisticsProgress,
  runStatistics,
  type LoadingStage,
} from '../../statistics/workerClient'
import { CorrelationResultsView } from './CorrelationResultsView'

export interface CorrelationFlowProps {
  design: CorrelationDesign
  data: { x: number[]; y: number[] }
  onExit: () => void
}

const LOADING_STAGE_LABEL: Record<LoadingStage, string> = {
  idle: 'Preparing the statistics engine…',
  'loading-pyodide': 'Loading the statistics engine (this can take a few seconds the first time)…',
  'loading-packages': 'Loading numerical libraries…',
  'installing-statistics-module': 'Preparing the analysis…',
  ready: 'Running the analysis…',
}

type FlowState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; result: PearsonCorrelationRegressionResult }

/**
 * Milestone 10's statistics-worker orchestrator for correlation/regression -
 * the correlation analog of `AnalysisFlow.tsx`'s per-analysis-type state
 * machines, but much smaller: there is exactly one analysis type here
 * (`pearson-correlation-regression`), no rules-engine recommendation to
 * consult (the student already told us, honestly, that this is a
 * correlation question in `CorrelationDesignFlow`), and no dataset
 * reconciliation step - `data` has already been validated by
 * `CorrelationDataEntry`/`validateCorrelationData`.
 */
export function CorrelationFlow({ design, data, onExit }: CorrelationFlowProps) {
  const [state, setState] = useState<FlowState>({ kind: 'loading' })
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('idle')

  useEffect(() => onStatisticsProgress(setLoadingStage), [])

  useEffect(() => {
    let cancelled = false

    async function run() {
      setState({ kind: 'loading' })
      const response = await runStatistics({
        analysisType: 'pearson-correlation-regression',
        payload: { x: data.x, y: data.y },
      })
      if (cancelled) return

      if (!response.success) {
        setState({ kind: 'error', message: response.error.message })
        return
      }

      const result = response.result.result as PearsonCorrelationRegressionResult
      setState({ kind: 'ready', result })
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [data])

  if (state.kind === 'loading') {
    return (
      <section aria-labelledby="correlation-loading-title" role="status">
        <h2 id="correlation-loading-title">Running your analysis</h2>
        <p>{LOADING_STAGE_LABEL[loadingStage]}</p>
      </section>
    )
  }

  if (state.kind === 'error') {
    return (
      <section aria-labelledby="correlation-error-title">
        <h2 id="correlation-error-title">The analysis couldn't be completed</h2>
        <p className="field-error">{state.message}</p>
        <div className="wizard-nav">
          <button type="button" onClick={onExit} className="wizard-back">
            Back to home
          </button>
        </div>
      </section>
    )
  }

  return (
    <CorrelationResultsView design={design} data={data} result={state.result} onExit={onExit} />
  )
}
