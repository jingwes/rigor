/**
 * The computation engine shared by the real browser worker
 * (`statistics.worker.ts`) and the Node-based integration tests
 * (`statistics.worker.test.ts`) - both drive a real `PyodideInterface`
 * through the exact same code path, so a test that passes here is a real
 * guarantee about what the worker computes, not a mock's opinion of it.
 *
 * This module only knows how to run the fixed set of predefined analyses.
 * It never builds a Python source string from a request payload, and never
 * exposes a way to run caller-supplied Python - the only Python it ever
 * executes is the bundled, build-time `descriptives.py`/`two_group.py`
 * source pulled in below via Vite's `?raw` import.
 */
import type { PyCallable, PyDict } from 'pyodide/ffi'
import type { PyodideInterface } from 'pyodide'

import descriptivesSource from './python/descriptives.py?raw'
import twoGroupSource from './python/two_group.py?raw'
import normalitySource from './python/normality.py?raw'
import anovaSource from './python/anova.py?raw'
import type {
  AnalysisResult,
  DescriptivesResult,
  NormalityDiagnosticsResult,
  OneWayAnovaResult,
  PairedTTestResult,
  StatisticsRequest,
  StatisticsResponse,
  WelchTwoSampleTTestResult,
} from './types'

/**
 * Defines Rigor's fixed statistics functions in `pyodide`'s global Python
 * namespace. Must be called once, after `numpy`/`scipy` have been loaded via
 * `pyodide.loadPackage`, before any analysis is run.
 */
export function installStatisticsPython(pyodide: PyodideInterface): void {
  pyodide.runPython(descriptivesSource)
  pyodide.runPython(twoGroupSource)
  pyodide.runPython(normalitySource)
  // anova.py calls `welch_two_sample_t_test_json` (from two_group.py) and
  // `_descriptive_summary`/`_validate_numeric_list` (from descriptives.py)
  // directly out of the shared namespace, so it must be installed last.
  pyodide.runPython(anovaSource)
}

/** Name of the Python entry point for each analysis type, kept in one place. */
const ENTRY_POINT_BY_ANALYSIS_TYPE = {
  descriptives: 'compute_descriptives_json',
  'welch-two-sample-t-test': 'welch_two_sample_t_test_json',
  'paired-t-test': 'paired_t_test_json',
  'normality-diagnostics': 'normality_diagnostics_json',
  'one-way-anova': 'one_way_anova_json',
} as const satisfies Record<StatisticsRequest['analysisType'], string>

/**
 * Calls one of the fixed, predefined Python entry points above with a JSON
 * string payload, and JSON-parses its JSON string result. This is the only
 * shape of call this module ever makes into Python: a fixed function name
 * (never derived from the request) plus a JSON-serialized data payload.
 */
function callJsonEntryPoint(
  pyodide: PyodideInterface,
  functionName: string,
  payload: unknown,
): unknown {
  const globals = pyodide.globals as unknown as PyDict
  const fn = globals.get(functionName) as PyCallable | undefined
  if (!fn) {
    throw new Error(
      `Internal error: Python function "${functionName}" is not defined`,
    )
  }
  try {
    const resultJson = fn(JSON.stringify(payload)) as string
    return JSON.parse(resultJson)
  } finally {
    fn.destroy()
  }
}

function computeResult(
  pyodide: PyodideInterface,
  request: StatisticsRequest,
): AnalysisResult {
  switch (request.analysisType) {
    case 'descriptives': {
      const result = callJsonEntryPoint(
        pyodide,
        ENTRY_POINT_BY_ANALYSIS_TYPE.descriptives,
        request.payload,
      ) as DescriptivesResult
      return { analysisType: 'descriptives', result }
    }
    case 'welch-two-sample-t-test': {
      const result = callJsonEntryPoint(
        pyodide,
        ENTRY_POINT_BY_ANALYSIS_TYPE['welch-two-sample-t-test'],
        request.payload,
      ) as WelchTwoSampleTTestResult
      return { analysisType: 'welch-two-sample-t-test', result }
    }
    case 'paired-t-test': {
      const result = callJsonEntryPoint(
        pyodide,
        ENTRY_POINT_BY_ANALYSIS_TYPE['paired-t-test'],
        request.payload,
      ) as PairedTTestResult
      return { analysisType: 'paired-t-test', result }
    }
    case 'normality-diagnostics': {
      const result = callJsonEntryPoint(
        pyodide,
        ENTRY_POINT_BY_ANALYSIS_TYPE['normality-diagnostics'],
        request.payload,
      ) as NormalityDiagnosticsResult
      return { analysisType: 'normality-diagnostics', result }
    }
    case 'one-way-anova': {
      const result = callJsonEntryPoint(
        pyodide,
        ENTRY_POINT_BY_ANALYSIS_TYPE['one-way-anova'],
        request.payload,
      ) as OneWayAnovaResult
      return { analysisType: 'one-way-anova', result }
    }
  }
}

/**
 * Extracts a human-readable message from whatever `pyodide.runPython`/a
 * Python call throws. Pyodide surfaces Python exceptions as a `PythonError`
 * (an `Error` subclass) whose `message` is the Python traceback; we keep
 * the traceback out of the user-facing `message` and instead attach it as
 * `details`, deriving a short first line for `message`.
 */
function describeError(error: unknown): { message: string; details?: string } {
  if (error instanceof Error) {
    const details = error.message
    // A raised `ValueError("...")` shows up in the Pyodide traceback as a
    // line like `ValueError: <message>` - prefer surfacing just that if
    // present, since it is the specific, actionable validation message our
    // Python code raises; otherwise fall back to the first line.
    const valueErrorMatch = /ValueError:\s*(.+)/.exec(details)
    const message = valueErrorMatch
      ? valueErrorMatch[1].trim()
      : (details.split('\n')[0] ?? details)
    return { message, details }
  }
  return { message: 'Unknown error while computing statistics' }
}

/**
 * Runs a single predefined analysis against a live Pyodide interpreter.
 * Always resolves with a typed `StatisticsResponse` - invalid input or a
 * computation error (e.g. zero variance) is caught here and reported via
 * `success: false`, never thrown.
 */
export function runAnalysis(
  pyodide: PyodideInterface,
  request: StatisticsRequest,
): StatisticsResponse {
  try {
    const result = computeResult(pyodide, request)
    return { id: request.id, success: true, result }
  } catch (error) {
    return { id: request.id, success: false, error: describeError(error) }
  }
}
