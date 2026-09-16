"""Descriptive statistics for a single numeric sample.

Entry point: `compute_descriptives_json`. It (and every other public entry
point in this package) takes a JSON string and returns a JSON string, so the
TypeScript side never has to manage Pyodide proxy objects/lifetimes for
plain data - only primitive values cross the JS/Python boundary.
"""

from __future__ import annotations

import json
import math

import numpy as np
from scipy import stats


def _validate_numeric_list(values: object, *, min_n: int, label: str) -> list[float]:
    """Validate and coerce `values` into a list of finite floats.

    Raises `ValueError` with a message safe to surface to the caller if
    `values` is missing, empty, contains a non-numeric or non-finite entry,
    or has fewer than `min_n` observations. This worker assumes it is given
    already-validated finite numbers (Milestone 3's Dataset validation is
    responsible for that upstream), but it must never crash or silently
    misbehave if it is not - so every input is re-checked here regardless.
    """
    if values is None:
        raise ValueError(f"{label}: no data provided")
    if not isinstance(values, list):
        raise ValueError(f"{label}: expected a list of numbers")

    n_raw = len(values)
    if n_raw == 0:
        raise ValueError(f"{label}: at least one observation is required")

    cleaned: list[float] = []
    for raw in values:
        if isinstance(raw, bool) or not isinstance(raw, (int, float)):
            raise ValueError(f"{label}: value {raw!r} is not numeric")
        value = float(raw)
        if not math.isfinite(value):
            raise ValueError(
                f"{label}: non-finite value ({raw!r}) is not allowed - reject "
                "missing/NaN/Infinity values before they reach the statistics worker"
            )
        cleaned.append(value)

    if len(cleaned) < min_n:
        raise ValueError(
            f"{label}: at least {min_n} observation(s) required, got {len(cleaned)}"
        )

    return cleaned


def _descriptive_summary(values: list[float], *, label: str = "values") -> dict:
    """Compute the descriptive summary dict shared by every entry point.

    Returns n, mean, median, sample SD (ddof=1), the 25th/75th percentiles
    and their spread (IQR), min, max, and a 95% CI for the mean using the
    t-distribution (not the normal approximation - these are typically
    small, high-school-scale samples where that distinction matters).

    Judgment call: with n == 1, a sample SD and a CI for the mean are
    mathematically undefined (ddof=1 needs at least 2 observations), so
    those fields are `None` rather than raising - a single-observation
    "group" is still a legitimate thing to describe (mean/median/min/max all
    remain well defined), it just cannot report spread. Callers that require
    variance (the two-sample and paired t-tests) enforce their own stricter
    `min_n=2` via `_validate_numeric_list`.
    """
    data = _validate_numeric_list(values, min_n=1, label=label)
    arr = np.array(data, dtype=float)
    n = int(arr.size)

    mean = float(np.mean(arr))
    median = float(np.median(arr))
    q1 = float(np.percentile(arr, 25))
    q3 = float(np.percentile(arr, 75))
    iqr = q3 - q1
    minimum = float(np.min(arr))
    maximum = float(np.max(arr))

    sd: float | None = None
    ci_low: float | None = None
    ci_high: float | None = None

    if n >= 2:
        sd = float(np.std(arr, ddof=1))
        sem = sd / math.sqrt(n)
        if sem > 0:
            t_crit = float(stats.t.ppf(0.975, df=n - 1))
            ci_low = mean - t_crit * sem
            ci_high = mean + t_crit * sem
        else:
            # Zero variance: every observation is identical, so the mean is
            # known exactly and the CI collapses to a single point.
            ci_low = mean
            ci_high = mean

    return {
        "n": n,
        "mean": mean,
        "median": median,
        "sd": sd,
        "q1": q1,
        "q3": q3,
        "iqr": iqr,
        "min": minimum,
        "max": maximum,
        "ci95Low": ci_low,
        "ci95High": ci_high,
    }


def compute_descriptives_json(payload_json: str) -> str:
    """Entry point used by the statistics worker for `analysisType: "descriptives"`.

    `payload_json` encodes `{"values": [number, ...]}`.
    Returns a JSON string encoding the summary dict from `_descriptive_summary`.
    """
    payload = json.loads(payload_json)
    summary = _descriptive_summary(payload.get("values"), label="values")
    return json.dumps(summary)
