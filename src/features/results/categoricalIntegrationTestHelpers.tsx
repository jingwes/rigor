/**
 * Shared helpers for the Milestone 9 categorical-association end-to-end
 * integration tests (`AnalysisFlow.categorical.*.integration.test.tsx`).
 * Split into two test files (one per test-selection scenario) rather than
 * two `it()`s in one file, because the statistics worker client keeps a
 * module-level singleton `Worker` instance - reusing it across `it()`s in
 * the same file would carry the FIRST test's fake worker over into the
 * second, exactly like `AnalysisFlow.anova.integration.test.tsx` and
 * `AnalysisFlow.integration.test.tsx` each only exercise one live-worker
 * scenario per file.
 */
import { expect } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../../App'
import type { WorkerInboundMessage, WorkerOutboundMessage } from '../../statistics/types'

export function buildCsv(rows: { group: string; value: string }[]): string {
  const header = 'sample_id,group,value\n'
  const body = rows.map((row, index) => `${index + 1},${row.group},${row.value}`).join('\n')
  return header + body + '\n'
}

/** 20 Control/improved, 10 Control/not improved, 10 Treatment/improved, 20 Treatment/not improved. */
export const HIGH_COUNT_ROWS = [
  ...Array.from({ length: 20 }, () => ({ group: 'Control', value: 'improved' })),
  ...Array.from({ length: 10 }, () => ({ group: 'Control', value: 'not improved' })),
  ...Array.from({ length: 10 }, () => ({ group: 'Treatment', value: 'improved' })),
  ...Array.from({ length: 20 }, () => ({ group: 'Treatment', value: 'not improved' })),
]

/** 1 Control/improved, 4 Control/not improved, 4 Treatment/improved, 1 Treatment/not improved
 * (n=5 per group; all expected counts = 2.5, below the Cochran's-rule threshold of 5). */
export const LOW_COUNT_ROWS = [
  { group: 'Control', value: 'improved' },
  ...Array.from({ length: 4 }, () => ({ group: 'Control', value: 'not improved' })),
  ...Array.from({ length: 4 }, () => ({ group: 'Treatment', value: 'improved' })),
  { group: 'Treatment', value: 'not improved' },
]

export class FakeCategoricalWorker {
  onmessage: ((event: MessageEvent<WorkerOutboundMessage>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null

  private readonly scenario: 'high-counts' | 'low-counts'

  constructor(scenario: 'high-counts' | 'low-counts') {
    this.scenario = scenario
  }

  postMessage(message: WorkerInboundMessage): void {
    if (message.kind === 'warm-up') return
    const { request } = message

    if (request.analysisType === 'chi-square-test') {
      if (this.scenario === 'high-counts') {
        // Golden values for the 2x2 table [[20,10],[10,20]] - see
        // `categorical.realPyodide.test.ts` for the exact R cross-check.
        this.emitAsync({
          type: 'result',
          response: {
            id: request.id,
            success: true,
            result: {
              analysisType: 'chi-square-test',
              result: {
                chiSquare: 5.4,
                degreesOfFreedom: 1,
                pValue: 0.02013675,
                observed: [
                  [20, 10],
                  [10, 20],
                ],
                expected: [
                  [15, 15],
                  [15, 15],
                ],
                n: 60,
                cramersV: 0.3,
              },
            },
          },
        })
        return
      }

      // Low-count scenario: n=5 per group, all expected counts = 2.5.
      this.emitAsync({
        type: 'result',
        response: {
          id: request.id,
          success: true,
          result: {
            analysisType: 'chi-square-test',
            result: {
              chiSquare: 3.6,
              degreesOfFreedom: 1,
              pValue: 0.0578,
              observed: [
                [1, 4],
                [4, 1],
              ],
              expected: [
                [2.5, 2.5],
                [2.5, 2.5],
              ],
              n: 10,
              cramersV: 0.6,
            },
          },
        },
      })
      return
    }

    if (request.analysisType === 'fishers-exact-test') {
      if (this.scenario === 'high-counts') {
        this.emitAsync({
          type: 'result',
          response: {
            id: request.id,
            success: true,
            result: {
              analysisType: 'fishers-exact-test',
              result: {
                oddsRatio: 4,
                pValue: 0.01938319,
                oddsRatioCi95Low: 1.3671910092,
                oddsRatioCi95High: 11.7028316568,
                riskDifference: 0.3333333333,
                riskDifferenceCi95Low: 0.094769726,
                riskDifferenceCi95High: 0.5718969407,
              },
            },
          },
        })
        return
      }

      this.emitAsync({
        type: 'result',
        response: {
          id: request.id,
          success: true,
          result: {
            analysisType: 'fishers-exact-test',
            result: {
              oddsRatio: 16,
              pValue: 0.0873,
              oddsRatioCi95Low: 0.83,
              oddsRatioCi95High: 308.4,
              riskDifference: 0.6,
              riskDifferenceCi95Low: 0.13,
              riskDifferenceCi95High: 1.07,
            },
          },
        },
      })
      return
    }

    throw new Error(`FakeCategoricalWorker: unexpected analysisType ${request.analysisType}`)
  }

  terminate(): void {}

  private emitAsync(message: WorkerOutboundMessage): void {
    setTimeout(() => this.onmessage?.({ data: message } as MessageEvent<WorkerOutboundMessage>), 0)
  }
}

export async function runWizardToDataEntry() {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Start an analysis' }))

  // Milestone 10: the new research-question-shape fork now sits ahead of the
  // (unchanged) group-comparison wizard.
  fireEvent.click(
    screen.getByRole('button', {
      name: 'My question is about differences between groups or conditions',
    }),
  )

  fireEvent.change(screen.getByLabelText('What are you trying to find out?'), {
    target: { value: 'Does the new treatment improve recovery?' },
  })
  fireEvent.change(screen.getByLabelText('What did you measure?'), {
    target: { value: 'recovery status' },
  })
  fireEvent.click(screen.getByLabelText('Yes/no'))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

  fireEvent.click(screen.getByLabelText('Two groups'))
  fireEvent.change(screen.getByLabelText('Group 1 name'), { target: { value: 'Control' } })
  fireEvent.change(screen.getByLabelText('Group 2 name'), { target: { value: 'Treatment' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

  fireEvent.click(
    screen.getByLabelText('Different subjects or samples were used in each condition.'),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

  fireEvent.click(screen.getByLabelText('Participant'))
  fireEvent.click(screen.getByLabelText('No'))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

  fireEvent.click(screen.getByLabelText('No'))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

  expect(screen.getByText('Recommended analysis')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Enter your data' }))
}

export async function uploadCsvAndGetResults(csv: string, rowCount: number) {
  fireEvent.click(screen.getByRole('radio', { name: 'Upload a CSV file' }))
  const file = new File([csv], 'recovery.csv', { type: 'text/csv' })
  const input = screen.getByLabelText('Choose a CSV file to upload')
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(() => expect(screen.getByText(`Preview (${rowCount} rows)`)).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: /import this data/i }))

  // Milestone 11: results are gated behind the "review your analysis plan"
  // lock step - lock it before results are shown.
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Lock analysis plan and view results' })).toBeInTheDocument(),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Lock analysis plan and view results' }))

  await waitFor(() => expect(screen.getByText('Your results')).toBeInTheDocument())
}
