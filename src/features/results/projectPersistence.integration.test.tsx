/**
 * Milestone 12 integration test: complete a full analysis (design -> data ->
 * lock -> results), save it (the same autosave `App.tsx`'s `openReport`
 * performs), then reopen it as a brand-new session would - reading straight
 * back out of IndexedDB, with no design/dataset/history passed in by hand -
 * and confirm the student lands back on the same results with the same
 * numbers, lock status, and history intact, without ever calling the
 * (fake) statistics worker a second time.
 *
 * `Session1` mirrors exactly how `App.tsx` wires `useAnalysisPlanAudit` +
 * `AnalysisFlow` + `ReportView`, including the autosave-on-open-report
 * behavior added in `App.tsx`. `Session2` mirrors `App.tsx`'s
 * `restoreProject` - it is a wholly separate component tree with its own
 * fresh `useAnalysisPlanAudit` instance, standing in for a fresh page load.
 */
import { useEffect, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AnalysisFlow, type AnalysisReportContext } from './AnalysisFlow'
import { useAnalysisPlanAudit } from './useAnalysisPlanAudit'
import { buildReportContextFromProject } from './restoreReportContext'
import { ReportView } from '../report/ReportView'
import { buildDataset, resetRowIdCounterForTests } from '../data-import/buildDataset'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type { ProjectAnalysisResult } from '../../models/ProjectFile'
import {
  buildRigorProject,
  deleteAutosavedProject,
  loadAutosavedProject,
  saveAutosavedProject,
} from '../../storage/projectFiles'
import type { WorkerInboundMessage, WorkerOutboundMessage } from '../../statistics/types'
import type { AuditEntry } from '../../models/AuditEntry'

class FakeWorker {
  onmessage: ((event: MessageEvent<WorkerOutboundMessage>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null

  postMessage(message: WorkerInboundMessage): void {
    if (message.kind === 'warm-up') return
    const { request } = message

    if (request.analysisType === 'welch-two-sample-t-test') {
      this.emitAsync({
        type: 'result',
        response: {
          id: request.id,
          success: true,
          result: {
            analysisType: 'welch-two-sample-t-test',
            result: {
              nA: request.payload.a.length,
              nB: request.payload.b.length,
              meanA: 10,
              meanB: 13,
              sdA: 1,
              sdB: 1,
              meanDifference: -3,
              meanDifferenceCi95Low: -5.2669579355,
              meanDifferenceCi95High: -0.7330420645,
              tStatistic: -3.6742346142,
              degreesOfFreedom: 4,
              pValue: 0.0213116411,
              effectSize: -2.905932629,
              effectSizeMethod: 'hedges_g',
            },
          },
        },
      })
      return
    }

    if (request.analysisType === 'normality-diagnostics') {
      this.emitAsync({
        type: 'result',
        response: {
          id: request.id,
          success: true,
          result: {
            analysisType: 'normality-diagnostics',
            result: {
              n: request.payload.values.length,
              shapiroWilkW: 1,
              shapiroWilkPValue: 1,
              skewness: 0,
            },
          },
        },
      })
      return
    }

    throw new Error(`FakeWorker: unexpected analysisType ${request.analysisType}`)
  }

  terminate(): void {}

  private emitAsync(message: WorkerOutboundMessage): void {
    setTimeout(() => this.onmessage?.({ data: message } as MessageEvent<WorkerOutboundMessage>), 0)
  }
}

function buildDesign(): ExperimentDesign {
  return {
    researchQuestion: 'Does fertilizer X increase plant height?',
    outcome: { name: 'plant height', type: 'continuous', unit: 'cm' },
    groups: { count: 2, names: ['Control', 'Treatment'] },
    relationship: 'independent',
    experimentalUnit: { label: 'Plant' },
    technicalReplication: { present: false },
    repeatedMeasures: { present: false },
    exclusionsPredefined: false,
  }
}

function buildDatasetFixture() {
  resetRowIdCounterForTests()
  const design = buildDesign()
  return buildDataset({
    format: 'independent-groups',
    columns: ['sample_id', 'group', 'value'],
    rawRows: [
      { sample_id: '1', group: 'Control', value: '10' },
      { sample_id: '2', group: 'Control', value: '11' },
      { sample_id: '3', group: 'Control', value: '9' },
      { sample_id: '4', group: 'Treatment', value: '12' },
      { sample_id: '5', group: 'Treatment', value: '13' },
      { sample_id: '6', group: 'Treatment', value: '14' },
    ],
    design,
  })
}

type Session1View = 'analysis' | 'report'

/** Mirrors `App.tsx`'s wiring of `useAnalysisPlanAudit` + `AnalysisFlow` + `ReportView`, including its autosave-on-open-report behavior. */
function Session1({ onSaved }: { onSaved: () => void }) {
  const [view, setView] = useState<Session1View>('analysis')
  const [reportContext, setReportContext] = useState<AnalysisReportContext | undefined>(undefined)
  const audit = useAnalysisPlanAudit()
  const design = buildDesign()
  const dataset = buildDatasetFixture()

  function openReport(context: AnalysisReportContext) {
    setReportContext(context)
    setView('report')

    if (context.kind === 'two-group') {
      const analysisForProject: ProjectAnalysisResult = {
        analysisType: context.analysis.analysisType,
        result: context.analysis.result,
        groupALabel: context.groupALabel,
        groupBLabel: context.groupBLabel,
        normalityDiagnosticsByGroup: {
          ...(context.normalityA ? { [context.groupALabel]: context.normalityA } : {}),
          ...(context.normalityB ? { [context.groupBLabel]: context.normalityB } : {}),
        },
        aggregation: context.aggregation,
      }
      const project = buildRigorProject({
        experimentDesign: context.design,
        dataset: context.dataset,
        analysisHistory: audit.history,
        analysis: analysisForProject,
        appVersion: 'test-version',
      })
      void saveAutosavedProject(project).then(onSaved)
    }
  }

  return (
    <div>
      {view === 'analysis' && (
        <AnalysisFlow
          design={design}
          dataset={dataset}
          auditHistory={audit.history}
          isPlanLocked={audit.isLocked}
          onLockPlan={audit.lock}
          onResultsReached={audit.markResultsReached}
          onExit={() => {}}
          onOpenReport={openReport}
        />
      )}
      {view === 'report' && reportContext && (
        <ReportView context={reportContext} auditHistory={audit.history} onClose={() => setView('analysis')} />
      )}
    </div>
  )
}

type Session2Status = 'loading' | 'found' | 'missing'

/** Mirrors `App.tsx`'s `restoreProject` for the "Continue last project" path - a wholly separate component tree, standing in for a fresh page load. */
function Session2() {
  const [status, setStatus] = useState<Session2Status>('loading')
  const [reportContext, setReportContext] = useState<AnalysisReportContext | undefined>(undefined)
  const [history, setHistory] = useState<AuditEntry[]>([])
  const audit = useAnalysisPlanAudit()

  useEffect(() => {
    void loadAutosavedProject().then((result) => {
      if (!result || !result.ok) {
        setStatus('missing')
        return
      }
      const context = buildReportContextFromProject(result.project)
      setHistory(result.project.analysisHistory)
      audit.hydrate(result.project.analysisHistory, result.project.experimentDesign)
      if (context) {
        setReportContext(context)
        setStatus('found')
      } else {
        setStatus('missing')
      }
    })
    // Runs once, exactly like a real fresh page load checking IndexedDB.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status === 'loading') return <p>Loading…</p>
  if (status === 'missing' || !reportContext) return <p>No saved project was found.</p>
  return (
    <>
      <p data-testid="session2-lock-status">{audit.isLocked ? 'locked' : 'not locked'}</p>
      <ReportView context={reportContext} auditHistory={history} onClose={() => {}} />
    </>
  )
}

describe('Milestone 12: full analysis -> save -> reopen, end to end', () => {
  it('reopens with the same numbers, lock status, and history intact - no recompute', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    await deleteAutosavedProject()

    let saved = false
    const session1 = render(<Session1 onSaved={() => { saved = true }} />)

    await waitFor(() => expect(screen.getByText('Review your analysis plan')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Lock analysis plan and view results' }))

    await waitFor(() => expect(screen.getByText('Your results')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'View printable report' }))

    await waitFor(() => expect(screen.getByText('Analysis history')).toBeInTheDocument())
    await waitFor(() => expect(saved).toBe(true))

    // The exact, deterministically-formatted numbers from the FakeWorker's result.
    expect(document.body.textContent).toContain('-3 cm') // mean difference
    expect(document.body.textContent).toContain('P = 0.021')

    const historyTextsBefore = screen.getAllByRole('listitem').map((item) => item.textContent)
    expect(historyTextsBefore).toEqual(
      expect.arrayContaining([expect.stringContaining('Analysis plan locked')]),
    )
    expect(historyTextsBefore.some((text) => text?.includes('Results viewed'))).toBe(true)

    session1.unmount()

    // --- Simulate a fresh app load: no Worker needed, nothing is recomputed. ---
    vi.stubGlobal('Worker', class {
      postMessage(): void {
        throw new Error('Session2 should never need to call the statistics worker.')
      }
      terminate(): void {}
    })

    render(<Session2 />)

    await waitFor(() => expect(screen.getByText('Analysis history')).toBeInTheDocument())

    expect(screen.getByTestId('session2-lock-status')).toHaveTextContent('locked')
    expect(document.body.textContent).toContain('-3 cm')
    expect(document.body.textContent).toContain('P = 0.021')

    const historyTextsAfter = screen.getAllByRole('listitem').map((item) => item.textContent)
    expect(historyTextsAfter).toEqual(historyTextsBefore)
  })
})
