/**
 * Milestone 10 end-to-end integration tests: the new question-shape fork ->
 * correlation design capture -> data entry -> real-shaped correlation
 * results rendering, plus the honest "not supported yet" refusal path when
 * X/Y are not measured once per independent unit.
 *
 * Follows the same convention as
 * `src/features/results/AnalysisFlow.categorical.integration.test.tsx`: the
 * statistics worker is a lightweight fake returning a canned response (the
 * actual numeric verification of `pearson-correlation-regression` happens
 * once, against real Pyodide + R-cross-checked golden values, in
 * `src/statistics/correlation.realPyodide.test.ts`). This test only proves
 * the UI plumbs a computed result through to the screen correctly, and that
 * the "not measured once per unit" path never reaches the statistics worker
 * or fabricates a result.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../../App'
import type { WorkerInboundMessage, WorkerOutboundMessage } from '../../statistics/types'
import { formatPValue } from '../report/formatPValue'
import { formatStatistic } from '../report/formatStatistic'

const CANNED_RESULT = {
  n: 5,
  correlation: {
    r: 0.9673,
    pValue: 0.00591,
    ci95Low: 0.4123,
    ci95High: 0.9977,
  },
  regression: {
    slope: 2.1,
    intercept: -0.3,
    slopeCi95Low: 1.0,
    slopeCi95High: 3.2,
    pValue: 0.00591,
    rSquared: 0.9357,
    fittedValues: [1.8, 3.9, 6.0, 8.1, 10.2],
    residuals: [0.2, 0.1, -1.0, 0.9, -0.2],
  },
}

class FakeCorrelationWorker {
  onmessage: ((event: MessageEvent<WorkerOutboundMessage>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null

  postMessage(message: WorkerInboundMessage): void {
    if (message.kind === 'warm-up') return
    const { request } = message

    if (request.analysisType !== 'pearson-correlation-regression') {
      throw new Error(`FakeCorrelationWorker: unexpected analysisType ${request.analysisType}`)
    }

    this.emitAsync({
      type: 'result',
      response: {
        id: request.id,
        success: true,
        result: {
          analysisType: 'pearson-correlation-regression',
          result: CANNED_RESULT,
        },
      },
    })
  }

  terminate(): void {}

  private emitAsync(message: WorkerOutboundMessage): void {
    setTimeout(() => this.onmessage?.({ data: message } as MessageEvent<WorkerOutboundMessage>), 0)
  }
}

function goToCorrelationVariablesStep() {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Start an analysis' }))
  fireEvent.click(
    screen.getByRole('button', {
      name: 'My question is about a relationship between two measurements',
    }),
  )

  fireEvent.change(screen.getByLabelText('First measurement (X)'), {
    target: { value: 'height' },
  })
  fireEvent.change(screen.getByLabelText('Second measurement (Y)'), {
    target: { value: 'weight' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
}

const CSV_TEXT = 'x,y\n1,2\n2,4\n3,5\n4,9\n5,11\n'

describe('end-to-end: question fork -> correlation design capture -> CSV upload -> real-shaped results (Milestone 10)', () => {
  it('measured once per unit = yes -> CSV upload -> computed Pearson/regression results render with correct numbers', async () => {
    vi.stubGlobal('Worker', FakeCorrelationWorker)

    goToCorrelationVariablesStep()

    fireEvent.click(screen.getByLabelText('Yes'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByText('Enter your data')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Upload a CSV file' }))
    const file = new File([CSV_TEXT], 'heights.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('Choose a CSV file to upload')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(screen.getByText('Preview (5 rows)')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /analyze this data/i }))

    await waitFor(() => expect(screen.getByText('Your results')).toBeInTheDocument())

    const correlationSection = screen.getByText('Correlation').closest('section')
    expect(correlationSection).toHaveTextContent(formatStatistic(CANNED_RESULT.correlation.r, 3))
    expect(correlationSection).toHaveTextContent(formatPValue(CANNED_RESULT.correlation.pValue))
    expect(correlationSection).toHaveTextContent(
      formatStatistic(CANNED_RESULT.correlation.ci95Low, 3),
    )
    expect(correlationSection).toHaveTextContent(
      formatStatistic(CANNED_RESULT.regression.slope),
    )
    expect(correlationSection).toHaveTextContent(
      formatStatistic(CANNED_RESULT.regression.rSquared, 3),
    )

    // The causation disclaimer must always be present.
    expect(document.body.textContent).toMatch(
      /does not establish that changes in .* cause changes in/i,
    )

    // Raw points are shown, not just a fitted line.
    expect(document.body.textContent).toContain('n = 5 observations')
  })

  it('measured once per unit = no -> honest refusal, never proceeds to data entry or a fabricated result', () => {
    goToCorrelationVariablesStep()

    fireEvent.click(screen.getByLabelText('No'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByText("This version doesn't support that yet")).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/repeated-measures correlation/i)
    expect(screen.queryByText('Enter your data')).not.toBeInTheDocument()
    expect(screen.queryByText('Your results')).not.toBeInTheDocument()
  })

  it('measured once per unit = not sure -> the same honest refusal, never a guessed analysis', () => {
    goToCorrelationVariablesStep()

    fireEvent.click(screen.getByLabelText("I'm not sure"))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByText("This version doesn't support that yet")).toBeInTheDocument()
    expect(screen.queryByText('Enter your data')).not.toBeInTheDocument()
  })
})
