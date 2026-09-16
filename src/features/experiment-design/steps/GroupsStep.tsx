import type { WizardDraft, GroupCountChoice } from '../wizardTypes'

export interface GroupsStepProps {
  draft: WizardDraft
  onUpdate: (patch: Partial<WizardDraft>) => void
  onSetGroupCount: (choice: GroupCountChoice, count: number) => void
}

const MIN_THREE_OR_MORE = 3

export function GroupsStep({ draft, onUpdate, onSetGroupCount }: GroupsStepProps) {
  function updateGroupName(index: number, value: string) {
    const names = [...draft.groupNames]
    names[index] = value
    onUpdate({ groupNames: names })
  }

  return (
    <div className="wizard-fields">
      <fieldset>
        <legend>How many conditions or groups are you comparing?</legend>
        <div className="radio-option">
          <label>
            <input
              type="radio"
              name="group-count"
              checked={draft.groupCountChoice === 'one'}
              onChange={() => onSetGroupCount('one', 1)}
            />
            One group
          </label>
        </div>
        <div className="radio-option">
          <label>
            <input
              type="radio"
              name="group-count"
              checked={draft.groupCountChoice === 'two'}
              onChange={() => onSetGroupCount('two', 2)}
            />
            Two groups
          </label>
        </div>
        <div className="radio-option">
          <label>
            <input
              type="radio"
              name="group-count"
              checked={draft.groupCountChoice === 'threeOrMore'}
              onChange={() => onSetGroupCount('threeOrMore', MIN_THREE_OR_MORE)}
            />
            Three or more groups
          </label>
        </div>
      </fieldset>

      {draft.groupCountChoice === 'threeOrMore' && (
        <div className="field">
          <label htmlFor="group-count-number">Exactly how many groups?</label>
          <input
            id="group-count-number"
            type="number"
            min={MIN_THREE_OR_MORE}
            value={draft.groupsCount ?? MIN_THREE_OR_MORE}
            onChange={(e) => {
              const parsed = Number(e.target.value)
              const count = Number.isFinite(parsed) ? Math.max(MIN_THREE_OR_MORE, parsed) : MIN_THREE_OR_MORE
              onSetGroupCount('threeOrMore', count)
            }}
          />
        </div>
      )}

      {draft.groupCountChoice && (
        <div className="field">
          <p>Give each group a name (optional, but it makes the summary easier to read).</p>
          {draft.groupNames.map((name, index) => (
            <div key={index} className="field">
              <label htmlFor={`group-name-${index}`}>Group {index + 1} name</label>
              <input
                id={`group-name-${index}`}
                type="text"
                value={name}
                onChange={(e) => updateGroupName(index, e.target.value)}
                placeholder={`e.g. ${index === 0 ? 'Control' : `Group ${index + 1}`}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
