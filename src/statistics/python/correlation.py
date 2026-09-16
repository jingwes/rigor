"""Pearson correlation + simple linear regression for two continuous
variables (Milestone 10).

Entry point: `pearson_correlation_regression_json`. Self-contained (does not
call into `descriptives.py`/`two_group.py`/etc.), so its position in
`src/statistics/engine.ts`'s install order relative to the other modules
doesn't matter.

Unlike every other analysis in this package, there are no "groups" here -
this describes the relationship between two continuous variables (x, y),
each assumed to be measured once per independent experimental unit. See
`src/models/CorrelationDesign.ts` for how Rigor captures/enforces that
"once per unit" assumption before any data ever reaches this worker; this
module itself has no way to check that assumption, since it only ever sees
two plain numeric arrays.

--- Pearson correlation ------------------------------------------------
`scipy.stats.pearsonr` gives r and its two-sided p-value directly. The CI for
r uses the standard Fisher z-transformation (Fisher, 1915): z = arctanh(r),
SE = 1/sqrt(n-3), CI_z = z +/- z_crit * SE where z_crit is the normal
distribution's exact 97.5th percentile (`scipy.stats.norm.ppf(0.975)`, ~=
1.959964), then back-transformed with tanh. This is exactly the CI R's own
`cor.test()` reports - independently verified against real R output (R's
built-in `cars` dataset) in `src/statistics/correlation.realPyodide.test.ts`;
see that file for the exact golden numbers and the hand-computed
cross-check of this formula.

The Fisher z SE is undefined at n=3 (1/sqrt(n-3) divides by zero), so the
CI fields are `null` whenever n < 4 - the correlation coefficient and its
p-value are still reported at n=3 (both `pearsonr` results are well-defined
there), only the CI is withheld. This mirrors the existing precedent in this
codebase of nullable fields for genuinely-undefined small-sample statistics
(see `_descriptive_summary` in `descriptives.py`).

--- Simple linear regression --------------------------------------------
`scipy.stats.linregress` gives slope, intercept, r, p-value (identical to
the correlation p-value above - both test the same null hypothesis, that the
true slope/correlation is zero), and the slope's standard error directly.
The slope's 95% CI is derived from that standard error using a
t-distribution critical value (df = n - 2): slope +/- t_crit * SE. This was
independently verified against R's `confint(lm(y ~ x))` on the same dataset -
see the golden test file.

R-squared is reported as r**2 (equivalent to `linregress`'s own
`rvalue ** 2` and to `summary(lm(...))$r.squared` for a simple
one-predictor regression).

Fitted values and residuals (`y - fitted`) are included so a caller can draw
a residuals-vs-x/residuals-vs-fitted diagnostic plot without recomputing the
regression line itself.

--- Degenerate input -----------------------------------------------------
Rejects mismatched-length x/y, n < `MIN_N` (3), any non-finite value, and a
constant x or y (correlation and the regression slope are both undefined
when one variable never varies) - see `_validate_pair` below.
"""

from __future__ import annotations

import json
import math

import numpy as np
from scipy import stats

MIN_N = 3
MIN_N_FOR_CORRELATION_CI = 4


def _validate_pair(payload: dict) -> tuple[list[float], list[float]]:
    x_raw = payload.get("x")
    y_raw = payload.get("y")

    if not isinstance(x_raw, list) or not isinstance(y_raw, list):
        raise ValueError("correlation/regression requires 'x' and 'y' lists of numbers")

    if len(x_raw) != len(y_raw):
        raise ValueError(
            f"'x' and 'y' must have the same length, got {len(x_raw)} and {len(y_raw)}"
        )

    if len(x_raw) < MIN_N:
        raise ValueError(
            f"correlation/regression requires at least {MIN_N} observations, got {len(x_raw)}"
        )

    def clean(raw_list: list, label: str) -> list[float]:
        cleaned: list[float] = []
        for raw in raw_list:
            if isinstance(raw, bool) or not isinstance(raw, (int, float)):
                raise ValueError(f"{label}: value {raw!r} is not numeric")
            value = float(raw)
            if not math.isfinite(value):
                raise ValueError(
                    f"{label}: non-finite value ({raw!r}) is not allowed - reject "
                    "missing/NaN/Infinity values before they reach the statistics worker"
                )
            cleaned.append(value)
        return cleaned

    x = clean(x_raw, "x")
    y = clean(y_raw, "y")

    if len(set(x)) == 1:
        raise ValueError(
            "Cannot compute correlation/regression: every x value is identical "
            f"({x[0]!r}) - x has no variance."
        )
    if len(set(y)) == 1:
        raise ValueError(
            "Cannot compute correlation/regression: every y value is identical "
            f"({y[0]!r}) - y has no variance."
        )

    return x, y


def pearson_correlation_regression_json(payload_json: str) -> str:
    """`payload_json` encodes `{"x": [number, ...], "y": [number, ...]}` -
    equal-length lists, n >= `MIN_N` (3), no constant x or y, no non-finite
    values.

    Returns JSON:
    `{"n", "correlation": {"r", "pValue", "ci95Low", "ci95High"},
    "regression": {"slope", "intercept", "slopeCi95Low", "slopeCi95High",
    "pValue", "rSquared", "fittedValues", "residuals"}}`.
    `correlation.ci95Low`/`ci95High` are `null` when n < 4 (see module
    docstring).
    """
    payload = json.loads(payload_json)
    x, y = _validate_pair(payload)
    n = len(x)
    x_arr = np.array(x, dtype=float)
    y_arr = np.array(y, dtype=float)

    r, p_value = stats.pearsonr(x_arr, y_arr)
    r = float(r)
    p_value = float(p_value)

    r_ci_low: float | None = None
    r_ci_high: float | None = None
    if n >= MIN_N_FOR_CORRELATION_CI:
        z = math.atanh(r)
        se_z = 1 / math.sqrt(n - 3)
        z_crit = float(stats.norm.ppf(0.975))
        r_ci_low = math.tanh(z - z_crit * se_z)
        r_ci_high = math.tanh(z + z_crit * se_z)

    fit = stats.linregress(x_arr, y_arr)
    slope = float(fit.slope)
    intercept = float(fit.intercept)
    slope_se = float(fit.stderr)
    t_crit = float(stats.t.ppf(0.975, df=n - 2))
    slope_ci_low = slope - t_crit * slope_se
    slope_ci_high = slope + t_crit * slope_se
    r_squared = float(fit.rvalue) ** 2
    regression_p_value = float(fit.pvalue)

    fitted = slope * x_arr + intercept
    residuals = y_arr - fitted

    finite_checks = [r, p_value, slope, intercept, slope_ci_low, slope_ci_high, r_squared, regression_p_value]
    if r_ci_low is not None:
        finite_checks.append(r_ci_low)
    if r_ci_high is not None:
        finite_checks.append(r_ci_high)

    if not all(math.isfinite(v) for v in finite_checks):
        raise ValueError(
            "Cannot compute correlation/regression: the result is not a finite number "
            "(this can happen with extremely degenerate data)."
        )

    return json.dumps(
        {
            "n": n,
            "correlation": {
                "r": r,
                "pValue": p_value,
                "ci95Low": r_ci_low,
                "ci95High": r_ci_high,
            },
            "regression": {
                "slope": slope,
                "intercept": intercept,
                "slopeCi95Low": slope_ci_low,
                "slopeCi95High": slope_ci_high,
                "pValue": regression_p_value,
                "rSquared": r_squared,
                "fittedValues": fitted.tolist(),
                "residuals": residuals.tolist(),
            },
        }
    )
