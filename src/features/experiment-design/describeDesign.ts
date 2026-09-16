import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type { WizardStepId } from './wizardTypes'

export interface SummaryLine {
  label: string
  value: string
  editStep: WizardStepId
}

const OUTCOME_TYPE_LABELS: Record<ExperimentDesign['outcome']['type'], string> = {
  continuous: 'A numerical measurement',
  count: 'A count',
  binary: 'Yes/no',
  categorical: 'Categories',
  ordinal: 'A rating or ordered score',
  proportion: 'A proportion',
  unknown: "Not specified - you weren't sure",
}

function describeGroups(groups: ExperimentDesign['groups']): string {
  const namedList = groups.names.join(', ')
  return groups.count === 1
    ? `One group (${namedList}).`
    : `${groups.count} groups: ${namedList}.`
}

function describeRelationship(relationship: ExperimentDesign['relationship'], groupCount: number): string {
  if (groupCount === 1) {
    return "Not applicable - you're only working with one group, so this question doesn't apply."
  }
  switch (relationship) {
    case 'independent':
      return 'Independent - different subjects or samples were used in each condition.'
    case 'paired':
      return 'Paired - the same subjects/samples were used, or measurements were deliberately matched.'
    case 'repeated':
      return 'Repeated - the same subjects or samples were measured under every condition.'
    case 'nested':
      return 'Nested design.'
    case 'unknown':
    default:
      return "Not specified - you weren't sure."
  }
}

function describeUnit(unit: ExperimentDesign['experimentalUnit']): string {
  if (!unit.label) return 'Not specified.'
  return unit.description ? `${unit.label} (${unit.description})` : unit.label
}

function describeTechnicalReplication(tr: ExperimentDesign['technicalReplication']): string {
  if (tr.present === true) {
    return tr.measurementsPerUnit
      ? `Yes - about ${tr.measurementsPerUnit} measurement(s) per unit, typically.`
      : 'Yes.'
  }
  if (tr.present === false) return 'No.'
  return "Not specified - you weren't sure."
}

/**
 * Turn a completed design into a plain-language recap, one line per
 * question, each pointing back at the step where it was answered so the
 * summary can offer "edit this" links.
 */
export function describeDesign(design: ExperimentDesign): SummaryLine[] {
  const lines: SummaryLine[] = [
    {
      label: 'Research question',
      value: design.researchQuestion ?? 'Not specified.',
      editStep: 'researchQuestion',
    },
    {
      label: 'What was measured',
      value: design.outcome.name || 'Not specified.',
      editStep: 'researchQuestion',
    },
    {
      label: 'Type of measurement',
      value: OUTCOME_TYPE_LABELS[design.outcome.type],
      editStep: 'researchQuestion',
    },
  ]

  if (design.outcome.unit) {
    lines.push({ label: 'Unit', value: design.outcome.unit, editStep: 'researchQuestion' })
  }

  lines.push(
    { label: 'Groups', value: describeGroups(design.groups), editStep: 'groups' },
    {
      label: 'Independence',
      value: describeRelationship(design.relationship, design.groups.count),
      editStep: 'relationship',
    },
    {
      label: 'Experimental unit',
      value: describeUnit(design.experimentalUnit),
      editStep: 'experimentalUnit',
    },
    {
      label: 'Technical replication',
      value: describeTechnicalReplication(design.technicalReplication),
      editStep: 'experimentalUnit',
    },
    {
      label: 'Predefined exclusions',
      value: design.exclusionsPredefined ? 'Yes.' : 'No.',
      editStep: 'finalDetails',
    },
  )

  if (design.notes) {
    lines.push({ label: 'Anything else', value: design.notes, editStep: 'finalDetails' })
  }

  return lines
}
