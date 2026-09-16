import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IntervalTypeSelector } from './IntervalTypeSelector'

describe('IntervalTypeSelector', () => {
  it('shows the plain-language question and both primary options', () => {
    render(<IntervalTypeSelector value="sd" onChange={vi.fn()} />)
    expect(
      screen.getByText('What do you want the interval to show?'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Variation among observations')).toBeChecked()
    expect(
      screen.getByLabelText('Uncertainty in the estimated mean'),
    ).not.toBeChecked()
  })

  it('offers SEM under an Advanced disclosure with a plain-English caveat', () => {
    render(<IntervalTypeSelector value="sd" onChange={vi.fn()} />)
    expect(screen.getByText('Advanced')).toBeInTheDocument()
    expect(
      screen.getByText(/SEM describes uncertainty in the estimated mean/),
    ).toBeInTheDocument()
  })

  it('calls onChange with the selected interval type', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<IntervalTypeSelector value="sd" onChange={onChange} />)

    await user.click(screen.getByLabelText('Uncertainty in the estimated mean'))
    expect(onChange).toHaveBeenCalledWith('ci95')

    await user.click(screen.getByLabelText('Standard error of the mean (SEM)'))
    expect(onChange).toHaveBeenCalledWith('sem')
  })

  it('is keyboard-navigable radio input group', () => {
    render(<IntervalTypeSelector value="ci95" onChange={vi.fn()} />)
    const radios = screen.getAllByRole('radio')
    expect(radios.length).toBe(3)
    for (const radio of radios) {
      expect(radio).not.toHaveAttribute('tabindex', '-1')
    }
  })
})
