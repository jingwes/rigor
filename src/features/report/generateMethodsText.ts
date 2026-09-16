/**
 * Milestone 6: a deterministic (NOT an LLM) methods-paragraph generator.
 *
 * Every sentence here is built directly from structured data this app
 * actually used: the experiment design, the real sample sizes the
 * statistics worker computed on (already post-exclusion, since
 * `buildStatisticsRequest.ts` only ever sends usable values), which test
 * ran, and the app's own name/version (from `package.json`, injected at
 * build time - see `vite.config.ts`/`src/vite-env.d.ts`). Nothing here is
 * invented: no sample size, exclusion count, or software version is stated
 * unless it was passed in from real data.
 */

import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type {
  PairedTTestResult,
  WelchTwoSampleTTestResult,
} from '../../statistics/types'

export type MethodsAnalysis =
  | {
      analysisType: 'welch-two-sample-t-test'
      result: WelchTwoSampleTTestResult
    }
  | { analysisType: 'paired-t-test'; result: PairedTTestResult }

export interface GenerateMethodsTextInput {
  design: ExperimentDesign
  analysis: MethodsAnalysis
  /** The design group name mapped to the analysis's "a" arm/condition. */
  groupALabel: string
  /** The design group name mapped to the analysis's "b" arm/condition. */
  groupBLabel: string
  /**
   * How many rows were excluded from this analysis due to a parsing/
   * validation problem (an `"excluded"`-severity `ParsingIssue`). Pass the
   * real count from the dataset actually used - `0` if none were excluded.
   */
  excludedObservationCount: number
}

const TEST_NAME: Record<MethodsAnalysis['analysisType'], string> = {
  'welch-two-sample-t-test': "two-sided Welch's two-sample t-test",
  'paired-t-test': 'two-sided paired-samples t-test',
}

function capitalize(text: string): string {
  if (text.length === 0) return text
  return text[0].toUpperCase() + text.slice(1)
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`
}

function describeOutcome(design: ExperimentDesign): string {
  const name = design.outcome.name.trim() || 'the outcome measure'
  const unit = design.outcome.unit ? ` (${design.outcome.unit})` : ''
  return `${capitalize(name)}${unit}`
}

/**
 * Builds the methods paragraph for one of the two analyses this version of
 * Rigor supports. Pure function: same input, same text, every time.
 */
export function generateMethodsText(input: GenerateMethodsTextInput): string {
  const { design, analysis, groupALabel, groupBLabel, excludedObservationCount } =
    input
  const unitLabel = design.experimentalUnit.label.trim() || 'experimental unit'
  const outcomeSentence = describeOutcome(design)
  const testName = TEST_NAME[analysis.analysisType]

  const sentences: string[] = []

  if (analysis.analysisType === 'welch-two-sample-t-test') {
    const { nA, nB } = analysis.result
    sentences.push(
      `${outcomeSentence} was compared between two independent groups, "${groupALabel}" ` +
        `(n = ${nA} ${pluralize(nA, unitLabel)}) and "${groupBLabel}" (n = ${nB} ` +
        `${pluralize(nB, unitLabel)}), using a ${testName}. Welch's test was used rather than ` +
        "the classic Student's t-test because it does not assume the two groups have equal " +
        'variances.',
    )
  } else {
    const { nPairs } = analysis.result
    sentences.push(
      `${outcomeSentence} was compared between two paired conditions, "${groupALabel}" and ` +
        `"${groupBLabel}", using a ${testName}, on ${nPairs} matched ` +
        `${pluralize(nPairs, unitLabel)} measured under both conditions.`,
    )
  }

  if (excludedObservationCount > 0) {
    sentences.push(
      `${excludedObservationCount} ${pluralize(excludedObservationCount, 'observation')} ` +
        `${excludedObservationCount === 1 ? 'was' : 'were'} excluded before analysis due to a ` +
        'data-validation issue (see Data processing for details).',
    )
  }

  sentences.push(
    `Analysis was performed in ${__APP_NAME__[0].toUpperCase()}${__APP_NAME__.slice(1)} ` +
      `v${__APP_VERSION__}, an open-source, browser-based statistics tool (Python/SciPy run via ` +
      'Pyodide, entirely client-side).',
  )

  return sentences.join(' ')
}
