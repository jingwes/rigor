import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SummaryStep } from './SummaryStep'
import { createInitialDraft } from '../wizardTypes'

describe('SummaryStep', () => {
  it('honestly reports unanswered/unsure fields instead of guessing', () => {
    render(
      <SummaryStep
        draft={createInitialDraft()}
        onEditStep={vi.fn()}
        onRestart={vi.fn()}
        onExit={vi.fn()}
        onEnterData={vi.fn()}
      />,
    )

    expect(screen.getAllByText(/weren't sure/).length).toBeGreaterThan(0)
    expect(
      screen.getByText(/Running an actual analysis isn't available in this version/),
    ).toBeInTheDocument()
  })

  it('never claims a statistical recommendation and has no test-name jargon', () => {
    render(
      <SummaryStep
        draft={createInitialDraft()}
        onEditStep={vi.fn()}
        onRestart={vi.fn()}
        onExit={vi.fn()}
        onEnterData={vi.fn()}
      />,
    )
    const bodyText = (document.body.textContent ?? '').toLowerCase()
    expect(bodyText).not.toContain('t-test')
    expect(bodyText).not.toContain('anova')
    expect(bodyText).toContain("isn't judging whether your")
  })

  it('reflects a fully answered draft in plain language', () => {
    const draft = {
      ...createInitialDraft(),
      outcomeName: 'plant height',
      outcomeType: 'continuous' as const,
      groupCountChoice: 'two' as const,
      groupsCount: 2,
      groupNames: ['Control', 'Fertilizer X'],
      relationship: 'independent' as const,
      experimentalUnitLabel: 'Plant',
      technicalReplicationPresent: false,
      exclusionsPredefined: true,
    }
    render(
      <SummaryStep
        draft={draft}
        onEditStep={vi.fn()}
        onRestart={vi.fn()}
        onExit={vi.fn()}
        onEnterData={vi.fn()}
      />,
    )

    expect(screen.getByText('plant height', { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/Control, Fertilizer X/)).toBeInTheDocument()
  })

  it('offers a working "Enter your data" action that hands over the captured design', () => {
    const onEnterData = vi.fn()
    const draft = {
      ...createInitialDraft(),
      outcomeName: 'plant height',
      outcomeType: 'continuous' as const,
      groupCountChoice: 'two' as const,
      groupsCount: 2,
      groupNames: ['Control', 'Fertilizer X'],
      relationship: 'independent' as const,
      experimentalUnitLabel: 'Plant',
      technicalReplicationPresent: false,
      exclusionsPredefined: true,
    }
    render(
      <SummaryStep
        draft={draft}
        onEditStep={vi.fn()}
        onRestart={vi.fn()}
        onExit={vi.fn()}
        onEnterData={onEnterData}
      />,
    )

    screen.getByRole('button', { name: 'Enter your data' }).click()

    expect(onEnterData).toHaveBeenCalledTimes(1)
    expect(onEnterData.mock.calls[0][0]).toMatchObject({
      outcome: { name: 'plant height', type: 'continuous' },
      relationship: 'independent',
    })
  })
})
