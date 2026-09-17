/**
 * Milestone 11 integration test: the full DESIGN-phase-then-RESULTS-phase
 * flow (project spec section 29-30) - review the analysis plan, lock it,
 * see real results, then honestly track a post-lock change, all the way
 * into the printable report's "Analysis history" section.
 *
 * This wires the real `useAnalysisPlanAudit` hook together with the real
 * `AnalysisFlow` (through its lock gate) and the real `ReportView`, in a
 * small harness that mirrors exactly how `App.tsx` wires them.
 *
 * Note on "going back and changing a group name": this version of Rigor has
 * no UI that lets a student rename a group after data has already been
 * imported (editing-and-resuming an in-progress wizard with an existing
 * dataset isn't built - it's a separate, larger feature outside Milestone
 * 11's scope, which is the audit trail itself, not a new edit-in-place
 * flow). The harness below simulates that step directly, the same way a
 * future edit-in-place feature would: handing `AnalysisFlow` a new `design`
 * with a renamed group (and updating the fixture dataset's `group` column
 * to match, since `buildStatisticsRequest` matches rows to a group by exact
 * name). Everything downstream of that hand-off - the modification
 * detection, the audit entries, the report's history section - is the real
 * production code path.
 */
import { useMemo, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AnalysisFlow, type AnalysisReportContext } from './AnalysisFlow'
import { useAnalysisPlanAudit } from './useAnalysisPlanAudit'
import { ReportView } from '../report/ReportView'
import { buildDataset, resetRowIdCounterForTests } from '../data-import/buildDataset'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type { WorkerInboundMessage, WorkerOutboundMessage } from '../../statistics/types'

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

function buildDesign(groupNames: [string, string]): ExperimentDesign {
  return {
    researchQuestion: 'Does fertilizer X increase plant height?',
    outcome: { name: 'plant height', type: 'continuous', unit: 'cm' },
    groups: { count: 2, names: groupNames },
    relationship: 'independent',
    experimentalUnit: { label: 'Plant' },
    technicalReplication: { present: false },
    repeatedMeasures: { present: false },
    exclusionsPredefined: false,
  }
}

function buildDatasetFixture(groupNames: [string, string]) {
  resetRowIdCounterForTests()
  return buildDataset({
    format: 'independent-groups',
    columns: ['sample_id', 'group', 'value'],
    rawRows: [
      { sample_id: '1', group: groupNames[0], value: '10' },
      { sample_id: '2', group: groupNames[0], value: '11' },
      { sample_id: '3', group: groupNames[0], value: '9' },
      { sample_id: '4', group: groupNames[1], value: '12' },
      { sample_id: '5', group: groupNames[1], value: '13' },
      { sample_id: '6', group: groupNames[1], value: '14' },
    ],
    design: buildDesign(groupNames),
  })
}

type HarnessView = 'analysis' | 'report'

/** Mirrors exactly how `App.tsx` wires `useAnalysisPlanAudit` + `AnalysisFlow` + `ReportView`. */
function Harness() {
  const [groupNames, setGroupNames] = useState<[string, string]>(['Control', 'Treatment'])
  const [view, setView] = useState<HarnessView>('analysis')
  const [reportContext, setReportContext] = useState<AnalysisReportContext | undefined>(undefined)
  const audit = useAnalysisPlanAudit()

  const design = useMemo(() => buildDesign(groupNames), [groupNames])
  const dataset = useMemo(() => buildDatasetFixture(groupNames), [groupNames])

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
          onOpenReport={(context) => {
            setReportContext(context)
            setView('report')
          }}
        />
      )}
      {view === 'report' && reportContext && (
        <ReportView
          context={reportContext}
          auditHistory={audit.history}
          onClose={() => setView('analysis')}
        />
      )}
      {/* Test-only stand-in for "go back and rename a group" - see file header. */}
      <button type="button" onClick={() => setGroupNames(['Control', 'High-dose'])}>
        test: rename group 2
      </button>
    </div>
  )
}

describe('Milestone 11: analysis-plan locking + audit history, end to end', () => {
  it(
    'shows the DESIGN summary before results, locks on demand, detects a post-lock group-name ' +
      'change without ever blocking, and surfaces the full honest history in the report',
    async () => {
      vi.stubGlobal('Worker', FakeWorker)

      render(<Harness />)

      // --- DESIGN phase: results are not shown yet. ---------------------
      await waitFor(() => expect(screen.getByText('Review your analysis plan')).toBeInTheDocument())
      expect(screen.queryByText('Your results')).not.toBeInTheDocument()
      expect(screen.getByText(/Welch two-sample t-test/)).toBeInTheDocument()
      expect(screen.getByText('Does fertilizer X increase plant height?')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Lock analysis plan and view results' }))

      // --- RESULTS phase. --------------------------------------------------
      await waitFor(() => expect(screen.getByText('Your results')).toBeInTheDocument())
      expect(screen.getByText('Mean difference (Control − Treatment)')).toBeInTheDocument()

      // Never blocked: the student is completely free to go back and change
      // their design after seeing results.
      fireEvent.click(screen.getByRole('button', { name: 'test: rename group 2' }))

      // Results are reached again immediately - no re-lock gate is forced,
      // nothing here ever stops the student from seeing their (updated)
      // results.
      await waitFor(() => expect(screen.getByText('Your results')).toBeInTheDocument())
      expect(screen.getByText('Mean difference (Control − High-dose)')).toBeInTheDocument()
      expect(screen.queryByText('Review your analysis plan')).not.toBeInTheDocument()

      // --- The printable report shows the full, honest audit trail. ------
      fireEvent.click(screen.getByRole('button', { name: 'View printable report' }))
      await waitFor(() => expect(screen.getByText('Analysis history')).toBeInTheDocument())

      const historySection = screen.getByText('Analysis history').closest('section') as HTMLElement
      const items = within(historySection).getAllByRole('listitem')
      expect(items).toHaveLength(4)
      expect(items[0]).toHaveTextContent('Analysis plan locked')
      expect(items[1]).toHaveTextContent('Results viewed')
      expect(items[2]).toHaveTextContent('Modified after results were viewed')
      expect(items[2]).toHaveTextContent('Group names')
      expect(items[2]).toHaveTextContent('Control, Treatment')
      expect(items[2]).toHaveTextContent('Control, High-dose')
      expect(items[3]).toHaveTextContent('Results viewed')
    },
  )
})
