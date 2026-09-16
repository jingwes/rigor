import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import App from '../../../App'
import { WizardProvider } from '../WizardProvider'
import { ExperimentDesignWizard } from '../ExperimentDesignWizard'

describe('experiment design wizard - full run through', () => {
  it('produces a well-formed ExperimentDesign matching everything entered, starting from the homepage', () => {
    render(<App />)

    // Homepage -> wizard
    fireEvent.click(screen.getByRole('button', { name: 'Start an analysis' }))

    // Step 1: research question & outcome
    fireEvent.change(screen.getByLabelText('What are you trying to find out?'), {
      target: { value: 'Does fertilizer X increase plant height?' },
    })
    fireEvent.change(screen.getByLabelText('What did you measure?'), {
      target: { value: 'plant height' },
    })
    fireEvent.click(screen.getByLabelText('A numerical measurement'))
    fireEvent.change(screen.getByLabelText('Unit (optional)'), { target: { value: 'cm' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // Step 2: groups
    fireEvent.click(screen.getByLabelText('Two groups'))
    fireEvent.change(screen.getByLabelText('Group 1 name'), { target: { value: 'Control' } })
    fireEvent.change(screen.getByLabelText('Group 2 name'), { target: { value: 'Fertilizer X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // Step 3: relationship (only shown for 2+ groups)
    fireEvent.click(
      screen.getByLabelText('Different subjects or samples were used in each condition.'),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // Step 4: experimental unit & technical replication
    fireEvent.click(screen.getByLabelText('Plant'))
    fireEvent.click(screen.getByLabelText('Yes'))
    fireEvent.change(screen.getByLabelText(/measurements per unit/i), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // Step 5: final details
    fireEvent.click(screen.getByLabelText('Yes'))
    fireEvent.change(screen.getByLabelText(/Anything else we should know/), {
      target: { value: 'Grown under identical light.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // Step 6: summary reflects everything entered
    expect(screen.getByText('Your experimental design, so far')).toBeInTheDocument()
    expect(screen.getByText(/Does fertilizer X increase plant height\?/)).toBeInTheDocument()
    const measuredRow = screen.getByText('What was measured').closest('.summary-row')
    expect(measuredRow).toHaveTextContent('plant height')
    expect(screen.getByText(/Control, Fertilizer X/)).toBeInTheDocument()
    expect(
      screen.getByText(/Independent - different subjects or samples were used/),
    ).toBeInTheDocument()
    expect(screen.getByText(/about 1 measurement/)).toBeInTheDocument()
    expect(screen.getByText('Grown under identical light.')).toBeInTheDocument()

    const bodyText = (document.body.textContent ?? '').toLowerCase()
    expect(bodyText).not.toContain('t-test')
    expect(bodyText).not.toContain('anova')
  })

  it('preserves answers when navigating back and forward', () => {
    render(
      <WizardProvider>
        <ExperimentDesignWizard onExit={() => {}} onEnterData={() => {}} />
      </WizardProvider>,
    )

    fireEvent.change(screen.getByLabelText('What did you measure?'), {
      target: { value: 'reaction time' },
    })
    fireEvent.click(screen.getByLabelText('A numerical measurement'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    fireEvent.click(screen.getByLabelText('Two groups'))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByLabelText('What did you measure?')).toHaveValue('reaction time')
    expect(screen.getByLabelText('A numerical measurement')).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByLabelText('Two groups')).toBeChecked()
  })

  it('skips the relationship question for a single group and never guesses an answer for it', () => {
    render(
      <WizardProvider>
        <ExperimentDesignWizard onExit={() => {}} onEnterData={() => {}} />
      </WizardProvider>,
    )

    fireEvent.change(screen.getByLabelText('What did you measure?'), { target: { value: 'yield' } })
    fireEvent.click(screen.getByLabelText('A numerical measurement'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    fireEvent.click(screen.getByLabelText('One group'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // Should have jumped straight to the experimental unit step, not the
    // relationship step.
    expect(
      screen.getByText('What was independently assigned to a treatment or condition?'),
    ).toBeInTheDocument()
  })
})
