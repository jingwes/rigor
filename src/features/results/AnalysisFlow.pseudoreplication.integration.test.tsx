/**
 * Milestone 7 integration test: a synthetic nested dataset (6 experimental
 * units, 2 independent groups, 10 sub-measurements each = 60 raw rows) flows
 * through `AnalysisFlow` -> shows the pseudoreplication warning -> requires
 * an explicit confirmation -> after confirming, produces a real Welch
 * t-test computed on the 6 unit-level AGGREGATED means, not the 60 raw
 * values. Follows the same in-memory `Worker` fake `AnalysisFlow.
 * integration.test.tsx` established for exercising the real request/response
 * plumbing without a real Pyodide.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AnalysisFlow, type AnalysisReportContext } from './AnalysisFlow'
import { buildDataset, resetRowIdCounterForTests } from '../data-import/buildDataset'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type { WorkerInboundMessage, WorkerOutboundMessage } from '../../statistics/types'

const UNITS: Array<{ unit: string; group: string; value: number }> = [
  { unit: 'mouse-1', group: 'Control', value: 10 },
  { unit: 'mouse-2', group: 'Control', value: 11 },
  { unit: 'mouse-3', group: 'Control', value: 9 },
  { unit: 'mouse-4', group: 'Treatment', value: 14 },
  { unit: 'mouse-5', group: 'Treatment', value: 13 },
  { unit: 'mouse-6', group: 'Treatment', value: 15 },
]
const SUBSAMPLES_PER_UNIT = 10
const TOTAL_RAW_ROWS = UNITS.length * SUBSAMPLES_PER_UNIT // 60

function buildNestedDesign(): ExperimentDesign {
  return {
    outcome: { name: 'expression level', type: 'continuous', unit: 'AU' },
    groups: { count: 2, names: ['Control', 'Treatment'] },
    relationship: 'independent',
    experimentalUnit: { label: 'unit' },
    technicalReplication: { present: true, measurementsPerUnit: SUBSAMPLES_PER_UNIT },
    repeatedMeasures: { present: false },
    exclusionsPredefined: false,
  }
}

function buildNestedDatasetFixture(design: ExperimentDesign) {
  resetRowIdCounterForTests()
  const rawRows: Record<string, string>[] = []
  for (const { unit, group, value } of UNITS) {
    for (let i = 0; i < SUBSAMPLES_PER_UNIT; i++) {
      // Every sub-measurement for a unit is given the exact same value, so
      // the aggregated per-unit mean is trivially that same value - this
      // test cares about FLOW/plumbing (n = units, not raw rows), not about
      // exercising the mean arithmetic itself (see
      // `aggregateByExperimentalUnit.test.ts` for that).
      rawRows.push({
        experimental_unit: unit,
        subsample: String(i + 1),
        group,
        value: String(value),
      })
    }
  }

  return buildDataset({
    format: 'nested',
    columns: ['experimental_unit', 'subsample', 'group', 'value'],
    rawRows,
    design,
  })
}

const capturedRequests: { welch?: { a: number[]; b: number[] } } = {}
function getCapturedWelchPayload(): { a: number[]; b: number[] } | undefined {
  return capturedRequests.welch
}

class FakeWorker {
  onmessage: ((event: MessageEvent<WorkerOutboundMessage>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null

  postMessage(message: WorkerInboundMessage): void {
    if (message.kind === 'warm-up') return
    const { request } = message

    if (request.analysisType === 'welch-two-sample-t-test') {
      // Record exactly what was sent, so the test can assert on it directly.
      capturedRequests.welch = request.payload
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
              meanB: 14,
              sdA: 1,
              sdB: 1,
              meanDifference: -4,
              meanDifferenceCi95Low: -6,
              meanDifferenceCi95High: -2,
              tStatistic: -5,
              degreesOfFreedom: 4,
              pValue: 0.007,
              effectSize: -3.5,
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
            result: { n: request.payload.values.length, shapiroWilkW: 1, shapiroWilkPValue: 1, skewness: 0 },
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

describe('AnalysisFlow: nested dataset + independent relationship (Milestone 7)', () => {
  it(
    'warns about pseudoreplication, requires confirmation, then runs the Welch t-test on ' +
      'unit-level aggregated means (n = 6 units), not the 60 raw sub-measurements',
    async () => {
      capturedRequests.welch = undefined
      vi.stubGlobal('Worker', FakeWorker)

      const design = buildNestedDesign()
      const dataset = buildNestedDatasetFixture(design)
      expect(dataset.rows).toHaveLength(TOTAL_RAW_ROWS)

      let reportContext: AnalysisReportContext | undefined
      render(
        <AnalysisFlow
          design={design}
          dataset={dataset}
          onExit={() => {}}
          onOpenReport={(context) => {
            reportContext = context
          }}
        />,
      )

      const bodyText = () => document.body.textContent ?? ''

      // The pseudoreplication warning must fire, using the REAL numbers.
      // (Multiple elements on this step mention these numbers, so match on
      // the page's text content rather than a single unique element.)
      expect(
        screen.getByText('Check your sample size before analyzing'),
      ).toBeInTheDocument()
      expect(bodyText()).toMatch(/10 measurements from each of 6 units/)
      expect(bodyText()).toMatch(/60 raw measurements/)

      // No statistics have run yet - this must be an explicit, visible step.
      expect(getCapturedWelchPayload()).toBeUndefined()
      expect(screen.queryByText('Your results')).not.toBeInTheDocument()

      // Confirm the aggregation step.
      fireEvent.click(
        screen.getByRole('button', { name: /Aggregate within experimental unit \(mean\)/i }),
      )

      await waitFor(() => expect(screen.getByText('Your results')).toBeInTheDocument())

      // The statistics request used the 6 unit-level means, NOT the 60 raw rows.
      expect(getCapturedWelchPayload()).toBeDefined()
      expect(getCapturedWelchPayload()?.a).toHaveLength(3)
      expect(getCapturedWelchPayload()?.b).toHaveLength(3)
      expect(getCapturedWelchPayload()?.a).toEqual([10, 11, 9])
      expect(getCapturedWelchPayload()?.b).toEqual([14, 13, 15])

      // Both counts are shown, clearly labeled - never one ambiguous "n".
      expect(screen.getByText('Technical replicates were averaged')).toBeInTheDocument()
      expect(bodyText()).toMatch(/6 biological replicates/)
      expect(bodyText()).toMatch(/from 60 raw measurements/)

      // The report context (handed to the report view) carries the audit
      // record of the aggregation decision, and the FULL original dataset
      // (still 60 raw rows) - never a filtered/mutated one.
      fireEvent.click(screen.getByRole('button', { name: 'View printable report' }))
      expect(reportContext?.dataset.rows).toHaveLength(TOTAL_RAW_ROWS)
      expect(reportContext?.aggregation?.method).toBe('mean')
      expect(reportContext?.aggregation?.units).toHaveLength(6)
      expect(reportContext?.valuesA).toHaveLength(3)
      expect(reportContext?.valuesB).toHaveLength(3)

      vi.unstubAllGlobals()
    },
  )

  it('skips the confirmation step when there is exactly one usable measurement per unit', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    capturedRequests.welch = undefined

    const design = buildNestedDesign()
    resetRowIdCounterForTests()
    const rawRows = UNITS.map(({ unit, group, value }) => ({
      experimental_unit: unit,
      subsample: '1',
      group,
      value: String(value),
    }))
    const dataset = buildDataset({
      format: 'nested',
      columns: ['experimental_unit', 'subsample', 'group', 'value'],
      rawRows,
      design,
    })

    render(<AnalysisFlow design={design} dataset={dataset} onExit={() => {}} onOpenReport={() => {}} />)

    // No pseudoreplication (1 measurement per unit) - no confirmation click required.
    expect(screen.queryByText('Check your sample size before analyzing')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Your results')).toBeInTheDocument())
    expect(getCapturedWelchPayload()?.a).toHaveLength(3)
    expect(getCapturedWelchPayload()?.b).toHaveLength(3)

    vi.unstubAllGlobals()
  })

  it('shows an honest "not yet supported" explanation for nested data with a non-independent relationship', () => {
    const design: ExperimentDesign = {
      ...buildNestedDesign(),
      relationship: 'paired',
    }
    const dataset = buildNestedDatasetFixture(design)

    render(<AnalysisFlow design={design} dataset={dataset} onExit={() => {}} onOpenReport={() => {}} />)

    expect(screen.getByText("Rigor can't run this nested-design analysis yet")).toBeInTheDocument()
    expect(screen.getByText(/mixed-effects models, which this version does not yet support/)).toBeInTheDocument()
    expect(screen.queryByText('Your results')).not.toBeInTheDocument()
    expect(screen.queryByText('Check your sample size before analyzing')).not.toBeInTheDocument()
  })
})
