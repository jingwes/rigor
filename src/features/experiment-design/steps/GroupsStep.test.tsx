import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GroupsStep } from './GroupsStep'
import { createInitialDraft } from '../wizardTypes'
import type { WizardDraft } from '../wizardTypes'

/**
 * A thin stateful wrapper mirroring how `ExperimentDesignWizard`/
 * `wizardReducer` actually wire `GroupsStep` up (`onUpdate` merges a patch
 * into the draft, `onSetGroupCount` sets the choice+count) - needed so the
 * bug-reproduction test below exercises the real controlled-input feedback
 * loop, not just a single isolated `onChange` call.
 */
function GroupsStepHarness({ initialDraft }: { initialDraft: WizardDraft }) {
  const [draft, setDraft] = useState(initialDraft)
  return (
    <GroupsStep
      draft={draft}
      onUpdate={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      onSetGroupCount={(choice, count) =>
        setDraft((d) => ({ ...d, groupCountChoice: choice, groupsCount: count }))
      }
    />
  )
}

describe('GroupsStep', () => {
  it('has no statistical jargon (e.g. no mention of ANOVA)', () => {
    render(<GroupsStep draft={createInitialDraft()} onUpdate={vi.fn()} onSetGroupCount={vi.fn()} />)
    const bodyText = (document.body.textContent ?? '').toLowerCase()
    expect(bodyText).not.toContain('anova')
  })

  it('reports the chosen group count', () => {
    const onSetGroupCount = vi.fn()
    render(
      <GroupsStep draft={createInitialDraft()} onUpdate={vi.fn()} onSetGroupCount={onSetGroupCount} />,
    )

    fireEvent.click(screen.getByLabelText('Two groups'))

    expect(onSetGroupCount).toHaveBeenCalledWith('two', 2)
  })

  it('shows a name field per group once a group count is chosen', () => {
    const draft = {
      ...createInitialDraft(),
      groupCountChoice: 'two' as const,
      groupsCount: 2,
      groupNames: ['', ''],
    }
    render(<GroupsStep draft={draft} onUpdate={vi.fn()} onSetGroupCount={vi.fn()} />)

    expect(screen.getByLabelText('Group 1 name')).toBeInTheDocument()
    expect(screen.getByLabelText('Group 2 name')).toBeInTheDocument()
  })

  it('updates only the edited group name, preserving the others', () => {
    const onUpdate = vi.fn()
    const draft = {
      ...createInitialDraft(),
      groupCountChoice: 'two' as const,
      groupsCount: 2,
      groupNames: ['Control', ''],
    }
    render(<GroupsStep draft={draft} onUpdate={onUpdate} onSetGroupCount={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Group 2 name'), { target: { value: 'Drug A' } })

    expect(onUpdate).toHaveBeenCalledWith({ groupNames: ['Control', 'Drug A'] })
  })

  it('lets the exact number of groups be set for "three or more"', () => {
    const onSetGroupCount = vi.fn()
    const draft = {
      ...createInitialDraft(),
      groupCountChoice: 'threeOrMore' as const,
      groupsCount: 3,
      groupNames: ['', '', ''],
    }
    render(<GroupsStep draft={draft} onUpdate={vi.fn()} onSetGroupCount={onSetGroupCount} />)

    fireEvent.change(screen.getByLabelText('Exactly how many groups?'), {
      target: { value: '4' },
    })

    expect(onSetGroupCount).toHaveBeenCalledWith('threeOrMore', 4)
  })

  describe('the group-count number field (bug repro: could not edit past the default)', () => {
    // These use `fireEvent` (synchronous, no real timers) rather than
    // `userEvent`, driving the input through the exact DOM states a real
    // "select-all, backspace, type a digit" edit produces (value becomes
    // "" mid-edit, then the new digit), without depending on real-timer-
    // based keystroke simulation.
    it('lets the field go empty when clearing it, instead of snapping back to the old value', () => {
      // Root cause of the reported bug: the old `onChange` handler ran
      // `Number(e.target.value)` and re-committed a clamped number on every
      // keystroke, including the empty string produced mid-clear
      // (`Number('') === 0`, clamped back up to the minimum of 3) - so the
      // field's displayed value (driven straight from that committed
      // number) never actually became empty, and a backspace to delete "3"
      // had no visible effect. This test fails against that implementation.
      const initialDraft = {
        ...createInitialDraft(),
        groupCountChoice: 'threeOrMore' as const,
        groupsCount: 3,
        groupNames: ['', '', ''],
      }
      render(<GroupsStepHarness initialDraft={initialDraft} />)

      const input = screen.getByLabelText('Exactly how many groups?') as HTMLInputElement
      expect(input.value).toBe('3')

      // Select-all + backspace: the field becomes empty.
      fireEvent.change(input, { target: { value: '' } })
      expect(input.value).toBe('')

      // Type "4" into the now-empty field.
      fireEvent.change(input, { target: { value: '4' } })
      expect(input.value).toBe('4')

      // Tab away (blur) commits/confirms the new value.
      fireEvent.blur(input)
      expect(input.value).toBe('4')
    })

    it('reverts to the last committed count on blur if left empty or invalid', () => {
      const initialDraft = {
        ...createInitialDraft(),
        groupCountChoice: 'threeOrMore' as const,
        groupsCount: 5,
        groupNames: ['', '', '', '', ''],
      }
      render(<GroupsStepHarness initialDraft={initialDraft} />)

      const input = screen.getByLabelText('Exactly how many groups?') as HTMLInputElement
      fireEvent.change(input, { target: { value: '' } })
      expect(input.value).toBe('')

      fireEvent.blur(input)
      expect(input.value).toBe('5')
    })
  })

  describe('control/reference group designation', () => {
    it('does not show a role picker until there are at least two groups', () => {
      const draft = {
        ...createInitialDraft(),
        groupCountChoice: 'one' as const,
        groupsCount: 1,
        groupNames: [''],
      }
      render(<GroupsStep draft={draft} onUpdate={vi.fn()} onSetGroupCount={vi.fn()} />)
      expect(screen.queryByLabelText('Group 1 role (optional)')).not.toBeInTheDocument()
    })

    it('defaults every group to "No particular role" (untagged)', () => {
      const draft = {
        ...createInitialDraft(),
        groupCountChoice: 'two' as const,
        groupsCount: 2,
        groupNames: ['Control', 'Drug A'],
      }
      render(<GroupsStep draft={draft} onUpdate={vi.fn()} onSetGroupCount={vi.fn()} />)
      expect(screen.getByLabelText('Group 1 role (optional)')).toHaveValue('')
      expect(screen.getByLabelText('Group 2 role (optional)')).toHaveValue('')
    })

    it('lets a group be tagged as a control without touching the others', () => {
      const onUpdate = vi.fn()
      const draft = {
        ...createInitialDraft(),
        groupCountChoice: 'two' as const,
        groupsCount: 2,
        groupNames: ['Vehicle', 'Drug A'],
        groupRoles: [undefined, undefined],
      }
      render(<GroupsStep draft={draft} onUpdate={onUpdate} onSetGroupCount={vi.fn()} />)

      fireEvent.change(screen.getByLabelText('Group 1 role (optional)'), {
        target: { value: 'negative-control' },
      })

      expect(onUpdate).toHaveBeenCalledWith({ groupRoles: ['negative-control', undefined] })
    })

    it('offers all four documented role choices', () => {
      const draft = {
        ...createInitialDraft(),
        groupCountChoice: 'two' as const,
        groupsCount: 2,
        groupNames: ['Control', 'Treatment'],
      }
      render(<GroupsStep draft={draft} onUpdate={vi.fn()} onSetGroupCount={vi.fn()} />)
      const select = screen.getByLabelText('Group 1 role (optional)')
      const optionLabels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent)
      expect(optionLabels).toEqual([
        'No particular role',
        'Control (reference)',
        'Positive control',
        'Negative control',
      ])
    })
  })

  it('explains why you would choose "one group", with a concrete example', () => {
    render(<GroupsStep draft={createInitialDraft()} onUpdate={vi.fn()} onSetGroupCount={vi.fn()} />)
    expect(
      screen.getByText(/comparing your results to a known reference value/i),
    ).toBeInTheDocument()
  })
})
