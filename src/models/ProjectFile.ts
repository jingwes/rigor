/**
 * Milestone 6: the typed shape of a downloadable Rigor project file
 * (`project.rigor.json`).
 *
 * This is download-only for now - reopening a saved project is Milestone
 * 12's job (not built here). `schemaVersion` is bumped whenever this shape
 * changes, so a future "open project" feature can tell which shape it's
 * reading. Only fields for features that actually exist at this milestone
 * are included - there is still no user-driven exclusion feature beyond
 * automatic parsing issues (Milestone 9's scope).
 *
 * Milestone 11 additive extension: `analysisHistory` carries the full
 * append-only analysis-plan-lock/audit trail (see `AuditEntry.ts`), so the
 * downloaded project file is an honest, self-contained reproducibility
 * record - not just the final numbers, but when the plan was locked, when
 * results were viewed, and any changes made after that.
 */

import type { Dataset } from './Dataset'
import type { ExperimentDesign } from './ExperimentDesign'
import type { AuditEntry } from './AuditEntry'
import type {
  AnalysisType,
  NormalityDiagnosticsResult,
  PairedTTestResult,
  WelchTwoSampleTTestResult,
} from '../statistics/types'
import type { ChartCustomizationOptions, IntervalType } from '../components/charts/types'
import type { NestedAggregationResult } from '../features/analysis-plan/aggregateByExperimentalUnit'

export const PROJECT_FILE_SCHEMA_VERSION = 1

export interface ProjectMetadata {
  /** When this project file was generated (ISO 8601). */
  createdAt: string
}

export interface ProjectAnalysisResult {
  analysisType: Extract<AnalysisType, 'welch-two-sample-t-test' | 'paired-t-test'>
  result: WelchTwoSampleTTestResult | PairedTTestResult
  /** The design group name mapped to the analysis's "a" arm/condition. */
  groupALabel: string
  /** The design group name mapped to the analysis's "b" arm/condition. */
  groupBLabel: string
  /** Normality diagnostics computed for each arm, keyed by group label. */
  normalityDiagnosticsByGroup: Record<string, NormalityDiagnosticsResult>
  /**
   * Milestone 7: present only when this analysis ran on per-experimental-unit
   * aggregated (technical-replicate-averaged) values rather than raw
   * independent-groups/paired rows. The raw `dataset.rows` above are always
   * kept in full regardless - this is only the audit record of the
   * aggregation decision, for the report/methods text to read from.
   */
  aggregation?: NestedAggregationResult
}

export interface ProjectVisualizationSettings {
  intervalType: IntervalType
  chartCustomization: ChartCustomizationOptions
}

export interface RigorProject {
  schemaVersion: typeof PROJECT_FILE_SCHEMA_VERSION
  /** The exact `package.json` version of Rigor that produced this file. */
  appVersion: string
  projectMetadata: ProjectMetadata
  experimentDesign: ExperimentDesign
  dataset: Dataset
  /** Present only when a supported analysis actually ran successfully. */
  analysis?: ProjectAnalysisResult
  visualization?: ProjectVisualizationSettings
  /**
   * Milestone 11: the append-only analysis-plan-lock/audit trail, in the
   * exact order the events happened - e.g. `'plan-locked'`, `'results-
   * viewed'`, and any honest `'design-modified'` entries recorded after
   * that. Always present (possibly empty) once a project can be saved.
   */
  analysisHistory: AuditEntry[]
}
