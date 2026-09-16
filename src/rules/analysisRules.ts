/**
 * Milestone 2: deterministic analysis rules engine.
 *
 * `recommendAnalysis` is a pure function from a Milestone 1 `ExperimentDesign`
 * to an `AnalysisRecommendation`. It never looks at data, never runs a
 * statistical test, and never guesses. Where the design doesn't give enough
 * information, or where the correct analysis for a design isn't implemented
 * yet, the function returns `needs-information` or `unsupported` rather than
 * a best-effort recommendation ("correct refusal is better than incorrect
 * analysis").
 *
 * No React, no Pyodide/Python, no network access - just plain TypeScript over
 * the `ExperimentDesign` type.
 */

import type {
  ExperimentDesign,
  StudyRelationship,
} from '../models/ExperimentDesign'
import { EXPLANATIONS } from './explanations'
import type { AnalysisRecommendation, Question, Warning } from './types'

/** Exhaustiveness helper: a call site only type-checks if `x` is `never`. */
function assertNever(x: never): never {
  throw new Error(`rules engine: unhandled case ${JSON.stringify(x)}`)
}

const MULTIPLE_COMPARISONS_WARNING: Warning = {
  id: 'multiple-comparisons-correction-needed',
  message:
    'Following this omnibus test with pairwise comparisons between individual groups requires ' +
    'correction for multiple testing. Rigor computes these pairwise comparisons using the ' +
    'Holm-Bonferroni step-down correction automatically - only the corrected p-values should be ' +
    'interpreted, not the raw, uncorrected ones.',
  severity: 'caution',
}

const CATEGORICAL_TEST_CHOICE_PENDING_WARNING: Warning = {
  id: 'categorical-test-choice-pending-data',
  message:
    "Whether this is analyzed as a chi-square test or Fisher's exact test depends on the " +
    'observed cell counts once data is entered - it is not decided at the design stage.',
  severity: 'info',
}

const SAME_OR_DIFFERENT_SUBJECTS_QUESTION: Question = {
  id: 'same-or-different-subjects',
  prompt:
    'Were the measurements for these two groups taken from the same subjects/units (or ' +
    'deliberately matched pairs), or from different, unrelated subjects/units?',
}

function recommendForTwoContinuousGroups(
  relationship: StudyRelationship,
): AnalysisRecommendation {
  switch (relationship) {
    case 'independent':
      return {
        status: 'supported',
        analysisType: 'welch-two-sample-t-test',
        warnings: [],
        explanation: EXPLANATIONS['CONT-2-INDEPENDENT-001'],
        ruleId: 'CONT-2-INDEPENDENT-001',
      }

    case 'paired':
      return {
        status: 'supported',
        analysisType: 'paired-t-test',
        warnings: [],
        explanation: EXPLANATIONS['CONT-2-PAIRED-001'],
        ruleId: 'CONT-2-PAIRED-001',
      }

    // Judgment call (documented per the Milestone 2 spec): for exactly two
    // groups, "repeated" measures (the same units measured at two
    // timepoints) is structurally paired data - each pair of observations
    // is linked by unit, so a paired t-test is the sound mapping. "nested"
    // (e.g. a fixed matching/blocking structure across exactly two groups)
    // is treated the same way: the two measurements are still linked rather
    // than independent, so pooling them into an independent-samples test
    // would be wrong. We reuse CONT-2-PAIRED-001 for both rather than
    // invent a distinct rule ID, since the recommended analysis and
    // explanation are identical.
    case 'repeated':
    case 'nested':
      return {
        status: 'supported',
        analysisType: 'paired-t-test',
        warnings: [],
        explanation: EXPLANATIONS['CONT-2-PAIRED-001'],
        ruleId: 'CONT-2-PAIRED-001',
      }

    case 'unknown':
      return {
        status: 'needs-information',
        requiredQuestions: [SAME_OR_DIFFERENT_SUBJECTS_QUESTION],
        warnings: [],
        explanation: EXPLANATIONS['CONT-2-UNKNOWN-001'],
        ruleId: 'CONT-2-UNKNOWN-001',
      }

    default:
      return assertNever(relationship)
  }
}

function recommendForThreePlusContinuousGroups(
  relationship: StudyRelationship,
): AnalysisRecommendation {
  switch (relationship) {
    case 'independent':
      return {
        status: 'supported',
        analysisType: 'one-way-anova',
        warnings: [MULTIPLE_COMPARISONS_WARNING],
        explanation: EXPLANATIONS['CONT-3PLUS-INDEPENDENT-001'],
        ruleId: 'CONT-3PLUS-INDEPENDENT-001',
      }

    // Safety-critical branch: three or more repeated/paired measurements
    // from the same experimental units require a repeated-measures
    // analysis, which this version of Rigor has not implemented. We must
    // never fall back to one-way ANOVA here, because that would treat
    // non-independent observations as independent and understate
    // uncertainty. `analysisType` is left undefined.
    //
    // Judgment call: "nested" is not explicitly listed in the Milestone 2
    // spec for the 3+ group case, but a nested structure (e.g. repeated
    // sub-measurements clustered within the same experimental unit across
    // 3+ "groups") shares the same independence violation as paired/
    // repeated data. Given the project's "correct refusal is better than
    // incorrect analysis" philosophy, we treat it the same way rather than
    // silently defaulting to one-way ANOVA.
    case 'paired':
    case 'repeated':
    case 'nested':
      return {
        status: 'unsupported',
        analysisType: undefined,
        warnings: [],
        explanation: EXPLANATIONS['CONT-3PLUS-REPEATED-001'],
        ruleId: 'CONT-3PLUS-REPEATED-001',
      }

    case 'unknown':
      return {
        status: 'needs-information',
        requiredQuestions: [SAME_OR_DIFFERENT_SUBJECTS_QUESTION],
        warnings: [],
        explanation: EXPLANATIONS['CONT-3PLUS-UNKNOWN-001'],
        ruleId: 'CONT-3PLUS-UNKNOWN-001',
      }

    default:
      return assertNever(relationship)
  }
}

function recommendForContinuousOutcome(
  design: ExperimentDesign,
): AnalysisRecommendation {
  const groupCount = design.groups.count

  // No comparison described at all - nothing to recommend yet. Also covers
  // a defensively-handled count of 0, which shouldn't occur from the
  // wizard but is treated the same way rather than crashing.
  if (groupCount < 2) {
    return {
      status: 'needs-information',
      requiredQuestions: [
        {
          id: 'comparison-group-or-reference',
          prompt:
            'Do you have a second group to compare this outcome against, or a known reference ' +
            'value?',
        },
      ],
      warnings: [],
      explanation: EXPLANATIONS['CONT-1-GROUP-001'],
      ruleId: 'CONT-1-GROUP-001',
    }
  }

  if (groupCount === 2) {
    return recommendForTwoContinuousGroups(design.relationship)
  }

  return recommendForThreePlusContinuousGroups(design.relationship)
}

function recommendForCategoricalOutcome(
  design: ExperimentDesign,
): AnalysisRecommendation {
  if (design.groups.count >= 2) {
    return {
      status: 'supported',
      analysisType: 'categorical-association',
      warnings: [CATEGORICAL_TEST_CHOICE_PENDING_WARNING],
      explanation: EXPLANATIONS['CAT-ASSOCIATION-001'],
      ruleId: 'CAT-ASSOCIATION-001',
    }
  }

  // A single group's categorical outcome (e.g. just describing proportions)
  // is not itself a test of association.
  return {
    status: 'needs-information',
    requiredQuestions: [
      {
        id: 'comparison-group-or-expected-distribution',
        prompt:
          'Do you have a second group to compare against, or a known/expected distribution ' +
          'you want to compare your single group against? (Note: goodness-of-fit testing ' +
          'against an expected distribution is out of scope for this version of Rigor.)',
      },
    ],
    warnings: [],
    explanation: EXPLANATIONS['CAT-SINGLE-GROUP-001'],
    ruleId: 'CAT-SINGLE-GROUP-001',
  }
}

function unsupportedOutcomeRecommendation(
  ruleId:
    | 'OUTCOME-ORDINAL-UNSUPPORTED-001'
    | 'OUTCOME-COUNT-UNSUPPORTED-001'
    | 'OUTCOME-PROPORTION-UNSUPPORTED-001'
    | 'OUTCOME-UNKNOWN-UNSUPPORTED-001',
): AnalysisRecommendation {
  return {
    status: 'unsupported',
    analysisType: undefined,
    warnings: [],
    explanation: EXPLANATIONS[ruleId],
    ruleId,
  }
}

/**
 * Recommend an analysis for the given experimental design, following the
 * Milestone 2 decision table exactly. This is a pure function: same input,
 * same output, every time, with no side effects.
 */
export function recommendAnalysis(
  design: ExperimentDesign,
): AnalysisRecommendation {
  switch (design.outcome.type) {
    case 'continuous':
      return recommendForContinuousOutcome(design)

    case 'binary':
    case 'categorical':
      return recommendForCategoricalOutcome(design)

    case 'ordinal':
      return unsupportedOutcomeRecommendation('OUTCOME-ORDINAL-UNSUPPORTED-001')

    case 'count':
      return unsupportedOutcomeRecommendation('OUTCOME-COUNT-UNSUPPORTED-001')

    case 'proportion':
      return unsupportedOutcomeRecommendation(
        'OUTCOME-PROPORTION-UNSUPPORTED-001',
      )

    case 'unknown':
      return unsupportedOutcomeRecommendation('OUTCOME-UNKNOWN-UNSUPPORTED-001')

    default:
      return assertNever(design.outcome.type)
  }
}
