/**
 * Human-readable explanation strings for the analysis rules engine, keyed
 * by rule ID. Split out of `analysisRules.ts` so the decision logic in that
 * file stays easy to scan.
 *
 * Tone note: these strings must never claim to judge scientific validity.
 * Use phrasing like "consistent with your described design" or
 * "recommended analysis" - never "AI approved" or "your study is valid".
 */

export const EXPLANATIONS = {
  'CONT-2-INDEPENDENT-001':
    'Your outcome is numerical and you have two independent groups (different subjects in ' +
    'each group). A Welch two-sample t-test is the recommended analysis, consistent with your ' +
    "described design. Welch's test does not assume the two groups have equal variances, so it " +
    "is used here instead of the classic Student's pooled-variance t-test.",

  'CONT-2-PAIRED-001':
    'Your outcome is numerical and your two sets of measurements are linked - either the same ' +
    'subjects measured twice, or deliberately matched pairs. Because the measurements are not ' +
    'independent of each other, a paired t-test is the recommended analysis, consistent with ' +
    'your described design.',

  'CONT-2-UNKNOWN-001':
    "We can't recommend an analysis yet because it isn't clear whether your two groups of " +
    'measurements came from the same subjects (paired) or different subjects (independent). ' +
    'This distinction changes which test is appropriate, so we never guess it - please answer ' +
    'the question below before a recommendation can be made.',

  'CONT-3PLUS-INDEPENDENT-001':
    'Your outcome is numerical and you have three or more independent groups (different ' +
    'subjects in each group). A one-way ANOVA is the recommended analysis, consistent with ' +
    'your described design. Note: the overall (omnibus) ANOVA result is followed by pairwise ' +
    'comparisons between individual groups; those comparisons require correction for multiple ' +
    'testing, which Rigor applies automatically using the Holm-Bonferroni step-down correction.',

  'CONT-3PLUS-REPEATED-001':
    'Your experiment contains more than two repeated (or paired) measurements from the same ' +
    'experimental units. This requires a repeated-measures analysis that is not yet supported ' +
    'by this version of Rigor. We will not substitute a one-way ANOVA here, because treating ' +
    'repeated measurements as independent groups would understate the true uncertainty and can ' +
    'produce a misleading result.',

  'CONT-3PLUS-UNKNOWN-001':
    "We can't recommend an analysis yet because it isn't clear whether your three or more " +
    'groups of measurements are independent or come from the same experimental units measured ' +
    'repeatedly. This distinction changes which analysis is appropriate (and whether one is ' +
    'supported at all), so we never guess it - please answer the question below.',

  'CAT-ASSOCIATION-001':
    'Your outcome is categorical (or binary) and you have two or more groups to compare. A ' +
    'test of categorical association is the recommended type of analysis, consistent with your ' +
    "described design. Whether that ends up being a chi-square test or Fisher's exact test " +
    "depends on the actual observed cell counts in your data, which aren't available yet at the " +
    'design stage - this recommendation is therefore general/provisional and will be finalized ' +
    'once data is entered.',

  'CAT-SINGLE-GROUP-001':
    'You have a categorical outcome but only one group, so there is nothing to compare it ' +
    'against yet - a single-group categorical summary (proportions) is not a test of ' +
    "association. If you have a comparison group, or a known/expected distribution you'd like " +
    'to compare your data against (a goodness-of-fit test), let us know - goodness-of-fit is ' +
    "out of scope for this version of Rigor, and won't be recommended even if you have one.",

  'OUTCOME-ORDINAL-UNSUPPORTED-001':
    'Ordinal outcomes (ordered categories, such as a rating scale) are not yet supported by ' +
    'this version of Rigor. Analyzing ordinal data correctly requires methods (such as rank-' +
    'based tests) that have not yet been implemented and verified in this app, so we are not ' +
    'guessing at one.',

  'OUTCOME-COUNT-UNSUPPORTED-001':
    'Count outcomes (e.g. number of events per unit) are not yet supported by this version of ' +
    'Rigor. Analyzing count data correctly typically requires methods (such as Poisson or ' +
    'negative-binomial regression) that have not yet been implemented and verified in this app, ' +
    'so we are not guessing at one.',

  'OUTCOME-PROPORTION-UNSUPPORTED-001':
    'Proportion outcomes (a fraction or rate, rather than a raw count) are not yet supported by ' +
    'this version of Rigor. Analyzing proportion data correctly requires methods that have not ' +
    'yet been implemented and verified in this app, so we are not guessing at one.',

  'OUTCOME-UNKNOWN-UNSUPPORTED-001':
    "The type of your outcome variable isn't known, so we can't determine what analysis would " +
    'be appropriate. Rather than guess, this version of Rigor marks this as unsupported until ' +
    'the outcome type is specified.',

  'CONT-1-GROUP-001':
    'Your outcome is numerical, but you have only one group and no comparison has been ' +
    "described. There isn't yet anything to compare, so no analysis can be recommended - if you " +
    'add a comparison group, or describe a known reference value to compare against, a ' +
    'recommendation can be made.',
} as const

export type ExplanationRuleId = keyof typeof EXPLANATIONS
