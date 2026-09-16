import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GroupsStep } from './GroupsStep'
import { createInitialDraft } from '../wizardTypes'

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
})
