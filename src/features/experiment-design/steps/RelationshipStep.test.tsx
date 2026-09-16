import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RelationshipStep } from './RelationshipStep'
import { createInitialDraft } from '../wizardTypes'

describe('RelationshipStep', () => {
  it('never says "paired" or "independent variable" as jargon labels - uses plain descriptions', () => {
    render(<RelationshipStep draft={{ ...createInitialDraft(), groupsCount: 2 }} onUpdate={vi.fn()} />)
    expect(
      screen.getByText('Different subjects or samples were used in each condition.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Ten plants received treatment A/)).toBeInTheDocument()
  })

  it('maps "I\'m not sure" to the unknown relationship, not a guess', () => {
    const onUpdate = vi.fn()
    render(<RelationshipStep draft={{ ...createInitialDraft(), groupsCount: 2 }} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByLabelText("I'm not sure."))

    expect(onUpdate).toHaveBeenCalledWith({ relationship: 'unknown' })
  })

  it('maps both "same subjects" and "matched pairs" options to paired', () => {
    const onUpdate = vi.fn()
    render(<RelationshipStep draft={{ ...createInitialDraft(), groupsCount: 2 }} onUpdate={onUpdate} />)

    fireEvent.click(
      screen.getByLabelText('The same subjects or samples were measured in both conditions.'),
    )
    expect(onUpdate).toHaveBeenCalledWith({ relationship: 'paired' })

    fireEvent.click(screen.getByLabelText('Measurements were deliberately matched in pairs.'))
    expect(onUpdate).toHaveBeenLastCalledWith({ relationship: 'paired' })
  })

  it('generalizes to independent / repeated / unsure for three or more groups', () => {
    const onUpdate = vi.fn()
    render(<RelationshipStep draft={{ ...createInitialDraft(), groupsCount: 3 }} onUpdate={onUpdate} />)

    expect(
      screen.getByText('A different set of subjects or samples was used for each condition.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('The same subjects or samples were measured under every condition.'),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByLabelText('The same subjects or samples were measured under every condition.'),
    )
    expect(onUpdate).toHaveBeenCalledWith({ relationship: 'repeated' })
  })
})
