"""Normality diagnostics for a single numeric sample: Shapiro-Wilk + skewness.

Entry point: `normality_diagnostics_json`. Reuses `_validate_numeric_list`
from `descriptives.py` (see `two_group.py`'s docstring for why that name is
already available here without an `import` - `src/statistics/engine.ts`
loads these fixed source files into one shared Pyodide global namespace, in a
fixed order, exactly once).

DIAGNOSTIC ONLY. This module never decides which statistical test is used -
that decision is made entirely by the deterministic rules engine
(`src/rules/analysisRules.ts`), from the experiment design alone, before any
data exists. Nothing computed here is allowed to feed back into test choice;
it exists only to give a student an honest look at their data's shape
(a histogram - binned in TypeScript from the raw values already in the
browser - plus these two numbers).
"""

from __future__ import annotations

import json

import numpy as np
from scipy import stats

# scipy.stats.shapiro requires at least 3 observations; below that, both a
# normality test and a skewness statistic are undefined, so we report `None`
# rather than raising - the UI shows this as a small-sample disclaimer, not
# an error.
MIN_N_FOR_SHAPE_STATISTICS = 3


def normality_diagnostics_json(payload_json: str) -> str:
    """`payload_json` encodes `{"values": [number, ...]}`.

    Returns JSON: `{"n", "shapiroWilkW", "shapiroWilkPValue", "skewness"}`,
    where the last three are `null` when `n < 3`.
    """
    payload = json.loads(payload_json)
    values = _validate_numeric_list(payload.get("values"), min_n=1, label="values")
    arr = np.array(values, dtype=float)
    n = int(arr.size)

    shapiro_w: float | None = None
    shapiro_p: float | None = None
    skewness: float | None = None

    if n >= MIN_N_FOR_SHAPE_STATISTICS:
        shapiro_result = stats.shapiro(arr)
        shapiro_w = float(shapiro_result.statistic)
        shapiro_p = float(shapiro_result.pvalue)
        # bias=False: the adjusted Fisher-Pearson standardized moment
        # coefficient (matches R's `e1071::skewness(type = 2)`), the
        # conventional small-sample-corrected skewness estimator.
        skewness = float(stats.skew(arr, bias=False))

    return json.dumps(
        {
            "n": n,
            "shapiroWilkW": shapiro_w,
            "shapiroWilkPValue": shapiro_p,
            "skewness": skewness,
        }
    )
