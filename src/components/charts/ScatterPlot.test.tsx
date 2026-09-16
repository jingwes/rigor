import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ScatterPlot } from './ScatterPlot'

const points = [
  { x: 1, y: 2 },
  { x: 2, y: 4 },
  { x: 3, y: 5 },
  { x: 4, y: 9 },
]

describe('ScatterPlot', () => {
  it('renders exactly one point per observation', () => {
    const { container } = render(<ScatterPlot points={points} xLabel="X" yLabel="Y" />)
    expect(container.querySelectorAll('circle.chart-point')).toHaveLength(points.length)
  })

  it('includes a screen-reader-accessible text summary generated from the same data', () => {
    const { container } = render(
      <ScatterPlot points={points} xLabel="Height (cm)" yLabel="Weight (kg)" />,
    )
    const summaryEl = container.querySelector('p.visually-hidden')
    expect(summaryEl?.textContent).toMatch(/Height \(cm\)/)
    expect(summaryEl?.textContent).toMatch(/Weight \(kg\)/)
    expect(summaryEl?.textContent).toMatch(new RegExp(`${points.length} observations`))
  })

  it('does not draw a regression line when none is provided', () => {
    const { container } = render(<ScatterPlot points={points} xLabel="X" yLabel="Y" />)
    expect(container.querySelector('[data-testid="scatter-regression-line"]')).toBeNull()
  })

  it('overlays a regression line without changing the raw points\' positions', () => {
    const { container: withoutLine } = render(
      <ScatterPlot points={points} xLabel="X" yLabel="Y" />,
    )
    const withoutLinePositions = [...withoutLine.querySelectorAll('circle.chart-point')].map(
      (el) => `${el.getAttribute('cx')},${el.getAttribute('cy')}`,
    )

    const { container: withLine } = render(
      <ScatterPlot
        points={points}
        xLabel="X"
        yLabel="Y"
        regressionLine={{ slope: 2, intercept: 0 }}
      />,
    )
    const withLinePositions = [...withLine.querySelectorAll('circle.chart-point')].map(
      (el) => `${el.getAttribute('cx')},${el.getAttribute('cy')}`,
    )

    expect(withLinePositions).toEqual(withoutLinePositions)
    expect(withLine.querySelector('[data-testid="scatter-regression-line"]')).not.toBeNull()
  })

  it('mentions the regression line in the accessible summary when one is shown', () => {
    const { container } = render(
      <ScatterPlot
        points={points}
        xLabel="X"
        yLabel="Y"
        regressionLine={{ slope: 2, intercept: 1 }}
      />,
    )
    const summaryEl = container.querySelector('p.visually-hidden')
    expect(summaryEl?.textContent).toMatch(/fitted regression line/i)
  })
})
