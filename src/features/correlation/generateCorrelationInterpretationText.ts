/**
 * Milestone 10: a deterministic (NOT an LLM), neutral, factual
 * interpretation sentence for the correlation/regression results view -
 * mirrors `src/features/report/generateInterpretationText.ts`'s tone rules
 * (state the estimate/interval/p-value, then stop), but kept as its own
 * small function here rather than added to that module, since
 * `generateInterpretationText`'s `MethodsAnalysis` union is specific to the
 * group-comparison analyses and correlation/regression doesn't belong in it
 * (see this feature folder's module docs for the full rationale).
 *
 * The one rule that can NEVER be dropped here: correlation/regression
 * describes an association, never a cause. Every sentence this function
 * produces ends with an explicit non-causal disclaimer.
 */
import type { CorrelationDesign } from '../../models/CorrelationDesign'
import type { PearsonCorrelationRegressionResult } from '../../statistics/types'
import { formatPValue } from '../report/formatPValue'
import { formatStatistic } from '../report/formatStatistic'

export function generateCorrelationInterpretationText(
  design: CorrelationDesign,
  result: PearsonCorrelationRegressionResult,
): string {
  const xName = design.xVariable.name || 'X'
  const yName = design.yVariable.name || 'Y'
  const { correlation, regression } = result

  const ciText =
    correlation.ci95Low !== null && correlation.ci95High !== null
      ? ` (95% CI: ${formatStatistic(correlation.ci95Low, 3)} to ${formatStatistic(correlation.ci95High, 3)})`
      : ' (a confidence interval needs at least 4 observations)'

  const sentences: string[] = []

  sentences.push(
    `The Pearson correlation between ${xName} and ${yName} was r = ` +
      `${formatStatistic(correlation.r, 3)}${ciText}, ${formatPValue(correlation.pValue)}.`,
  )

  sentences.push(
    `The fitted regression line was ${yName} = ${formatStatistic(regression.intercept)} + ` +
      `${formatStatistic(regression.slope)} x ${xName} (95% CI for the slope: ` +
      `${formatStatistic(regression.slopeCi95Low)} to ${formatStatistic(regression.slopeCi95High)}), ` +
      `${formatPValue(regression.pValue)}.`,
  )

  sentences.push(
    `R-squared was ${formatStatistic(regression.rSquared, 3)}, meaning about ` +
      `${(regression.rSquared * 100).toFixed(1)}% of the variation in ${yName} is associated with ${xName}.`,
  )

  sentences.push(
    `This describes an association between ${xName} and ${yName}. It does not establish that ` +
      `changes in ${xName} cause changes in ${yName} - a correlation, however strong, is never by ` +
      'itself evidence of causation.',
  )

  return sentences.join(' ')
}
