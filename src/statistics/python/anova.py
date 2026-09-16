"""One-way ANOVA for 3+ independent continuous groups, plus Holm-Bonferroni-
corrected pairwise comparisons.

Entry point: `one_way_anova_json`. Reuses `_validate_numeric_list`/
`_descriptive_summary` from `descriptives.py` and `welch_two_sample_t_test_json`
from `two_group.py` - all three modules are loaded by `src/statistics/engine.ts`
into the SAME Pyodide global namespace, in a fixed order (descriptives.py,
then two_group.py, then this file), so those names are already defined by the
time any function below runs. No `import` machinery is involved, by design -
see `two_group.py`'s module docstring for the full explanation of this
pattern.

--- Omnibus test: Welch's (unequal-variance) one-way ANOVA ------------------
Rigor already prefers Welch's two-sample t-test over the classic pooled-
variance t-test for two groups, specifically to avoid assuming equal
variances across groups. For consistency, the omnibus test here is also a
Welch-type ANOVA (Welch, 1951) rather than the classic equal-variance
`scipy.stats.f_oneway` - SciPy has no built-in Welch ANOVA function, so the
formula below is implemented directly from the published formula (as used by,
e.g., R's `oneway.test(..., var.equal = FALSE)`) and independently verified
against real R output on a published dataset - see
`src/statistics/engine.realPyodide.test.ts` for the exact golden values and
their source. This is NOT the same as `f_oneway`; do not confuse the two.

--- Post-hoc pairwise comparisons -------------------------------------------
Every pair of groups is compared with the SAME Welch's two-sample t-test used
elsewhere in this app (by calling `welch_two_sample_t_test_json` directly,
reusing its Hedges' g / CI / p-value logic rather than reimplementing any of
it), then the resulting raw p-values are corrected for multiple testing with
the Holm-Bonferroni step-down procedure. Both the raw and the adjusted
p-value are returned, but callers must only ever present the ADJUSTED
p-value as "the" result for a pairwise comparison - the raw value is kept
only for transparency/debugging, never as the primary number shown to a
student.

--- Effect size for the omnibus result --------------------------------------
No variance-explained effect size (eta-squared/omega-squared) is reported for
the omnibus Welch ANOVA result. Both are conventionally defined from the
classic sum-of-squares decomposition of `f_oneway`, and neither has a
standard, independently-verifiable analogue for Welch's heteroscedastic
ANOVA that this project could validate against a published example with
real confidence - per the project's Section 26 guidance ("avoid effect-size
measures unless formulas and interpretation have been independently
validated"), it is safer to omit this than to guess. Hedges' g IS still
reported for each pairwise comparison, since that formula and its 2-group
use are already verified elsewhere in this codebase.
"""

from __future__ import annotations

import json
import math

import numpy as np
from scipy import stats

MIN_GROUPS = 3
MIN_VALUES_PER_GROUP = 2


def _holm_bonferroni(p_values: list[float]) -> list[float]:
    """Holm-Bonferroni step-down correction for a list of raw p-values.

    Standard procedure (Holm, 1979), matching R's `p.adjust(method = "holm")`:
    sort p-values ascending, multiply the i-th smallest (1-indexed) by
    (m - i + 1), then enforce monotonicity by taking a running maximum as
    rank increases, and cap every result at 1. Returned in the SAME order as
    the input `p_values` (not sorted).
    """
    m = len(p_values)
    order = sorted(range(m), key=lambda i: p_values[i])
    adjusted = [0.0] * m
    running_max = 0.0
    for rank, idx in enumerate(order):
        multiplier = m - rank
        candidate = p_values[idx] * multiplier
        running_max = max(running_max, candidate)
        adjusted[idx] = min(running_max, 1.0)
    return adjusted


def _welch_anova(labels: list[str], groups: list[list[float]]) -> dict:
    """Welch's (1951) unequal-variance one-way ANOVA.

    `groups` is a list of per-group numeric samples (already validated,
    each with >= 2 observations). Returns a dict with `fStatistic`,
    `numeratorDf`, `denominatorDf` (fractional, Welch-Satterthwaite-style),
    and `pValue`. See this module's docstring for the independent
    verification this formula was cross-checked against.
    """
    k = len(groups)
    arrays = [np.array(g, dtype=float) for g in groups]
    n_i = np.array([a.size for a in arrays], dtype=float)
    mean_i = np.array([a.mean() for a in arrays])
    var_i = np.array([a.var(ddof=1) for a in arrays])

    zero_variance_labels = [labels[i] for i in range(k) if var_i[i] == 0]
    if zero_variance_labels:
        names = ", ".join(f"'{label}'" for label in zero_variance_labels)
        raise ValueError(
            "Cannot compute the omnibus ANOVA: group(s) "
            f"{names} have zero variance (every value within the group is "
            "identical), so Welch's ANOVA is undefined."
        )

    weight_i = n_i / var_i
    sum_weight = weight_i.sum()
    grand_mean = float((weight_i * mean_i).sum() / sum_weight)

    numerator = float((weight_i * (mean_i - grand_mean) ** 2).sum() / (k - 1))
    tmp = float(
        ((1 - weight_i / sum_weight) ** 2 / (n_i - 1)).sum() / (k**2 - 1)
    )
    f_statistic = numerator / (1 + 2 * (k - 2) * tmp)
    numerator_df = float(k - 1)
    denominator_df = 1 / (3 * tmp)
    p_value = float(stats.f.sf(f_statistic, numerator_df, denominator_df))

    if not math.isfinite(f_statistic) or not math.isfinite(p_value):
        raise ValueError(
            "Cannot compute the omnibus ANOVA: the result is not a finite "
            "number (this can happen with extremely degenerate data)."
        )

    return {
        "method": "welch_anova",
        "fStatistic": f_statistic,
        "numeratorDf": numerator_df,
        "denominatorDf": denominator_df,
        "pValue": p_value,
    }


def one_way_anova_json(payload_json: str) -> str:
    """`payload_json` encodes `{"groups": [{"label": str, "values": [number, ...]}, ...]}`.

    Requires at least `MIN_GROUPS` (3) groups, each with at least
    `MIN_VALUES_PER_GROUP` (2) usable, finite numeric values, and unique,
    non-empty labels.

    Returns JSON:
    `{"groups": [per-group descriptive summary, keyed by "label"], "omnibus":
    {...}, "pairwiseComparisons": [...], "pairwiseCorrectionMethod":
    "holm_bonferroni"}`. Every entry in `pairwiseComparisons` carries BOTH
    `pValueRaw` and `pValueAdjusted` - callers must only ever display
    `pValueAdjusted` as the result of a comparison.
    """
    payload = json.loads(payload_json)
    groups_raw = payload.get("groups")

    if not isinstance(groups_raw, list):
        raise ValueError("one-way ANOVA requires a list of groups")
    if len(groups_raw) < MIN_GROUPS:
        raise ValueError(
            f"one-way ANOVA requires at least {MIN_GROUPS} groups, got {len(groups_raw)}"
        )

    labels: list[str] = []
    values_by_group: list[list[float]] = []

    for index, group in enumerate(groups_raw):
        if not isinstance(group, dict):
            raise ValueError(f"group {index}: expected an object with 'label' and 'values'")
        label = group.get("label")
        if not isinstance(label, str) or not label.strip():
            raise ValueError(f"group {index}: missing or invalid label")
        values = _validate_numeric_list(
            group.get("values"), min_n=MIN_VALUES_PER_GROUP, label=f"group '{label}'"
        )
        labels.append(label)
        values_by_group.append(values)

    if len(set(labels)) != len(labels):
        raise ValueError("one-way ANOVA requires unique group labels")

    group_summaries = []
    for label, values in zip(labels, values_by_group):
        summary = _descriptive_summary(values, label=f"group '{label}'")
        group_summaries.append({"label": label, **summary})

    omnibus = _welch_anova(labels, values_by_group)

    raw_pairs = []
    for i in range(len(labels)):
        for j in range(i + 1, len(labels)):
            pair_json = welch_two_sample_t_test_json(
                json.dumps({"a": values_by_group[i], "b": values_by_group[j]})
            )
            pair_result = json.loads(pair_json)
            raw_pairs.append(
                {
                    "groupALabel": labels[i],
                    "groupBLabel": labels[j],
                    "meanDifference": pair_result["meanDifference"],
                    "tStatistic": pair_result["tStatistic"],
                    "degreesOfFreedom": pair_result["degreesOfFreedom"],
                    "pValueRaw": pair_result["pValue"],
                    "effectSize": pair_result["effectSize"],
                    "effectSizeMethod": pair_result["effectSizeMethod"],
                }
            )

    adjusted_p_values = _holm_bonferroni([pair["pValueRaw"] for pair in raw_pairs])

    pairwise_comparisons = [
        {
            **pair,
            "pValueAdjusted": adjusted_p_value,
        }
        for pair, adjusted_p_value in zip(raw_pairs, adjusted_p_values)
    ]

    return json.dumps(
        {
            "groups": group_summaries,
            "omnibus": omnibus,
            "pairwiseComparisons": pairwise_comparisons,
            "pairwiseCorrectionMethod": "holm_bonferroni",
        }
    )
