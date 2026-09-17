/**
 * Milestone 12: reconstructs the same `AnalysisReportContext` shape
 * `AnalysisFlow.tsx` hands to `ReportView` - but from an already-computed
 * `ProjectAnalysisResult` stored in a reopened project file, instead of a
 * fresh Pyodide run. This is what lets reopening a saved project land the
 * student straight back on their results/report view without recomputing
 * anything the file already has the real, honest answer for.
 *
 * `buildStatisticsRequest` (the same pure, dependency-free function
 * `AnalysisFlow.tsx` itself uses) is reused here only to re-derive the raw
 * per-group VALUE ARRAYS a chart needs from the stored design + dataset -
 * this never touches Pyodide/SciPy and never recomputes a single statistic;
 * the test statistic, p-value, effect size, etc. all come straight from the
 * file's stored `analysis.result`.
 *
 * Only two-group ('welch-two-sample-t-test'/'paired-t-test') analyses are
 * ever present in a `RigorProject.analysis` field - see `ProjectFile.ts`.
 * This version of Rigor has never wired up "Save project" for the one-way-
 * ANOVA or categorical-association results views, so there is nothing to
 * restore for those; reopening a project without a stored `analysis` simply
 * lands back on the DESIGN/analysis flow (`AnalysisFlow`), which recomputes
 * normally, exactly as if the design/dataset had just been entered.
 */
import type { Dataset } from '../../models/Dataset'
import type { RigorProject } from '../../models/ProjectFile'
import type { PairedTTestResult, WelchTwoSampleTTestResult } from '../../statistics/types'
import { buildStatisticsRequest } from '../analysis-plan/buildStatisticsRequest'
import type { TwoGroupMethodsAnalysis } from '../report/generateMethodsText'
import type { AnalysisReportContext } from './AnalysisFlow'

function excludedRowCount(dataset: Dataset): number {
  const rowIds = new Set<string>()
  for (const issue of dataset.issues) {
    if (issue.severity === 'excluded' && issue.rowId) rowIds.add(issue.rowId)
  }
  return rowIds.size
}

function toTwoGroupMethodsAnalysis(analysis: NonNullable<RigorProject['analysis']>): TwoGroupMethodsAnalysis {
  if (analysis.analysisType === 'welch-two-sample-t-test') {
    return {
      analysisType: 'welch-two-sample-t-test',
      result: analysis.result as WelchTwoSampleTTestResult,
    }
  }
  return {
    analysisType: 'paired-t-test',
    result: analysis.result as PairedTTestResult,
  }
}

/**
 * Returns `undefined` when `project.analysis` is absent, or (defensively,
 * should never happen for a project this app itself produced) when the
 * stored analysis can no longer be reconciled with the stored dataset.
 * Never throws.
 */
export function buildReportContextFromProject(
  project: RigorProject,
): AnalysisReportContext | undefined {
  const { analysis } = project
  if (!analysis) return undefined

  const design = project.experimentDesign
  const dataset = project.dataset

  let valuesA: number[]
  let valuesB: number[]

  if (analysis.aggregation) {
    // Milestone 7 nested/technical-replicate path: the per-experimental-unit
    // aggregated values are already stored in the audit record itself, so
    // they're read straight back out rather than re-derived.
    valuesA = analysis.aggregation.units
      .filter((unit) => unit.group === analysis.groupALabel)
      .map((unit) => unit.aggregatedValue)
    valuesB = analysis.aggregation.units
      .filter((unit) => unit.group === analysis.groupBLabel)
      .map((unit) => unit.aggregatedValue)
  } else {
    const built = buildStatisticsRequest(design, dataset, analysis.analysisType)
    if (built.status !== 'ready') return undefined
    valuesA = built.request.payload.a
    valuesB = built.request.payload.b
  }

  return {
    kind: 'two-group',
    design,
    dataset,
    analysis: toTwoGroupMethodsAnalysis(analysis),
    groupALabel: analysis.groupALabel,
    groupBLabel: analysis.groupBLabel,
    valuesA,
    valuesB,
    normalityA: analysis.normalityDiagnosticsByGroup[analysis.groupALabel],
    normalityB: analysis.normalityDiagnosticsByGroup[analysis.groupBLabel],
    excludedObservationCount: excludedRowCount(dataset),
    aggregation: analysis.aggregation,
  }
}
