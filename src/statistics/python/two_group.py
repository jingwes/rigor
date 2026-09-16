"""Two-group comparisons: Welch's two-sample t-test and the paired t-test.

Both entry points take and return JSON strings (see `descriptives.py` for why),
reuse `_descriptive_summary`/`_validate_numeric_list` from `descriptives.py`
for per-group stats, and never accept or evaluate arbitrary Python - only
numeric arrays flow in, only JSON-serializable results flow out.

`_descriptive_summary` and `_validate_numeric_list` are NOT imported here.
`src/statistics/engine.ts` loads this fixed, bundled source (never
user-supplied) into the same Pyodide global namespace as `descriptives.py`,
in order, exactly once at startup - so those names are already defined by
the time any function below runs. There is no Python package/import
machinery involved, deliberately: the worker's Python surface is just "run
these two known files, then call one of a fixed set of named functions."
"""

from __future__ import annotations

import json
import math

import numpy as np
from scipy import stats


def _hedges_g(
    mean_a: float, mean_b: float, sd_a: float, sd_b: float, n_a: int, n_b: int
) -> float | None:
    """Hedges' g: a bias-corrected standardized mean difference (a - b).

    We report Hedges' g rather than raw Cohen's d because Rigor targets
    high-school-scale sample sizes, where Cohen's d has a well-known
    small-sample upward bias; Hedges' g applies the small-sample correction
    factor J (Hedges & Olkin, 1985) on top of the pooled-SD standardized
    mean difference. Returns `None` if the pooled SD is zero (undefined).
    """
    df = n_a + n_b - 2
    pooled_variance = ((n_a - 1) * sd_a**2 + (n_b - 1) * sd_b**2) / df
    pooled_sd = math.sqrt(pooled_variance)
    if pooled_sd == 0:
        return None
    d = (mean_a - mean_b) / pooled_sd
    correction_j = 1 - (3 / (4 * df - 1))
    return d * correction_j


def welch_two_sample_t_test_json(payload_json: str) -> str:
    """Welch's two-sample t-test (`scipy.stats.ttest_ind(a, b, equal_var=False)`).

    `payload_json` encodes `{"a": [number, ...], "b": [number, ...]}`.

    Sign convention: `meanDifference = mean(a) - mean(b)`, and the reported
    CI/effect size follow the same convention (a positive difference means
    group a's mean is larger).
    """
    payload = json.loads(payload_json)
    a = _validate_numeric_list(payload.get("a"), min_n=2, label="group a")
    b = _validate_numeric_list(payload.get("b"), min_n=2, label="group b")

    arr_a = np.array(a, dtype=float)
    arr_b = np.array(b, dtype=float)

    test_result = stats.ttest_ind(arr_a, arr_b, equal_var=False)
    t_statistic = float(test_result.statistic)
    p_value = float(test_result.pvalue)
    degrees_of_freedom = float(test_result.df)

    if not math.isfinite(t_statistic) or not math.isfinite(p_value):
        # Both NaN (0/0, e.g. both groups constant at the same value) and
        # +/-Infinity (a nonzero difference divided by a zero standard
        # error, e.g. both groups constant but at different values) show up
        # here - either way the within-group variance is degenerate, and a
        # non-finite statistic could not be JSON-serialized to the caller
        # anyway, so this is surfaced as a clear error rather than crashing
        # on serialization or silently returning an unusable number.
        raise ValueError(
            "Cannot compute Welch's t-test: both groups have zero variance "
            "(every value within each group is identical), so the test "
            "statistic is undefined."
        )

    # SciPy >= 1.10 exposes this directly on the TtestResult; we rely on it
    # rather than hand-deriving the Welch-Satterthwaite CI ourselves.
    ci = test_result.confidence_interval(confidence_level=0.95)
    ci_low = float(ci.low)
    ci_high = float(ci.high)

    summary_a = _descriptive_summary(a, label="group a")
    summary_b = _descriptive_summary(b, label="group b")

    mean_difference = summary_a["mean"] - summary_b["mean"]
    effect_size = _hedges_g(
        summary_a["mean"],
        summary_b["mean"],
        summary_a["sd"],
        summary_b["sd"],
        summary_a["n"],
        summary_b["n"],
    )

    return json.dumps(
        {
            "nA": summary_a["n"],
            "nB": summary_b["n"],
            "meanA": summary_a["mean"],
            "meanB": summary_b["mean"],
            "sdA": summary_a["sd"],
            "sdB": summary_b["sd"],
            "meanDifference": mean_difference,
            "meanDifferenceCi95Low": ci_low,
            "meanDifferenceCi95High": ci_high,
            "tStatistic": t_statistic,
            "degreesOfFreedom": degrees_of_freedom,
            "pValue": p_value,
            "effectSize": effect_size,
            "effectSizeMethod": "hedges_g",
        }
    )


def paired_t_test_json(payload_json: str) -> str:
    """Paired t-test (`scipy.stats.ttest_rel`) on matched before/after pairs.

    `payload_json` encodes `{"a": [number, ...], "b": [number, ...]}`, two
    equal-length arrays in matching order (e.g. "before"/"after", or matched
    subject pairs). Differences are computed as `a - b`.
    """
    payload = json.loads(payload_json)
    a_raw = payload.get("a")
    b_raw = payload.get("b")

    if not isinstance(a_raw, list) or not isinstance(b_raw, list):
        raise ValueError("paired t-test requires two arrays of matched values")
    if len(a_raw) != len(b_raw):
        raise ValueError(
            "paired t-test requires equal-length arrays, got "
            f"{len(a_raw)} and {len(b_raw)}"
        )

    a = _validate_numeric_list(a_raw, min_n=2, label="condition A (before)")
    b = _validate_numeric_list(b_raw, min_n=2, label="condition B (after)")

    arr_a = np.array(a, dtype=float)
    arr_b = np.array(b, dtype=float)
    diffs = arr_a - arr_b

    test_result = stats.ttest_rel(arr_a, arr_b)
    t_statistic = float(test_result.statistic)
    p_value = float(test_result.pvalue)
    n_pairs = int(arr_a.size)
    degrees_of_freedom = n_pairs - 1

    if not math.isfinite(t_statistic) or not math.isfinite(p_value):
        # See the equivalent check in `welch_two_sample_t_test_json` above:
        # both NaN (mean difference exactly 0) and +/-Infinity (a nonzero
        # mean difference with zero SD) are treated as a degenerate,
        # undefined result rather than surfaced as a real number.
        raise ValueError(
            "Cannot compute the paired t-test: the within-pair differences "
            "have zero variance (every difference is identical), so the "
            "test statistic is undefined."
        )

    ci = test_result.confidence_interval(confidence_level=0.95)
    ci_low = float(ci.low)
    ci_high = float(ci.high)

    mean_difference = float(np.mean(diffs))
    sd_difference = float(np.std(diffs, ddof=1))
    # Cohen's d_z: the paired-design standardized effect size, the mean
    # difference expressed in units of the SD of the differences.
    effect_size = mean_difference / sd_difference if sd_difference != 0 else None

    return json.dumps(
        {
            "nPairs": n_pairs,
            "meanDifference": mean_difference,
            "sdDifference": sd_difference,
            "meanDifferenceCi95Low": ci_low,
            "meanDifferenceCi95High": ci_high,
            "tStatistic": t_statistic,
            "degreesOfFreedom": degrees_of_freedom,
            "pValue": p_value,
            "effectSize": effect_size,
            "effectSizeMethod": "cohens_d_z",
        }
    )
