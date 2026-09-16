import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChartCustomizationPanel } from './ChartCustomizationPanel'
import { DEFAULT_CHART_CUSTOMIZATION } from './types'

describe('ChartCustomizationPanel', () => {
  it('renders labeled, keyboard-accessible controls for every documented option', () => {
    render(
      <ChartCustomizationPanel
        value={DEFAULT_CHART_CUSTOMIZATION}
        onChange={vi.fn()}
        groupKeys={['Control', 'Treatment']}
        values={[1, 2, 3, 4]}
      />,
    )

    expect(screen.getByLabelText('Figure title')).toBeInTheDocument()
    expect(screen.getByLabelText('X-axis title')).toBeInTheDocument()
    expect(screen.getByLabelText('Y-axis title')).toBeInTheDocument()
    expect(screen.getByLabelText('Y-axis unit')).toBeInTheDocument()
    expect(screen.getByLabelText('Label for Control')).toBeInTheDocument()
    expect(screen.getByLabelText('Label for Treatment')).toBeInTheDocument()
    expect(screen.getByLabelText('Point size (px)')).toBeInTheDocument()
    expect(screen.getByLabelText('Line width (px)')).toBeInTheDocument()
    expect(screen.getByLabelText('Font size (px)')).toBeInTheDocument()
    expect(screen.getByLabelText(/Show legend/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Logarithmic Y-axis/)).toBeInTheDocument()
    expect(screen.getByLabelText('Width (px)')).toBeInTheDocument()
    expect(screen.getByLabelText('Height (px)')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Y-axis baseline (blank = automatic)'),
    ).toBeInTheDocument()
  })

  it('calls onChange with an updated figure title, without mutating the original value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <ChartCustomizationPanel
        value={DEFAULT_CHART_CUSTOMIZATION}
        onChange={onChange}
        groupKeys={[]}
        values={[1, 2, 3]}
      />,
    )

    await user.type(screen.getByLabelText('Figure title'), 'X')
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ figureTitle: 'X' }),
    )
    expect(DEFAULT_CHART_CUSTOMIZATION.figureTitle).toBeUndefined()
  })

  it('disables the log-scale control and explains why when data contains non-positive values', () => {
    render(
      <ChartCustomizationPanel
        value={DEFAULT_CHART_CUSTOMIZATION}
        onChange={vi.fn()}
        groupKeys={[]}
        values={[-1, 0, 5]}
      />,
    )
    const checkbox = screen.getByLabelText(/Logarithmic Y-axis/)
    expect(checkbox).toBeDisabled()
    expect(
      screen.getByText(/undefined for zero or negative values/),
    ).toBeInTheDocument()
  })

  it('enables the log-scale control when all values are positive', () => {
    render(
      <ChartCustomizationPanel
        value={DEFAULT_CHART_CUSTOMIZATION}
        onChange={vi.fn()}
        groupKeys={[]}
        values={[1, 2, 5]}
      />,
    )
    expect(screen.getByLabelText(/Logarithmic Y-axis/)).not.toBeDisabled()
  })

  it('updates a per-group label override without touching other groups', () => {
    const onChange = vi.fn()
    render(
      <ChartCustomizationPanel
        value={DEFAULT_CHART_CUSTOMIZATION}
        onChange={onChange}
        groupKeys={['Control', 'Treatment']}
        values={[1, 2, 3]}
      />,
    )

    const controlLabelInput = screen.getByLabelText('Label for Control')
    fireEvent.change(controlLabelInput, { target: { value: 'Placebo' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        groupLabelOverrides: expect.objectContaining({ Control: 'Placebo' }),
      }),
    )
  })
})
