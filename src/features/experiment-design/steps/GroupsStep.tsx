import { useState } from 'react'
import type { GroupRole } from '../../../models/ExperimentDesign'
import type { WizardDraft, GroupCountChoice } from '../wizardTypes'
import { GROUP_ROLE_OPTIONS } from '../wizardTypes'

export interface GroupsStepProps {
  draft: WizardDraft
  onUpdate: (patch: Partial<WizardDraft>) => void
  onSetGroupCount: (choice: GroupCountChoice, count: number) => void
}

const MIN_THREE_OR_MORE = 3

/**
 * Parses the group-count text field's raw string into a whole number, or
 * `null` when it isn't one yet (empty, partial, or non-numeric) - `null`
 * deliberately means "not a committable value right now", not "0" or "3".
 */
function parseWholeNumber(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  if (!/^\d+$/.test(trimmed)) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function GroupsStep({ draft, onUpdate, onSetGroupCount }: GroupsStepProps) {
  const committedCount = draft.groupsCount ?? MIN_THREE_OR_MORE

  // Milestone 15 bug fix: this field used to be a fully-controlled number
  // input whose `value` came straight from `draft.groupsCount`, re-parsed
  // and re-clamped on every keystroke. Clearing the field to type a new
  // digit produced an empty string -> `Number('') ` -> not finite -> clamped
  // straight back to the minimum, so the field visually "snapped back"
  // before the student could type anything - it was never actually
  // possible to get from "3" to "4" by deleting and retyping. The fix: the
  // input's visible text is its own local state, independent of the
  // committed `draft.groupsCount` while the student is mid-edit. We only
  // push a new count up to the wizard (`onSetGroupCount`) once the text is
  // a valid, in-range whole number - on every such keystroke, so a normal
  // "type a full number" edit commits immediately - and we only forcibly
  // resync the visible text from the committed value on blur (or when the
  // committed value changes for some other reason, e.g. switching group-
  // count choices). An empty or partial string is simply left alone until
  // then, never fought.
  const [countText, setCountText] = useState(() => String(committedCount))
  // Tracks the last committed count this component has already reflected
  // into `countText`, so an external change to it (e.g. switching group-
  // count choices) can be noticed and re-synced during render - React's
  // documented "adjusting state when a prop changes" pattern - without an
  // effect (and the extra render an effect-driven `setState` would cause).
  const [syncedCommittedCount, setSyncedCommittedCount] = useState(committedCount)
  if (committedCount !== syncedCommittedCount) {
    setSyncedCommittedCount(committedCount)
    setCountText(String(committedCount))
  }

  function handleCountChange(rawText: string) {
    setCountText(rawText)
    const parsed = parseWholeNumber(rawText)
    if (parsed !== null && parsed >= MIN_THREE_OR_MORE) {
      onSetGroupCount('threeOrMore', parsed)
    }
  }

  function handleCountBlur() {
    const parsed = parseWholeNumber(countText)
    const resolved = parsed !== null && parsed >= MIN_THREE_OR_MORE ? parsed : committedCount
    setCountText(String(resolved))
    if (resolved !== committedCount) {
      onSetGroupCount('threeOrMore', resolved)
    }
  }

  function updateGroupName(index: number, value: string) {
    const names = [...draft.groupNames]
    names[index] = value
    onUpdate({ groupNames: names })
  }

  function updateGroupRole(index: number, value: string) {
    const role = (value === '' ? undefined : (value as GroupRole))
    const roles = [...(draft.groupRoles ?? [])]
    roles[index] = role
    onUpdate({ groupRoles: roles })
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
          <p className="option-examples">
            Choose this if you only have one set of measurements - for example, comparing your
            results to a known reference value, or just describing what you measured, without a
            second group to compare against.
          </p>
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
            value={countText}
            onChange={(e) => handleCountChange(e.target.value)}
            onBlur={handleCountBlur}
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

              {(draft.groupsCount ?? 0) >= 2 && (
                <>
                  <label htmlFor={`group-role-${index}`}>
                    Group {index + 1} role (optional)
                  </label>
                  <select
                    id={`group-role-${index}`}
                    value={draft.groupRoles?.[index] ?? ''}
                    onChange={(e) => updateGroupRole(index, e.target.value)}
                  >
                    {GROUP_ROLE_OPTIONS.map((option) => (
                      <option key={option.value ?? ''} value={option.value ?? ''}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          ))}
          {(draft.groupsCount ?? 0) >= 2 && (
            <p className="field-hint">
              Marking a group as a control or reference is optional - it doesn't change which
              statistical test is used, only how the results are described in plain language.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
