import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { WizardProvider } from '../WizardProvider'
import { ExperimentDesignWizard } from '../ExperimentDesignWizard'

/**
 * Milestone 14 integration tests: drives the real wizard (not a mocked
 * `SummaryStep`) all the way to the summary step, then exercises the
 * method-description cross-checker's three actions end to end.
 */
function driveToSummary() {
  fireEvent.change(screen.getByLabelText('What did you measure?'), {
    target: { value: 'reaction time' },
  })
  fireEvent.click(screen.getByLabelText('A numerical measurement'))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

  fireEvent.click(screen.getByLabelText('Two groups'))
  fireEvent.change(screen.getByLabelText('Group 1 name'), { target: { value: 'No coffee' } })
  fireEvent.change(screen.getByLabelText('Group 2 name'), { target: { value: 'Coffee' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

  fireEvent.click(
    screen.getByLabelText('Different subjects or samples were used in each condition.'),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

  fireEvent.click(screen.getByLabelText('Participant'))
  fireEvent.click(screen.getByLabelText('No'))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

  fireEvent.click(screen.getByLabelText('Yes'))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

  expect(screen.getByText('Your experimental design, so far')).toBeInTheDocument()
}

const MISMATCH_TEXT =
  'The same participants completed the reaction-time test before and after drinking coffee.'

describe('MethodDescriptionCheck - wizard integration', () => {
  it('shows an advisory alert when the description suggests a different design than selected', () => {
    render(
      <WizardProvider>
        <ExperimentDesignWizard onExit={() => {}} onEnterData={() => {}} />
      </WizardProvider>,
    )
    driveToSummary()

    // Consistent with the selected design ("independent") before checking.
    expect(screen.getByText(/Independent - different subjects/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Describe your experiment in your own words'), {
      target: { value: MISMATCH_TEXT },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check my description' }))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/before and after|same participants/)
    expect(screen.getByRole('button', { name: 'Review design' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'My selection is correct' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Explain why this was flagged' })).toBeInTheDocument()

    // The design itself is unaffected merely by running the check.
    expect(screen.getByText(/Independent - different subjects/)).toBeInTheDocument()
  })

  it('"Explain why this was flagged" reveals the matched phrase and reasoning', () => {
    render(
      <WizardProvider>
        <ExperimentDesignWizard onExit={() => {}} onEnterData={() => {}} />
      </WizardProvider>,
    )
    driveToSummary()

    fireEvent.change(screen.getByLabelText('Describe your experiment in your own words'), {
      target: { value: MISMATCH_TEXT },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check my description' }))

    expect(screen.queryByText(/possible design mismatch/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Explain why this was flagged' }))
    expect(screen.getByText(/possible design mismatch/i)).toBeInTheDocument()
    expect(screen.getByText(/independent samples/i)).toBeInTheDocument()
  })

  it('does NOT show an alert when the description is consistent with the selected design', () => {
    render(
      <WizardProvider>
        <ExperimentDesignWizard onExit={() => {}} onEnterData={() => {}} />
      </WizardProvider>,
    )
    driveToSummary()

    fireEvent.change(screen.getByLabelText('Describe your experiment in your own words'), {
      target: { value: 'Ten different students in each group completed the reaction-time test.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check my description' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      screen.getByText(/No possible design mismatches found in your description\./),
    ).toBeInTheDocument()
  })

  it('"My selection is correct" dismisses the alert AND records a method-description-override audit entry, without changing the design', () => {
    const onEnterData = vi.fn()
    render(
      <WizardProvider>
        <ExperimentDesignWizard onExit={() => {}} onEnterData={onEnterData} />
      </WizardProvider>,
    )
    driveToSummary()

    fireEvent.change(screen.getByLabelText('Describe your experiment in your own words'), {
      target: { value: MISMATCH_TEXT },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check my description' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'My selection is correct' }))

    // The alert is dismissed from view...
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    // ...but the design's own answers are untouched - still independent.
    expect(screen.getByText(/Independent - different subjects/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Enter your data' }))

    expect(onEnterData).toHaveBeenCalledTimes(1)
    const [design, methodDescriptionAuditHistory] = onEnterData.mock.calls[0]

    // The design passed on is otherwise exactly what was entered - only
    // `methodDescription` differs from a design built without ever touching
    // this feature.
    expect(design.relationship).toBe('independent')
    expect(design.groups.names).toEqual(['No coffee', 'Coffee'])
    expect(design.methodDescription).toBe(MISMATCH_TEXT)

    expect(methodDescriptionAuditHistory).toHaveLength(1)
    expect(methodDescriptionAuditHistory[0]).toMatchObject({
      action: 'method-description-override',
    })
    expect(methodDescriptionAuditHistory[0].id).toBeTruthy()
    expect(methodDescriptionAuditHistory[0].timestamp).toBeTruthy()
    expect(methodDescriptionAuditHistory[0].description).toContain('same participants')
    expect(methodDescriptionAuditHistory[0].before).toMatchObject({ designField: 'relationship' })
  })

  it('"Review design" navigates back to the relationship step without losing other answers', () => {
    render(
      <WizardProvider>
        <ExperimentDesignWizard onExit={() => {}} onEnterData={() => {}} />
      </WizardProvider>,
    )
    driveToSummary()

    fireEvent.change(screen.getByLabelText('Describe your experiment in your own words'), {
      target: { value: MISMATCH_TEXT },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check my description' }))
    fireEvent.click(screen.getByRole('button', { name: 'Review design' }))

    // Landed back on the relationship step, with the prior answer preserved.
    expect(screen.getByText('Where did the measurements come from?')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Different subjects or samples were used in each condition.'),
    ).toBeChecked()

    // Other, unrelated answers from earlier steps were not lost either.
    fireEvent.click(screen.getByRole('button', { name: 'Back' })) // -> groups step
    expect(screen.getByLabelText('Group 1 name')).toHaveValue('No coffee')
    expect(screen.getByLabelText('Group 2 name')).toHaveValue('Coffee')
  })

  it('navigates to the experimental-unit step for a technical-replication mismatch', () => {
    render(
      <WizardProvider>
        <ExperimentDesignWizard onExit={() => {}} onEnterData={() => {}} />
      </WizardProvider>,
    )
    driveToSummary()

    fireEvent.change(screen.getByLabelText('Describe your experiment in your own words'), {
      target: { value: 'Each sample was run in triplicate.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check my description' }))
    fireEvent.click(screen.getByRole('button', { name: 'Review design' }))

    expect(
      screen.getByText('What was independently assigned to a treatment or condition?'),
    ).toBeInTheDocument()
    // The earlier "No" answer to technical replication is preserved, not reset.
    expect(screen.getByLabelText('No')).toBeChecked()
  })
})
