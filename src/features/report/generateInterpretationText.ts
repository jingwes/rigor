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
  groupALabel: string
  groupBLabel: string
}

const TEST_DISPLAY_NAME: Record<MethodsAnalysis['analysisType'], string> = {
  'welch-two-sample-t-test': "Welch's two-sample t-test",
  'paired-t-test': 'paired-samples t-test',
}

export function generateInterpretationText(
  input: GenerateInterpretationTextInput,
): string {
  const { design, analysis, groupALabel, groupBLabel } = input
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
