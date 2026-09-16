/**
 * Milestone 8 end-to-end integration test: wizard (3+ independent groups) ->
 * summary shows the real one-way-ANOVA recommendation -> enter data ->
 * upload a valid 3-group CSV -> real omnibus ANOVA + Holm-Bonferroni
 * pairwise-comparison results render with correct numbers -> the "adjusted
 * for multiple testing" explanation is present -> the methods paragraph
 * reflects the real n's and test used.
 *
 * Following the exact same seam `AnalysisFlow.integration.test.tsx`
 * established: the global `Worker` is replaced with an in-memory fake that
 * replies with results computed and verified independently ahead of time.
 * The canned `one-way-anova` response below uses the SAME golden values as
 * `src/statistics/anova.realPyodide.test.ts` (R's built-in `PlantGrowth`
 * dataset, cross-checked against `oneway.test()`/`pairwise.t.test(...,
 * p.adjust.method = "holm", pool.sd = FALSE)`) - see that file's header
 * comment for the exact source and full-precision values. This test does
 * NOT re-derive those numbers; it only proves the UI plumbs them through
 * correctly (real Pyodide computation is separately verified there, without
 * any DOM involved).
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

    if (request.analysisType === 'one-way-anova') {
      // Golden values for R's PlantGrowth dataset (ctrl/trt1/trt2, n=10
      // each) - see `anova.realPyodide.test.ts` for the exact source
      // (independent R cross-check against oneway.test()/pairwise.t.test())
      // and full derivation of every number below.
      this.emitAsync({
        type: 'result',
        response: {
          id: request.id,
          success: true,
          result: {
            analysisType: 'one-way-anova',
            result: {
              groups: [
                {
                  label: 'ctrl',
                  n: 10,
                  mean: 5.032,
                  median: 5.155,
                  sd: 0.5830913784,
                  q1: 4.6025,
                  q3: 5.2925,
                  iqr: 0.69,
                  min: 4.17,
                  max: 6.11,
                  ci95Low: 4.615,
                  ci95High: 5.449,
                },
                {
                  label: 'trt1',
                  n: 10,
                  mean: 4.661,
                  median: 4.55,
                  sd: 0.7936756964,
                  q1: 4.2075,
                  q3: 4.87,
                  iqr: 0.6625,
                  min: 3.59,
                  max: 6.03,
                  ci95Low: 4.093,
                  ci95High: 5.229,
                },
                {
                  label: 'trt2',
                  n: 10,
                  mean: 5.526,
                  median: 5.435,
                  sd: 0.4425732833,
                  q1: 5.2675,
                  q3: 5.7350,
                  iqr: 0.4675,
                  min: 4.92,
                  max: 6.31,
                  ci95Low: 5.2094,
                  ci95High: 5.8426,
                },
              ],
              omnibus: {
                method: 'welch_anova',
                fStatistic: 5.1809724081,
                numeratorDf: 2,
                denominatorDf: 17.1284186166,
                pValue: 0.0173928215,
              },
              pairwiseComparisons: [
                {
                  groupALabel: 'ctrl',
                  groupBLabel: 'trt1',
                  meanDifference: 0.371,
                  tStatistic: 1.1912603818,
                  degreesOfFreedom: 16.5235850569,
                  pValueRaw: 0.2503825086,
                  pValueAdjusted: 0.25038251,
                  effectSize: 0.5102373665,
                  effectSizeMethod: 'hedges_g',
                },
                {
                  groupALabel: 'ctrl',
                  groupBLabel: 'trt2',
                  meanDifference: -0.494,
                  tStatistic: -2.1340204531,
                  degreesOfFreedom: 16.7857644826,
                  pValueRaw: 0.0478992556,
                  pValueAdjusted: 0.09579851,
                  effectSize: -0.9140377642,
                  effectSizeMethod: 'hedges_g',
                },
                {
                  groupALabel: 'trt1',
                  groupBLabel: 'trt2',
                  meanDifference: -0.865,
                  tStatistic: -3.0100985421,
                  degreesOfFreedom: 14.1035691228,
                  pValueRaw: 0.0092984047,
                  pValueAdjusted: 0.02789521,
                  effectSize: -1.289277119,
                  effectSizeMethod: 'hedges_g',
                },
              ],
              pairwiseCorrectionMethod: 'holm_bonferroni',
            },
          },
        },
      })
      return
    }

    if (request.analysisType === 'normality-diagnostics') {
      // Not the focus of this test - any well-formed diagnostic response is
      // fine here; the real Shapiro-Wilk numbers are separately verified in
      // `normalityDiagnostics.realPyodide.test.ts`.
      this.emitAsync({
        type: 'result',
        response: {
          id: request.id,
          success: true,
          result: {
            analysisType: 'normality-diagnostics',
            result: { n: 10, shapiroWilkW: 0.95, shapiroWilkPValue: 0.7, skewness: 0.1 },
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

function stubWorker() {
  vi.stubGlobal('Worker', FakeWorker)
}

const PLANTGROWTH_CSV =
  'sample_id,group,value\n' +
  '1,ctrl,4.17\n2,ctrl,5.58\n3,ctrl,5.18\n4,ctrl,6.11\n5,ctrl,4.50\n' +
  '6,ctrl,4.61\n7,ctrl,5.17\n8,ctrl,4.53\n9,ctrl,5.33\n10,ctrl,5.14\n' +
  '11,trt1,4.81\n12,trt1,4.17\n13,trt1,4.41\n14,trt1,3.59\n15,trt1,5.87\n' +
  '16,trt1,3.83\n17,trt1,6.03\n18,trt1,4.89\n19,trt1,4.32\n20,trt1,4.69\n' +
  '21,trt2,6.31\n22,trt2,5.12\n23,trt2,5.54\n24,trt2,5.50\n25,trt2,5.37\n' +
  '26,trt2,5.29\n27,trt2,4.92\n28,trt2,6.15\n29,trt2,5.80\n30,trt2,5.26\n'

describe('end-to-end: wizard -> summary -> data import -> real one-way ANOVA results (Milestone 8)', () => {
  it('shows the real omnibus ANOVA + Holm-Bonferroni pairwise comparisons, with correct numbers', async () => {
    stubWorker()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Start an analysis' }))

    fireEvent.change(screen.getByLabelText('What are you trying to find out?'), {
      target: { value: 'Does fertilizer type affect plant growth?' },
    })
    fireEvent.change(screen.getByLabelText('What did you measure?'), {
      target: { value: 'dried plant weight' },
    })
    fireEvent.click(screen.getByLabelText('A numerical measurement'))
    fireEvent.change(screen.getByLabelText('Unit (optional)'), { target: { value: 'g' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    fireEvent.click(screen.getByLabelText('Three or more groups'))
    fireEvent.change(screen.getByLabelText('Group 1 name'), { target: { value: 'ctrl' } })
    fireEvent.change(screen.getByLabelText('Group 2 name'), { target: { value: 'trt1' } })
    fireEvent.change(screen.getByLabelText('Group 3 name'), { target: { value: 'trt2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    fireEvent.click(
      screen.getByLabelText('A different set of subjects or samples was used for each condition.'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    fireEvent.click(screen.getByLabelText('Plant'))
    fireEvent.click(screen.getByLabelText('No'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    fireEvent.click(screen.getByLabelText('No'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // Summary step shows the real rules-engine recommendation.
    expect(screen.getByText('Recommended analysis')).toBeInTheDocument()
    expect(screen.getByText(/one-way ANOVA/i)).toBeInTheDocument()
    // The stale "does not yet compute" claim must be gone now that Holm-Bonferroni is implemented.
    expect(screen.queryByText(/does not yet compute that correction/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Enter your data' }))

    fireEvent.click(screen.getByRole('radio', { name: 'Upload a CSV file' }))
    const file = new File([PLANTGROWTH_CSV], 'plantgrowth.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('Choose a CSV file to upload')
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText('Preview (30 rows)')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /import this data/i }))

    await waitFor(() => expect(screen.getByText('Your results')).toBeInTheDocument())

    // Omnibus test section shows the real Welch ANOVA F/df/p, clearly
    // separate from the pairwise comparisons section.
    const omnibusSection = screen.getByText('Overall (omnibus) test').closest('section')
    expect(omnibusSection).toHaveTextContent('5.18')
    expect(omnibusSection).toHaveTextContent('P = 0.017')
    expect(omnibusSection).toHaveTextContent(/Welch/)

    // Pairwise comparisons section: adjusted p-values shown, explanation present.
    const pairwiseSection = screen.getByText('Post-hoc pairwise comparisons').closest('section')
    expect(pairwiseSection).toHaveTextContent(/adjusted for multiple testing/i)
    expect(pairwiseSection).toHaveTextContent(/increases the chance of false-positive results/i)
    expect(pairwiseSection).toHaveTextContent('ctrl')
    expect(pairwiseSection).toHaveTextContent('trt1')
    expect(pairwiseSection).toHaveTextContent('trt2')
    // The Holm-adjusted p-value for trt1 vs trt2 (0.0279), NOT the raw one (0.0093).
    expect(pairwiseSection).toHaveTextContent('P = 0.028')
    expect(pairwiseSection).not.toHaveTextContent('P = 0.009')

    // Never "P = 0.000" anywhere on the page.
    expect(document.body.textContent).not.toContain('P = 0.000')

    // Printable report reflects the real per-group n's and mentions Holm-Bonferroni.
    fireEvent.click(screen.getByRole('button', { name: 'View printable report' }))
    await waitFor(() => expect(screen.getByText('Methods')).toBeInTheDocument())
    const methodsSection = screen.getByText('Methods').closest('section')
    expect(methodsSection).toHaveTextContent('n = 10')
    expect(methodsSection).toHaveTextContent(/Welch/)
    expect(methodsSection).toHaveTextContent(/Holm-Bonferroni/i)
    expect(methodsSection).toHaveTextContent('ctrl')
    expect(methodsSection).toHaveTextContent('trt1')
    expect(methodsSection).toHaveTextContent('trt2')

    const reportPairwiseSection = screen.getByText('Post-hoc pairwise comparisons').closest('section')
    expect(reportPairwiseSection).toHaveTextContent('P = 0.028')
  })
})
