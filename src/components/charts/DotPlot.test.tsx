import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DotPlot } from './DotPlot'

const twoGroups = [
  { label: 'Control', values: [1, 2, 3, 4] },
  { label: 'Treatment', values: [5, 6, 7] },
]

const threeGroups = [
  { label: 'Control', values: [1, 2, 3] },
  { label: 'Low dose', values: [4, 5, 6] },
  { label: 'High dose', values: [7, 8, 9, 10] },
]

describe('DotPlot', () => {
  it('renders one point per raw observation across 2 groups', () => {
    const { container } = render(
      <DotPlot groups={twoGroups} intervalType="sd" />,
    )
    expect(container.querySelectorAll('.chart-point')).toHaveLength(7)
  })

  it('renders one point per raw observation across 3+ groups', () => {
    const { container } = render(
      <DotPlot groups={threeGroups} intervalType="sd" />,
    )
    expect(container.querySelectorAll('.chart-point')).toHaveLength(10)
  })

  it('includes a screen-reader-accessible text summary generated from the data', () => {
    const { container } = render(
      <DotPlot groups={twoGroups} intervalType="sd" />,
    )
    const summaryEl = container.querySelector('p.visually-hidden')
    expect(summaryEl?.textContent).toMatch(
      /Dot plot comparing Control \(n=4, mean=2\.50\) and Treatment \(n=3, mean=6\.00\)/,
    )
  })

  it('mentions the selected interval type in the accessible summary', () => {
    const { container, rerender } = render(
      <DotPlot groups={twoGroups} intervalType="sd" />,
    )
    expect(container.querySelector('p.visually-hidden')?.textContent).toMatch(
      /standard deviation/,
    )

    rerender(<DotPlot groups={twoGroups} intervalType="ci95" />)
    expect(container.querySelector('p.visually-hidden')?.textContent).toMatch(
      /95% confidence interval/,
    )
  })

  it('always renders raw points regardless of interval type, and keeps point positions fixed while the error bar changes', () => {
    const { container, rerender } = render(
      <DotPlot groups={twoGroups} intervalType="sd" />,
    )
    const pointsBefore = Array.from(
      container.querySelectorAll('[data-testid="group-Control"] circle'),
    ).map((el) => el.getAttribute('cx') + ',' + el.getAttribute('cy'))
    const errorBarBefore = container.querySelector(
      '[data-testid="group-Control"] .chart-error-bar',
    )?.outerHTML

    rerender(<DotPlot groups={twoGroups} intervalType="ci95" />)

    const pointsAfter = Array.from(
      container.querySelectorAll('[data-testid="group-Control"] circle'),
    ).map((el) => el.getAttribute('cx') + ',' + el.getAttribute('cy'))
    const errorBarAfter = container.querySelector(
      '[data-testid="group-Control"] .chart-error-bar',
    )?.outerHTML

    expect(pointsAfter).toEqual(pointsBefore)
    expect(errorBarAfter).not.toBe(errorBarBefore)
    expect(container.querySelectorAll('.chart-point')).toHaveLength(7)
  })

  it('always renders raw points even when customization changes (point size, legend off)', () => {
    const { container } = render(
      <DotPlot
        groups={twoGroups}
        intervalType="ci95"
        customization={{ pointRadiusPx: 10, showLegend: false }}
      />,
    )
    expect(container.querySelectorAll('.chart-point')).toHaveLength(7)
  })

  it('does not render an error bar for a group with fewer than 2 observations', () => {
    const { container } = render(
      <DotPlot
        groups={[{ label: 'Single', values: [42] }]}
        intervalType="sd"
      />,
    )
    expect(container.querySelectorAll('.chart-point')).toHaveLength(1)
    expect(
      container.querySelector('[data-testid="group-Single"] .chart-error-bar'),
    ).toBeNull()
  })

  it('falls back to a linear axis and shows a warning when log scale is requested with non-positive data', () => {
    render(
      <DotPlot
        groups={[{ label: 'A', values: [-1, 0, 1] }]}
        intervalType="sd"
        customization={{ yScaleType: 'log' }}
      />,
    )
    expect(
      screen.getByText(/logarithmic axis is undefined for zero or negative/i),
    ).toBeInTheDocument()
  })

  it('warns when a non-zero Y-axis baseline is set for a zero-meaningful quantity', () => {
    render(
      <DotPlot
        groups={twoGroups}
        intervalType="sd"
        customization={{ yAxisMin: 3 }}
      />,
    )
    expect(screen.getByText(/does not start at zero/)).toBeInTheDocument()
  })

  it('does not warn about the baseline when zero is not meaningful for the quantity', () => {
    render(
      <DotPlot
        groups={twoGroups}
        intervalType="sd"
        customization={{ yAxisMin: 3 }}
        zeroIsMeaningful={false}
      />,
    )
    expect(screen.queryByText(/does not start at zero/)).not.toBeInTheDocument()
  })

  it('distinguishes groups by shape as well as color (never color alone)', () => {
    const { container } = render(
      <DotPlot groups={twoGroups} intervalType="sd" />,
    )
    const controlPoints = container.querySelectorAll(
      '[data-testid="group-Control"] circle.chart-point',
    )
    const treatmentPoints = container.querySelectorAll(
      '[data-testid="group-Treatment"] rect.chart-point',
    )
    expect(controlPoints).toHaveLength(4)
    expect(treatmentPoints).toHaveLength(3)
  })

  it('shows every group label as visible text (not color-only identification)', () => {
    render(<DotPlot groups={twoGroups} intervalType="sd" />)
    expect(screen.getAllByText('Control').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Treatment').length).toBeGreaterThan(0)
  })
})
