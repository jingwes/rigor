"""Chi-square / Fisher's exact contingency-table analysis (Milestone 9).

Entry points: `chi_square_test_json` (any r x c table, r >= 2, c >= 2) and
`fishers_exact_test_json` (2x2 tables only). Both take and return JSON
strings, same convention as every other module in this package - see
`descriptives.py`'s module docstring for why.

A contingency table here is ALWAYS "rows = groups, columns = outcome
categories" - `src/features/analysis-plan/buildContingencyTable.ts` is
responsible for producing counts in that shape and order; this module never
sees row/column labels, only counts, and always returns `observed`/
`expected` in the exact same order it was given so the TypeScript caller can
zip labels back on.

--- Chi-square test of association ------------------------------------------
`scipy.stats.chi2_contingency` is used directly, with its default
`correction=True` - which SciPy (like R's `chisq.test`, also `correct=TRUE`
by default) only actually applies when the table is 2x2 (Yates' continuity
correction). This was independently verified against real R output - see
`src/statistics/categorical.realPyodide.test.ts` for the exact numbers.

--- Cramer's V ---------------------------------------------------------------
V = sqrt(chi2 / (n * (min(rows, cols) - 1))) - the standard formula, valid
for any table size (not just 2x2). Independently verified against a
hand-computed/R cross-check in the golden test file above.

--- Fisher's exact test (2x2 only) -------------------------------------------
`scipy.stats.fisher_exact` returns the SAMPLE odds ratio (a*d)/(b*c) for
table [[a, b], [c, d]] - NOT R's `fisher.test` conditional MLE odds ratio,
which is a different (though related) estimator. Rigor reports SciPy's
simple cross-product ratio throughout, and its own separately-computed CI
uses that same estimator (see below) - the two are never mixed.

Odds ratio 95% CI: the standard Wald CI on the log-odds-ratio scale,
log(OR) +/- 1.96 * SE, where SE = sqrt(1/a + 1/b + 1/c + 1/d) (Woolf's
formula). Undefined (returned as `null`) whenever any cell is exactly zero,
since the log and/or the SE would involve a division by zero.

Risk difference: "risk" is defined as the proportion of column-0 (the first
outcome category, by column order) within each row/group - risk_i =
table[i][0] / row_total_i. The reported risk difference is risk(row 0) -
risk(row 1). Its 95% CI uses the standard (textbook) Wald CI for a
difference of two independent proportions: SE = sqrt(p1*(1-p1)/n1 +
p2*(1-p2)/n2), CI = diff +/- 1.96 * SE. (A Wilson-based interval was
considered but the Wald interval was chosen for this version: it is the
simpler, more widely-taught formula for the target audience, is well-defined
even when one risk is 0, and was straightforward to verify by hand/against
R - see the golden test file for the exact verification.)

Both odds ratio and risk difference (and their CIs) are 2x2-specific
concepts and are deliberately NOT generalized to larger tables - see
`chi_square_test_json`, which is the only entry point offered for tables
larger than 2x2.
"""

from __future__ import annotations

import json
import math

import numpy as np
from scipy import stats

MIN_TABLE_DIMENSION = 2


def _validate_table(table_raw: object, *, require_2x2: bool = False) -> list[list[int]]:
    """Validate `table_raw` into a rectangular list-of-lists of non-negative
    integer counts, with at least `MIN_TABLE_DIMENSION` rows and columns
    (and, if `require_2x2`, exactly 2 of each). Raises `ValueError` with a
    message safe to surface to the caller for anything degenerate: wrong
    shape, non-integer/negative counts, or a zero-total row/column.
    """
    if not isinstance(table_raw, list) or len(table_raw) == 0:
        raise ValueError("contingency table: expected a non-empty list of rows")

    n_cols: int | None = None
    table: list[list[int]] = []

    for row_index, row_raw in enumerate(table_raw):
        if not isinstance(row_raw, list) or len(row_raw) == 0:
            raise ValueError(f"contingency table: row {row_index} must be a non-empty list")
        if n_cols is None:
            n_cols = len(row_raw)
        elif len(row_raw) != n_cols:
            raise ValueError("contingency table: every row must have the same number of columns")

        row: list[int] = []
        for cell in row_raw:
            if isinstance(cell, bool) or not isinstance(cell, (int, float)):
                raise ValueError(f"contingency table: cell {cell!r} is not numeric")
            if not math.isfinite(cell):
                raise ValueError(f"contingency table: cell {cell!r} is not a finite number")
            if float(cell) != int(cell):
                raise ValueError(f"contingency table: cell {cell!r} is not an integer count")
            count = int(cell)
            if count < 0:
                raise ValueError("contingency table: counts cannot be negative")
            row.append(count)
        table.append(row)

    n_rows = len(table)
    if n_cols is None or n_rows < MIN_TABLE_DIMENSION or n_cols < MIN_TABLE_DIMENSION:
        raise ValueError(
            f"contingency table: at least {MIN_TABLE_DIMENSION} rows and "
            f"{MIN_TABLE_DIMENSION} columns are required"
        )

    if require_2x2 and (n_rows != 2 or n_cols != 2):
        raise ValueError(
            f"Fisher's exact test requires a 2x2 table, got {n_rows}x{n_cols}"
        )

    arr = np.array(table, dtype=float)
    if np.any(arr.sum(axis=1) == 0):
        raise ValueError("contingency table: every row must have at least one observation")
    if np.any(arr.sum(axis=0) == 0):
        raise ValueError("contingency table: every column must have at least one observation")

    return table


def _cramers_v(chi_square: float, n: int, n_rows: int, n_cols: int) -> float:
    """Cramer's V = sqrt(chi2 / (n * (min(rows, cols) - 1))). Generalizes to
    any table size (unlike odds ratio / risk difference)."""
    k = min(n_rows, n_cols)
    if n <= 0 or k <= 1:
        return 0.0
    return math.sqrt(chi_square / (n * (k - 1)))


def chi_square_test_json(payload_json: str) -> str:
    """`payload_json` encodes `{"table": [[count, ...], ...]}` (rows = groups,
    columns = outcome categories), any size with >= 2 rows and >= 2 columns.

    Returns JSON: `{"chiSquare", "degreesOfFreedom", "pValue", "observed",
    "expected", "n", "cramersV"}`. `observed`/`expected` are in the same
    row/column order as the input table.
    """
    payload = json.loads(payload_json)
    table = _validate_table(payload.get("table"))
    arr = np.array(table, dtype=float)

    chi2, p_value, dof, expected = stats.chi2_contingency(arr)
    n = int(arr.sum())

    if not math.isfinite(float(chi2)) or not math.isfinite(float(p_value)):
        raise ValueError(
            "Cannot compute the chi-square test: the result is not a finite number."
        )

    return json.dumps(
        {
            "chiSquare": float(chi2),
            "degreesOfFreedom": int(dof),
            "pValue": float(p_value),
            "observed": table,
            "expected": expected.tolist(),
            "n": n,
            "cramersV": _cramers_v(float(chi2), n, arr.shape[0], arr.shape[1]),
        }
    )


def fishers_exact_test_json(payload_json: str) -> str:
    """`payload_json` encodes `{"table": [[a, b], [c, d]]}` - a 2x2 table
    only (rows = groups, columns = outcome categories).

    Returns JSON: `{"oddsRatio", "pValue", "oddsRatioCi95Low",
    "oddsRatioCi95High", "riskDifference", "riskDifferenceCi95Low",
    "riskDifferenceCi95High"}`. See this module's docstring for the exact
    conventions/formulas used for each field.
    """
    payload = json.loads(payload_json)
    table = _validate_table(payload.get("table"), require_2x2=True)
    a, b = table[0]
    c, d = table[1]

    odds_ratio, p_value = stats.fisher_exact([[a, b], [c, d]])
    odds_ratio = float(odds_ratio)
    p_value = float(p_value)

    or_ci_low: float | None = None
    or_ci_high: float | None = None
    if a > 0 and b > 0 and c > 0 and d > 0:
        log_or = math.log(odds_ratio)
        se_log_or = math.sqrt(1 / a + 1 / b + 1 / c + 1 / d)
        or_ci_low = math.exp(log_or - 1.96 * se_log_or)
        or_ci_high = math.exp(log_or + 1.96 * se_log_or)

    n1 = a + b
    n2 = c + d
    risk1 = a / n1
    risk2 = c / n2
    risk_difference = risk1 - risk2
    se_risk_diff = math.sqrt(
        risk1 * (1 - risk1) / n1 + risk2 * (1 - risk2) / n2
    )
    rd_ci_low = risk_difference - 1.96 * se_risk_diff
    rd_ci_high = risk_difference + 1.96 * se_risk_diff

    return json.dumps(
        {
            "oddsRatio": odds_ratio,
            "pValue": p_value,
            "oddsRatioCi95Low": or_ci_low,
            "oddsRatioCi95High": or_ci_high,
            "riskDifference": risk_difference,
            "riskDifferenceCi95Low": rd_ci_low,
            "riskDifferenceCi95High": rd_ci_high,
        }
    )
