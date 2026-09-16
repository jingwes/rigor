import { useState } from 'react'
import type { WizardDraft } from '../wizardTypes'
import type { StudyRelationship } from '../../../models/ExperimentDesign'

interface RelationshipOption {
  key: string
  relationship: StudyRelationship
  label: string
  example: string
}

const TWO_GROUP_OPTIONS: RelationshipOption[] = [
  {
    key: 'independent',
    relationship: 'independent',
    label: 'Different subjects or samples were used in each condition.',
    example: 'Ten plants received treatment A and another ten plants received treatment B.',
  },
  {
    key: 'paired-same',
    relationship: 'paired',
    label: 'The same subjects or samples were measured in both conditions.',
    example: 'The same ten participants were measured before and after caffeine.',
  },
  {
    key: 'paired-matched',
    relationship: 'paired',
    label: 'Measurements were deliberately matched in pairs.',
    example: 'Each treated sample was paired with a matched control from the same donor.',
  },
  {
    key: 'unknown',
    relationship: 'unknown',
    label: "I'm not sure.",
    example: "That's okay - you can figure this out later.",
  },
]

const MULTI_GROUP_OPTIONS: RelationshipOption[] = [
  {
    key: 'independent',
    relationship: 'independent',
    label: 'A different set of subjects or samples was used for each condition.',
    example: 'Thirty plants were split into three groups of ten, one group per fertilizer.',
  },
  {
    key: 'repeated',
    relationship: 'repeated',
    label: 'The same subjects or samples were measured under every condition.',
    example: 'The same ten participants were measured at three different times of day.',
  },
  {
    key: 'unknown',
    relationship: 'unknown',
    label: "I'm not sure.",
    example: "That's okay - you can figure this out later.",
  },
]

function optionsForGroupCount(count: number | undefined): RelationshipOption[] {
  return (count ?? 0) >= 3 ? MULTI_GROUP_OPTIONS : TWO_GROUP_OPTIONS
}

function initialSelectedKey(
  options: RelationshipOption[],
  relationship: WizardDraft['relationship'],
): string | undefined {
  if (relationship === undefined) return undefined
  return options.find((option) => option.relationship === relationship)?.key
}

export interface RelationshipStepProps {
  draft: WizardDraft
  onUpdate: (patch: Partial<WizardDraft>) => void
}

export function RelationshipStep({ draft, onUpdate }: RelationshipStepProps) {
  const options = optionsForGroupCount(draft.groupsCount)
  const [selectedKey, setSelectedKey] = useState<string | undefined>(() =>
    initialSelectedKey(options, draft.relationship),
  )

  return (
    <div className="wizard-fields">
      <fieldset>
        <legend>Where did the measurements come from?</legend>
        {options.map((option) => (
          <div className="radio-option" key={option.key}>
            <label>
              <input
                type="radio"
                name="relationship"
                checked={selectedKey === option.key}
                onChange={() => {
                  setSelectedKey(option.key)
                  onUpdate({ relationship: option.relationship })
                }}
              />
              {option.label}
            </label>
            <p className="option-examples">{option.example}</p>
          </div>
        ))}
      </fieldset>
    </div>
  )
}
