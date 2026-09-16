/**
 * Milestone 6: a deterministic (NOT an LLM), neutral, factual interpretation
 * sentence for the "Interpretation" section of the results page/report.
 *
 * Tone rules (per the project's spec): state what the estimate and interval
 * were, state the test's p-value, and stop there. Never say "the treatment
 * works", "proves", "confirms", or anything implying the alternative
 * hypothesis was "accepted" - a single sample never establishes that.
 */
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import { formatPValue } from './formatPValue'
import { formatStatistic } from './formatStatistic'
import type { MethodsAnalysis } from './generateMethodsText'

export interface GenerateInterpretationTextInput {
  design: ExperimentDesign
  analysis: MethodsAnalysis
  /** Only meaningful for the two 2-group analyses - see `MethodsAnalysis`. */
  groupALabel?: string
  /** Only meaningful for the two 2-group analyses - see `MethodsAnalysis`. */
  groupBLabel?: string
}

const TEST_DISPLAY_NAME: Record<MethodsAnalysis['analysisType'], string> = {
  'welch-two-sample-t-test': "Welch's two-sample t-test",
  'paired-t-test': 'paired-samples t-test',
  'one-way-anova': "Welch's one-way ANOVA",
  // See `generateCategoricalInterpretationText` below - the actual test name
  // (chi-square vs Fisher's exact) is read from the real test-selection
  // decision, not this static placeholder.
  'categorical-association': "a chi-square test of association or Fisher's exact test",
}

function generateCategoricalInterpretationText(
  analysis: Extract<MethodsAnalysis, { analysisType: 'categorical-association' }>,
): string {
  const { table, chiSquare, fishersExact, testSelection } = analysis.result
  const isFisher = testSelection.test === 'fishers-exact'
  const sentences: string[] = []

  if (isFisher && fishersExact) {
    sentences.push(
      `Fisher's exact test returned ${formatPValue(fishersExact.pValue)}. ` + testSelection.reason,
    )
  } else {
    sentences.push(
      `The chi-square test of association returned chi-square = ${formatStatistic(chiSquare.chiSquare)} ` +
        `(df = ${chiSquare.degreesOfFreedom}), ${formatPValue(chiSquare.pValue)}. ` + testSelection.reason,
    )
  }

  sentences.push(
    `Cramer's V, a measure of the strength of association (0 = no association, 1 = perfect ` +
      `association), was ${formatStatistic(chiSquare.cramersV)} for this ` +
      `${table.rowLabels.length} x ${table.colLabels.length} table.`,
  )

  if (fishersExact) {
    const orText =
      fishersExact.oddsRatioCi95Low !== null && fishersExact.oddsRatioCi95High !== null
        ? `${formatStatistic(fishersExact.oddsRatio)} (95% CI: ${formatStatistic(fishersExact.oddsRatioCi95Low)} to ${formatStatistic(fishersExact.oddsRatioCi95High)})`
        : `${formatStatistic(fishersExact.oddsRatio)} (CI not available - a table cell was zero)`
    sentences.push(
      `For "${table.rowLabels[0]}" vs "${table.rowLabels[1]}", the odds ratio for "${table.colLabels[0]}" ` +
        `was ${orText}, and the risk difference was ` +
        `${formatStatistic(fishersExact.riskDifference)} (95% CI: ` +
        `${formatStatistic(fishersExact.riskDifferenceCi95Low)} to ` +
        `${formatStatistic(fishersExact.riskDifferenceCi95High)}).`,
    )
  }

  sentences.push(
    'This describes the pattern observed in this sample; it does not, by itself, prove a cause, ' +
      "and it is not a judgment of whether the study's design was correct.",
  )

  return sentences.join(' ')
}

function generateAnovaInterpretationText(
  design: ExperimentDesign,
  analysis: Extract<MethodsAnalysis, { analysisType: 'one-way-anova' }>,
): string {
  const unit = design.outcome.unit ? ` ${design.outcome.unit}` : ' units'
  const { omnibus, pairwiseComparisons } = analysis.result
  const omnibusPValueText = formatPValue(omnibus.pValue)

  const sentences: string[] = []
  sentences.push(
    `The omnibus ${TEST_DISPLAY_NAME['one-way-anova']} testing for any difference among the ` +
      `groups returned F = ${formatStatistic(omnibus.fStatistic)} (df = ` +
      `${formatStatistic(omnibus.numeratorDf)}, ${formatStatistic(omnibus.denominatorDf)}), ` +
      `${omnibusPValueText}.`,
  )

  sentences.push(
    'Testing many pairs independently increases the chance of false-positive results. These ' +
      'pairwise comparisons have therefore been adjusted for multiple testing (Holm-Bonferroni); ' +
      'only the adjusted p-values below should be interpreted, not the raw, uncorrected ones.',
  )

  for (const pair of pairwiseComparisons) {
    sentences.push(
      `"${pair.groupALabel}" vs "${pair.groupBLabel}": estimated difference ` +
        `${formatStatistic(pair.meanDifference)}${unit}, adjusted ${formatPValue(pair.pValueAdjusted)}.`,
    )
  }

  sentences.push(
    'This describes the pattern observed in this sample; it does not, by itself, prove a cause, ' +
      "and it is not a judgment of whether the study's design was correct.",
  )

  return sentences.join(' ')
}

export function generateInterpretationText(
  input: GenerateInterpretationTextInput,
): string {
  const { design, analysis, groupALabel, groupBLabel } = input

  if (analysis.analysisType === 'one-way-anova') {
    return generateAnovaInterpretationText(design, {
      analysisType: 'one-way-anova',
      result: analysis.result,
    })
  }

  if (analysis.analysisType === 'categorical-association') {
    return generateCategoricalInterpretationText({
      analysisType: 'categorical-association',
      result: analysis.result,
    })
  }

  const unit = design.outcome.unit ? ` ${design.outcome.unit}` : ' units'
  const testName = TEST_DISPLAY_NAME[analysis.analysisType]
  const pValueText = formatPValue(analysis.result.pValue)

  const comparisonPhrase =
    analysis.analysisType === 'welch-two-sample-t-test'
      ? `between the "${groupALabel}" and "${groupBLabel}" groups`
      : `between the "${groupALabel}" and "${groupBLabel}" conditions`

  const meanDifference = analysis.result.meanDifference
  const ciLow = analysis.result.meanDifferenceCi95Low
  const ciHigh = analysis.result.meanDifferenceCi95High

  return (
    `The estimated difference ${comparisonPhrase} was ${formatStatistic(meanDifference)}${unit}, ` +
    `with a 95% confidence interval from ${formatStatistic(ciLow)} to ${formatStatistic(ciHigh)}${unit}. ` +
    `The ${testName} returned ${pValueText}. This describes the pattern observed in this sample; ` +
    "it does not, by itself, prove a cause, and it is not a judgment of whether the study's design " +
    'was correct.'
  )
}
