/**
 * Milestone 9 end-to-end integration test (chi-square path): wizard (binary
 * outcome, 2 independent groups) -> summary shows the real
 * categorical-association recommendation -> enter data -> upload a valid
 * 2-group CSV of category labels with HIGH expected counts -> a real
 * chi-square result renders with correct numbers, including the 2x2-specific
 * odds ratio/risk difference.
 *
 * See `categoricalIntegrationTestHelpers.ts` for why this is a separate file
 * from the Fisher's-exact scenario (module-level worker singleton).
 *
 * The canned `chi-square-test`/`fishers-exact-test` responses use the SAME
 * golden 2x2 table/values as `src/statistics/categorical.realPyodide.test.ts`
 * (see that file's header comment for the exact R-verified source numbers) -
 * this test does NOT re-derive those numbers, it only proves the UI plumbs
 * them through correctly and picks the right test.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import {
  FakeCategoricalWorker,
  HIGH_COUNT_ROWS,
  buildCsv,
  runWizardToDataEntry,
  uploadCsvAndGetResults,
} from './categoricalIntegrationTestHelpers'

describe('end-to-end: wizard -> summary -> data import -> real categorical-association results, chi-square path (Milestone 9)', () => {
  it('picks chi-square (high expected counts) and shows the correct real numbers, including 2x2 odds ratio/risk difference', async () => {
    vi.stubGlobal(
      'Worker',
      class extends FakeCategoricalWorker {
        constructor() {
          super('high-counts')
        }
      },
    )

    await runWizardToDataEntry()
    await uploadCsvAndGetResults(buildCsv(HIGH_COUNT_ROWS), HIGH_COUNT_ROWS.length)

    const testSection = screen.getByText('Test result').closest('section')
    expect(testSection).toHaveTextContent('Chi-square test of association')
    expect(testSection).toHaveTextContent('5.4')
    expect(testSection).toHaveTextContent('P = 0.020')
    expect(testSection).toHaveTextContent('0.3')
    expect(testSection).toHaveTextContent(/all expected cell counts were 5 or greater/i)

    // 2x2-specific odds ratio / risk difference are shown.
    expect(testSection).toHaveTextContent('4')
    expect(testSection).toHaveTextContent(/1\.37/)
    expect(testSection).toHaveTextContent(/11\.7/)

    // The contingency table itself is shown with real counts.
    const dataSection = screen.getByText('Your data').closest('section')
    expect(dataSection).toHaveTextContent('Control')
    expect(dataSection).toHaveTextContent('Treatment')
    expect(dataSection).toHaveTextContent('improved')
    expect(dataSection).toHaveTextContent('not improved')

    expect(document.body.textContent).not.toContain('P = 0.000')
  })
})
