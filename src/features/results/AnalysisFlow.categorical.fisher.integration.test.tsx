/**
 * Milestone 9 end-to-end integration test (Fisher's-exact path): wizard
 * (binary outcome, 2 independent groups) -> summary shows the real
 * categorical-association recommendation -> enter data -> upload a valid
 * 2-group CSV with LOW expected counts (< 5 per cell) -> the test-selection
 * module chooses Fisher's exact test instead of chi-square, end-to-end
 * through the real UI - this is the release-blocking proof that Cochran's
 * rule actually gets applied from real observed data, not just unit-tested
 * in isolation (see `categoricalTestSelection.test.ts` for the isolated
 * unit tests of the rule itself).
 *
 * See `categoricalIntegrationTestHelpers.ts` for why this is a separate file
 * from the chi-square scenario (module-level worker singleton).
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import {
  FakeCategoricalWorker,
  LOW_COUNT_ROWS,
  buildCsv,
  runWizardToDataEntry,
  uploadCsvAndGetResults,
} from './categoricalIntegrationTestHelpers'

describe("end-to-end: wizard -> summary -> data import -> real categorical-association results, Fisher's-exact path (Milestone 9)", () => {
  it("picks Fisher's exact end-to-end when expected counts are below 5", async () => {
    vi.stubGlobal(
      'Worker',
      class extends FakeCategoricalWorker {
        constructor() {
          super('low-counts')
        }
      },
    )

    await runWizardToDataEntry()
    await uploadCsvAndGetResults(buildCsv(LOW_COUNT_ROWS), LOW_COUNT_ROWS.length)

    const testSection = screen.getByText('Test result').closest('section')
    expect(testSection).toHaveTextContent("Fisher's exact test")
    expect(testSection).toHaveTextContent(/below 5/i)
    expect(testSection).toHaveTextContent(/fisher/i)

    expect(document.body.textContent).not.toContain('P = 0.000')
  })
})
