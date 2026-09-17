/**
 * Milestone 12: a hand-rolled runtime validator for a parsed
 * `project.rigor.json` blob, run before it is ever trusted as a real
 * `RigorProject` (e.g. before restoring application state from it).
 *
 * Hand-rolled rather than adding a schema-validation library (e.g. zod):
 * `RigorProject`'s shape, while it has several nested objects, is a fixed,
 * fully-known TypeScript shape with no recursive or dynamically-keyed
 * structure of real concern (the one open-ended map,
 * `normalityDiagnosticsByGroup`, is a simple `string -> fixed-shape` record).
 * Every field can be checked with a short, readable `expect*` helper and a
 * specific error message, which keeps this dependency-free per the
 * project's "prefer simple dependencies" guidance, and keeps the exact
 * error message fully under this project's control (useful for the "clear,
 * specific error" requirement below) rather than relayed through a
 * generic library's own error formatting.
 *
 * Every check produces a specific, human-readable error naming the exact
 * field and what was wrong with it (e.g. `"experimentDesign.outcome.name:
 * expected a string, got number"') - never a generic "invalid file" message,
 * and never an uncaught `TypeError` from code that assumed a field existed.
 */
import type {
  ExperimentDesign,
  OutcomeType,
  StudyRelationship,
} from '../models/ExperimentDesign'
import type {
  Dataset,
  DatasetFormat,
  DatasetRow,
  IssueSeverity,
  ParsingIssue,
} from '../models/Dataset'
import type { AuditAction, AuditEntry } from '../models/AuditEntry'
import type {
  ProjectAnalysisResult,
  ProjectMetadata,
  ProjectVisualizationSettings,
  RigorProject,
} from '../models/ProjectFile'
import { PROJECT_FILE_SCHEMA_VERSION } from '../models/ProjectFile'
import type {
  NormalityDiagnosticsResult,
  PairedTTestResult,
  WelchTwoSampleTTestResult,
} from '../statistics/types'
import type { NestedAggregationResult, UnitAggregate } from '../features/analysis-plan/aggregateByExperimentalUnit'
import type { IntervalType } from '../components/charts/types'

export class ProjectValidationError extends Error {}

function fail(path: string, message: string): never {
  throw new ProjectValidationError(`${path}: ${message}`)
}

function describeType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function expectObject(value: unknown, path: string): Record<string, unknown> {
  if (!isPlainObject(value)) fail(path, `expected an object, got ${describeType(value)}`)
  return value
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, `expected a string, got ${describeType(value)}`)
  return value
}

function expectNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    fail(path, `expected a number, got ${describeType(value)}`)
  }
  return value
}

function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, `expected a boolean, got ${describeType(value)}`)
  return value
}

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, `expected an array, got ${describeType(value)}`)
  return value
}

function expectNullableNumber(value: unknown, path: string): number | null {
  if (value === null) return null
  return expectNumber(value, path)
}

function expectBooleanOrNull(value: unknown, path: string): boolean | null {
  if (value === null) return null
  return expectBoolean(value, path)
}

function expectOneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    fail(path, `expected one of [${allowed.join(', ')}], got ${JSON.stringify(value)}`)
  }
  return value as T
}

const OUTCOME_TYPES: readonly OutcomeType[] = [
  'continuous',
  'ordinal',
  'count',
  'binary',
  'categorical',
  'proportion',
  'unknown',
]
const RELATIONSHIPS: readonly StudyRelationship[] = [
  'independent',
  'paired',
  'repeated',
  'nested',
  'unknown',
]
const DATASET_FORMATS: readonly DatasetFormat[] = ['independent-groups', 'paired', 'nested']
const ISSUE_SEVERITIES: readonly IssueSeverity[] = ['excluded', 'warning']
const AUDIT_ACTIONS: readonly AuditAction[] = [
  'plan-locked',
  'results-viewed',
  'design-modified',
  'exclusion-changed',
  'data-modified',
]
const TWO_GROUP_ANALYSIS_TYPES = ['welch-two-sample-t-test', 'paired-t-test'] as const
const INTERVAL_TYPES: readonly IntervalType[] = ['sd', 'sem', 'ci95']

function validateExperimentDesign(value: unknown, path: string): ExperimentDesign {
  const v = expectObject(value, path)
  if (v.researchQuestion !== undefined) expectString(v.researchQuestion, `${path}.researchQuestion`)

  const outcome = expectObject(v.outcome, `${path}.outcome`)
  expectString(outcome.name, `${path}.outcome.name`)
  expectOneOf(outcome.type, OUTCOME_TYPES, `${path}.outcome.type`)
  if (outcome.unit !== undefined) expectString(outcome.unit, `${path}.outcome.unit`)

  const groups = expectObject(v.groups, `${path}.groups`)
  expectNumber(groups.count, `${path}.groups.count`)
  expectArray(groups.names, `${path}.groups.names`).forEach((name, i) =>
    expectString(name, `${path}.groups.names[${i}]`),
  )

  expectOneOf(v.relationship, RELATIONSHIPS, `${path}.relationship`)

  const experimentalUnit = expectObject(v.experimentalUnit, `${path}.experimentalUnit`)
  expectString(experimentalUnit.label, `${path}.experimentalUnit.label`)
  if (experimentalUnit.description !== undefined) {
    expectString(experimentalUnit.description, `${path}.experimentalUnit.description`)
  }

  const technicalReplication = expectObject(v.technicalReplication, `${path}.technicalReplication`)
  expectBooleanOrNull(technicalReplication.present, `${path}.technicalReplication.present`)
  if (technicalReplication.measurementsPerUnit !== undefined) {
    expectNumber(
      technicalReplication.measurementsPerUnit,
      `${path}.technicalReplication.measurementsPerUnit`,
    )
  }

  const repeatedMeasures = expectObject(v.repeatedMeasures, `${path}.repeatedMeasures`)
  expectBoolean(repeatedMeasures.present, `${path}.repeatedMeasures.present`)
  if (repeatedMeasures.timepoints !== undefined) {
    expectNumber(repeatedMeasures.timepoints, `${path}.repeatedMeasures.timepoints`)
  }

  if (v.blocking !== undefined) {
    const blocking = expectObject(v.blocking, `${path}.blocking`)
    expectBoolean(blocking.present, `${path}.blocking.present`)
    if (blocking.variable !== undefined) expectString(blocking.variable, `${path}.blocking.variable`)
  }

  if (v.primaryComparison !== undefined) expectString(v.primaryComparison, `${path}.primaryComparison`)
  expectBoolean(v.exclusionsPredefined, `${path}.exclusionsPredefined`)
  if (v.notes !== undefined) expectString(v.notes, `${path}.notes`)

  return value as ExperimentDesign
}

function validateParsingIssue(value: unknown, path: string): ParsingIssue {
  const v = expectObject(value, path)
  if (v.rowId !== undefined) expectString(v.rowId, `${path}.rowId`)
  if (v.field !== undefined) expectString(v.field, `${path}.field`)
  expectString(v.message, `${path}.message`)
  expectOneOf(v.severity, ISSUE_SEVERITIES, `${path}.severity`)
  return value as ParsingIssue
}

function validateDatasetRow(value: unknown, path: string): DatasetRow {
  const v = expectObject(value, path)
  expectString(v.rowId, `${path}.rowId`)
  expectObject(v.raw, `${path}.raw`)
  if (v.sampleId !== undefined) expectString(v.sampleId, `${path}.sampleId`)
  if (v.group !== undefined) expectString(v.group, `${path}.group`)
  if (v.value !== undefined) expectNumber(v.value, `${path}.value`)
  if (v.subjectId !== undefined) expectString(v.subjectId, `${path}.subjectId`)
  if (v.condition !== undefined) expectString(v.condition, `${path}.condition`)
  if (v.experimentalUnit !== undefined) expectString(v.experimentalUnit, `${path}.experimentalUnit`)
  if (v.subsample !== undefined) expectString(v.subsample, `${path}.subsample`)
  return value as DatasetRow
}

function validateDataset(value: unknown, path: string): Dataset {
  const v = expectObject(value, path)
  expectOneOf(v.format, DATASET_FORMATS, `${path}.format`)
  expectArray(v.columns, `${path}.columns`).forEach((c, i) => expectString(c, `${path}.columns[${i}]`))
  expectArray(v.rows, `${path}.rows`).forEach((row, i) => validateDatasetRow(row, `${path}.rows[${i}]`))
  expectArray(v.issues, `${path}.issues`).forEach((issue, i) =>
    validateParsingIssue(issue, `${path}.issues[${i}]`),
  )
  return value as Dataset
}

function validateNormalityDiagnostics(value: unknown, path: string): NormalityDiagnosticsResult {
  const v = expectObject(value, path)
  expectNumber(v.n, `${path}.n`)
  expectNullableNumber(v.shapiroWilkW, `${path}.shapiroWilkW`)
  expectNullableNumber(v.shapiroWilkPValue, `${path}.shapiroWilkPValue`)
  expectNullableNumber(v.skewness, `${path}.skewness`)
  return value as NormalityDiagnosticsResult
}

function validateWelchResult(value: unknown, path: string): WelchTwoSampleTTestResult {
  const v = expectObject(value, path)
  expectNumber(v.nA, `${path}.nA`)
  expectNumber(v.nB, `${path}.nB`)
  expectNumber(v.meanA, `${path}.meanA`)
  expectNumber(v.meanB, `${path}.meanB`)
  expectNullableNumber(v.sdA, `${path}.sdA`)
  expectNullableNumber(v.sdB, `${path}.sdB`)
  expectNumber(v.meanDifference, `${path}.meanDifference`)
  expectNumber(v.meanDifferenceCi95Low, `${path}.meanDifferenceCi95Low`)
  expectNumber(v.meanDifferenceCi95High, `${path}.meanDifferenceCi95High`)
  expectNumber(v.tStatistic, `${path}.tStatistic`)
  expectNumber(v.degreesOfFreedom, `${path}.degreesOfFreedom`)
  expectNumber(v.pValue, `${path}.pValue`)
  expectNullableNumber(v.effectSize, `${path}.effectSize`)
  expectOneOf(v.effectSizeMethod, ['hedges_g'] as const, `${path}.effectSizeMethod`)
  return value as WelchTwoSampleTTestResult
}

function validatePairedResult(value: unknown, path: string): PairedTTestResult {
  const v = expectObject(value, path)
  expectNumber(v.nPairs, `${path}.nPairs`)
  expectNumber(v.meanDifference, `${path}.meanDifference`)
  expectNumber(v.sdDifference, `${path}.sdDifference`)
  expectNumber(v.meanDifferenceCi95Low, `${path}.meanDifferenceCi95Low`)
  expectNumber(v.meanDifferenceCi95High, `${path}.meanDifferenceCi95High`)
  expectNumber(v.tStatistic, `${path}.tStatistic`)
  expectNumber(v.degreesOfFreedom, `${path}.degreesOfFreedom`)
  expectNumber(v.pValue, `${path}.pValue`)
  expectNullableNumber(v.effectSize, `${path}.effectSize`)
  expectOneOf(v.effectSizeMethod, ['cohens_d_z'] as const, `${path}.effectSizeMethod`)
  return value as PairedTTestResult
}

function validateUnitAggregate(value: unknown, path: string): UnitAggregate {
  const v = expectObject(value, path)
  expectString(v.unit, `${path}.unit`)
  expectString(v.group, `${path}.group`)
  expectNumber(v.aggregatedValue, `${path}.aggregatedValue`)
  expectNumber(v.rawValueCount, `${path}.rawValueCount`)
  return value as UnitAggregate
}

function validateAggregation(value: unknown, path: string): NestedAggregationResult {
  const v = expectObject(value, path)
  expectOneOf(v.method, ['mean'] as const, `${path}.method`)
  expectArray(v.units, `${path}.units`).forEach((u, i) => validateUnitAggregate(u, `${path}.units[${i}]`))
  return value as NestedAggregationResult
}

function validateProjectAnalysisResult(value: unknown, path: string): ProjectAnalysisResult {
  const v = expectObject(value, path)
  const analysisType = expectOneOf(v.analysisType, TWO_GROUP_ANALYSIS_TYPES, `${path}.analysisType`)
  if (analysisType === 'welch-two-sample-t-test') {
    validateWelchResult(v.result, `${path}.result`)
  } else {
    validatePairedResult(v.result, `${path}.result`)
  }
  expectString(v.groupALabel, `${path}.groupALabel`)
  expectString(v.groupBLabel, `${path}.groupBLabel`)
  const normalityByGroup = expectObject(
    v.normalityDiagnosticsByGroup,
    `${path}.normalityDiagnosticsByGroup`,
  )
  for (const [label, diagnostics] of Object.entries(normalityByGroup)) {
    validateNormalityDiagnostics(diagnostics, `${path}.normalityDiagnosticsByGroup.${label}`)
  }
  if (v.aggregation !== undefined) validateAggregation(v.aggregation, `${path}.aggregation`)
  return value as ProjectAnalysisResult
}

function validateVisualization(value: unknown, path: string): ProjectVisualizationSettings {
  const v = expectObject(value, path)
  expectOneOf(v.intervalType, INTERVAL_TYPES, `${path}.intervalType`)
  const chartCustomization = expectObject(v.chartCustomization, `${path}.chartCustomization`)
  // Deliberately shallow beyond this point: `ChartCustomizationOptions` is a
  // large, presentation-only options bag (fonts, colors, sizes) that never
  // changes the underlying numbers a chart displays - a missing/mistyped
  // field there only affects how a chart LOOKS, not scientific correctness,
  // so it doesn't warrant the same field-by-field rigor as the data/
  // analysis shapes above. Two of its required numeric fields are still
  // checked, so a bare `{}` here doesn't silently pass as "valid".
  expectNumber(chartCustomization.pointRadiusPx, `${path}.chartCustomization.pointRadiusPx`)
  expectNumber(chartCustomization.widthPx, `${path}.chartCustomization.widthPx`)
  return value as ProjectVisualizationSettings
}

function validateAuditEntry(value: unknown, path: string): AuditEntry {
  const v = expectObject(value, path)
  expectString(v.id, `${path}.id`)
  expectString(v.timestamp, `${path}.timestamp`)
  expectOneOf(v.action, AUDIT_ACTIONS, `${path}.action`)
  expectString(v.description, `${path}.description`)
  return value as AuditEntry
}

function validateProjectMetadata(value: unknown, path: string): ProjectMetadata {
  const v = expectObject(value, path)
  expectString(v.createdAt, `${path}.createdAt`)
  return value as ProjectMetadata
}

/**
 * Validates a parsed JSON blob against the CURRENT
 * (`PROJECT_FILE_SCHEMA_VERSION`) `RigorProject` shape. Callers are expected
 * to have already run the blob through `applyMigrations` (see
 * `migrations.ts`) if it claimed an older schema version - by the time this
 * runs, `schemaVersion` must already equal the current one.
 */
export function validateRigorProjectLatestShape(value: unknown): RigorProject {
  const v = expectObject(value, '<project>')

  const schemaVersion = expectNumber(v.schemaVersion, 'schemaVersion')
  if (schemaVersion !== PROJECT_FILE_SCHEMA_VERSION) {
    fail(
      'schemaVersion',
      `expected ${PROJECT_FILE_SCHEMA_VERSION} (after migration), got ${schemaVersion}`,
    )
  }

  expectString(v.appVersion, 'appVersion')
  validateProjectMetadata(v.projectMetadata, 'projectMetadata')
  validateExperimentDesign(v.experimentDesign, 'experimentDesign')
  validateDataset(v.dataset, 'dataset')
  if (v.analysis !== undefined) validateProjectAnalysisResult(v.analysis, 'analysis')
  if (v.visualization !== undefined) validateVisualization(v.visualization, 'visualization')
  expectArray(v.analysisHistory, 'analysisHistory').forEach((entry, i) =>
    validateAuditEntry(entry, `analysisHistory[${i}]`),
  )

  return value as RigorProject
}
