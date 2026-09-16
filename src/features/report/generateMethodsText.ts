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
import type { NestedAggregationResult } from '../analysis-plan/aggregateByExperimentalUnit'

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
  /**
   * Milestone 7: present only when the analysis ran on per-experimental-unit
   * aggregated (technical-replicate-averaged) values rather than raw rows.
   * When set, the generated paragraph states this explicitly, using the real
   * per-unit measurement counts - never a single invented number.
   */
  aggregation?: NestedAggregationResult
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

/**
 * Describes the Milestone 7 technical-replicate aggregation step in
 * methods-paragraph prose, from the real per-unit measurement counts. If
 * every unit had the same number of raw measurements, states that number
 * plainly (matching the project spec's own example: "Three technical
 * measurements within each biological replicate were summarized before
 * inferential analysis."). If counts varied, says so honestly with a range
 * rather than presenting a single number as if uniform.
 */
function describeAggregationForMethods(
  aggregation: NestedAggregationResult,
  unitLabel: string,
): string {
  const counts = aggregation.units.map((unit) => unit.rawValueCount)
  const totalRaw = counts.reduce((sum, count) => sum + count, 0)
  const unitCount = aggregation.units.length
  const allSame = counts.every((count) => count === counts[0])
  const min = Math.min(...counts)
  const max = Math.max(...counts)

  const perUnitPhrase = allSame
    ? `${counts[0]} ${pluralize(counts[0], 'measurement')} per ${unitLabel}`
    : `an average of ${(totalRaw / unitCount).toFixed(1)} measurements per ${unitLabel} (ranging ` +
      `from ${min} to ${max})`

  return (
    `Because multiple sub-measurements were taken from each ${unitLabel} (${perUnitPhrase}), the ` +
    `${totalRaw} raw ${pluralize(totalRaw, 'measurement')} across ${unitCount} ` +
    `${pluralize(unitCount, unitLabel)} were each summarized to a single mean value per ${unitLabel} ` +
    'before this test was run, to avoid treating non-independent technical replicates as independent ' +
    'biological replicates. This averaging approach is a simplification: more complex nested designs ' +
    'may require mixed-effects models, which this version does not yet support.'
  )
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
  const { design, analysis, groupALabel, groupBLabel, excludedObservationCount, aggregation } =
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
    if (aggregation) {
      sentences.push(describeAggregationForMethods(aggregation, unitLabel))
    }
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
