/**
 * Milestone 6 end-to-end integration test: wizard -> summary shows the real
 * rules-engine recommendation -> enter data -> upload a valid CSV -> real
 * results render with correct numbers -> the methods paragraph reflects the
 * real n's and test used.
 *
 * jsdom (this project's default Vitest environment, see
 * `workerClient.test.ts`) has no real dedicated-`Worker`/Pyodide
 * implementation, so - following the exact same seam Milestone 4 already
 * established for testing `workerClient.ts` - the global `Worker` is
 * replaced with an in-memory fake that intercepts the exact typed messages
 * `workerClient.ts` posts and replies with results computed and verified
 * independently ahead of time (see the comments by each canned response
 * below). This exercises every other real line of production code: the
 * wizard, the rules engine, CSV parsing/validation, `buildStatisticsRequest`,
 * `workerClient.ts`'s request/response plumbing, and the results/report UI.
 * `engine.realPyodide.test.ts`/`normalityDiagnostics.realPyodide.test.ts`
 * separately verify SciPy itself produces these numbers for real, without
 * any DOM involved.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../../App'
import type { WorkerInboundMessage, WorkerOutboundMessage } from '../../statistics/types'

class FakeWorker {
  onmessage: ((event: MessageEvent<WorkerOutboundMessage>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null

  postMessage(message: WorkerInboundMessage): void {
    if (message.kind === 'warm-up') return
    const { request } = message

    if (request.analysisType === 'welch-two-sample-t-test') {
      // Golden values for a = [10, 11, 9] ("Control"), b = [12, 13, 14]
      // ("Treatment") independently computed via R's t.test(a, b):
      // meanA=10, meanB=13, t=-3.6742346142, df=4, p=0.0213116411,
      // CI=[-5.2669579355, -0.7330420645], meanDiff=-3.
      this.emitAsync({
        type: 'result',
        response: {
          id: request.id,
          success: true,
          result: {
            analysisType: 'welch-two-sample-t-test',
            result: {
              nA: 3,
              nB: 3,
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
      // Both arms are perfectly evenly-spaced triples ({9,10,11} /
      // {12,13,14}), for which Shapiro-Wilk W = 1, p = 1, and skewness = 0
      // exactly (independently confirmed via R's shapiro.test()).
      this.emitAsync({
        type: 'result',
        response: {
          id: request.id,
          success: true,
          result: {
            analysisType: 'normality-diagnostics',
            result: { n: 3, shapiroWilkW: 1, shapiroWilkPValue: 1, skewness: 0 },
          },
        },
      })
      return
    }

    throw new Error(`FakeWorker: unexpected analysisType ${request.analysisType}`)
  }

  terminate(): void {}

  private emitAsync(message: WorkerOutboundMessage): void {
    // Real workers reply asynchronously - matching that keeps this test
    // honest about the real request/response plumbing in `workerClient.ts`.
    setTimeout(() => this.onmessage?.({ data: message } as MessageEvent<WorkerOutboundMessage>), 0)
  }
}

function stubWorker() {
  vi.stubGlobal('Worker', FakeWorker)
}

const INDEPENDENT_GROUPS_CSV =
  'sample_id,group,value\n1,Control,10\n2,Control,11\n3,Control,9\n' +
  '4,Treatment,12\n5,Treatment,13\n6,Treatment,14\n'

async function runWizardToDataImport(outcomeType: 'numerical' | 'categorical' = 'numerical') {
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
    target: { value: 'Does fertilizer X increase plant height?' },
  })
  fireEvent.change(screen.getByLabelText('What did you measure?'), {
    target: { value: 'plant height' },
  })
  fireEvent.click(
    screen.getByLabelText(outcomeType === 'numerical' ? 'A numerical measurement' : 'Categories'),
  )
  if (outcomeType === 'numerical') {
    fireEvent.change(screen.getByLabelText('Unit (optional)'), { target: { value: 'cm' } })
  }
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

  fireEvent.click(screen.getByLabelText('Two groups'))
  fireEvent.change(screen.getByLabelText('Group 1 name'), { target: { value: 'Control' } })
  fireEvent.change(screen.getByLabelText('Group 2 name'), { target: { value: 'Treatment' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

  fireEvent.click(
    screen.getByLabelText('Different subjects or samples were used in each condition.'),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

  fireEvent.click(screen.getByLabelText('Plant'))
  fireEvent.click(screen.getByLabelText('No'))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

  fireEvent.click(screen.getByLabelText('No'))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
}

describe('end-to-end: wizard -> summary -> data import -> real results', () => {
  it('shows the recommendation on the summary step, then real Welch results with correct numbers', async () => {
    stubWorker()
    await runWizardToDataImport('numerical')

    // Summary step shows the real recommendation (Milestone 6, part 1).
    expect(screen.getByText('Recommended analysis')).toBeInTheDocument()
    expect(screen.getByText(/Welch two-sample t-test/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Enter your data' }))

    // Upload a valid CSV.
    fireEvent.click(screen.getByRole('radio', { name: 'Upload a CSV file' }))
    const file = new File([INDEPENDENT_GROUPS_CSV], 'data.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('Choose a CSV file to upload')
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText('Preview (6 rows)')).toBeInTheDocument())
    expect(screen.getByText('No issues found in this data.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /import this data/i }))

    // Milestone 11: results are gated behind the "review your analysis
    // plan" lock step - confirm it appears, then lock it before results
    // show.
    await waitFor(() =>
      expect(screen.getByText('Review your analysis plan')).toBeInTheDocument(),
    )
    expect(screen.queryByText('Your results')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Lock analysis plan and view results' }))

    // Real results render with the correct, independently-verified numbers.
    await waitFor(() => expect(screen.getByText('Your results')).toBeInTheDocument())

    const effectSection = screen.getByText('Estimated effect').closest('section')
    expect(effectSection).toHaveTextContent('-3')
    expect(effectSection).toHaveTextContent('-5.27')
    expect(effectSection).toHaveTextContent('-0.73')

    const analysisSection = screen.getByText('Statistical analysis').closest('section')
    expect(analysisSection).toHaveTextContent('P = 0.021')
    expect(analysisSection).toHaveTextContent("Welch's two-sample t-test")

    // Never "P = 0.000" style formatting anywhere on the page.
    expect(document.body.textContent).not.toContain('P = 0.000')

    // Open the printable report and confirm the methods paragraph reflects
    // the REAL n's (3 per group, from the CSV) and the real test used - not
    // an invented sample size.
    fireEvent.click(screen.getByRole('button', { name: 'View printable report' }))
    await waitFor(() => expect(screen.getByText('Methods')).toBeInTheDocument())
    const methodsSection = screen.getByText('Methods').closest('section')
    expect(methodsSection).toHaveTextContent('n = 3')
    expect(methodsSection).toHaveTextContent(/Welch/)
    expect(methodsSection).toHaveTextContent(/Control/)
    expect(methodsSection).toHaveTextContent(/Treatment/)
  })

  it('shows an honest explanation, never fake results, for a design with 3+ groups', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start an analysis' }))

    // Milestone 10: the new research-question-shape fork now sits ahead of
    // the (unchanged) group-comparison wizard.
    fireEvent.click(
      screen.getByRole('button', {
        name: 'My question is about differences between groups or conditions',
      }),
    )

    fireEvent.change(screen.getByLabelText('What did you measure?'), {
      target: { value: 'reaction time' },
    })
    fireEvent.click(screen.getByLabelText('A numerical measurement'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    fireEvent.click(screen.getByLabelText('Three or more groups'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    fireEvent.click(
      screen.getByLabelText(
        'The same subjects or samples were measured under every condition.',
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    fireEvent.click(screen.getByLabelText('Participant'))
    fireEvent.click(screen.getByLabelText('No'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    fireEvent.click(screen.getByLabelText('No'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // The rules engine correctly refuses to recommend a one-way ANOVA for
    // repeated measurements across 3+ conditions (that would understate
    // uncertainty) - it must say so honestly, never silently proceed.
    expect(screen.getByText('Recommended analysis')).toBeInTheDocument()
    expect(
      screen.getByText(/repeated-measures analysis that is not yet supported/),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Enter your data' }))
    fireEvent.click(screen.getByRole('button', { name: /Use the paired/i }))

    fireEvent.change(screen.getByLabelText('subject_id, row 1'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('condition, row 1'), { target: { value: 'A' } })
    fireEvent.change(screen.getByLabelText('value, row 1'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('subject_id, row 2'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('condition, row 2'), { target: { value: 'B' } })
    fireEvent.change(screen.getByLabelText('value, row 2'), { target: { value: '6' } })

    fireEvent.click(screen.getByRole('button', { name: /import this data/i }))

    // Honest explanation, never a fabricated result or silent no-op.
    await waitFor(() =>
      expect(screen.getByText("Rigor can't run an analysis for this yet")).toBeInTheDocument(),
    )
    expect(screen.queryByText('Your results')).not.toBeInTheDocument()
    expect(screen.queryByText(/P = /)).not.toBeInTheDocument()
    expect(screen.queryByText(/P < /)).not.toBeInTheDocument()
  })
})
