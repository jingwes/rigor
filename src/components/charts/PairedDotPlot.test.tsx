import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { PairedDotPlot } from './PairedDotPlot'

const pairs = [
  { id: 'p1', before: 10, after: 14 },
  { id: 'p2', before: 12, after: 15 },
  { id: 'p3', before: 9, after: 13 },
  { id: 'p4', before: 11, after: 16 },
]

describe('PairedDotPlot', () => {
  it('renders 2 points per pair (before + after) and one connecting line per pair', () => {
    const { container } = render(
      <PairedDotPlot pairs={pairs} beforeLabel="Before" afterLabel="After" />,
    )
    expect(container.querySelectorAll('.chart-point')).toHaveLength(8)
    expect(
      container.querySelectorAll('[data-testid="pair-connector"]'),
    ).toHaveLength(4)
  })

  it('includes a screen-reader-accessible text summary generated from the data', () => {
    const { container } = render(
      <PairedDotPlot pairs={pairs} beforeLabel="Before" afterLabel="After" />,
    )
    expect(container.querySelector('p.visually-hidden')?.textContent).toMatch(
      /Paired dot plot of Before and After for 4 matched pairs/,
    )
  })

  it('always renders raw points and connecting lines regardless of whether an interval overlay is requested', () => {
    const { container: withoutInterval } = render(
      <PairedDotPlot pairs={pairs} beforeLabel="Before" afterLabel="After" />,
    )
    const { container: withInterval } = render(
      <PairedDotPlot
        pairs={pairs}
        beforeLabel="Before"
        afterLabel="After"
        intervalType="ci95"
      />,
    )
    expect(withoutInterval.querySelectorAll('.chart-point')).toHaveLength(8)
    expect(withInterval.querySelectorAll('.chart-point')).toHaveLength(8)
    expect(withoutInterval.querySelectorAll('.chart-error-bar')).toHaveLength(0)
    expect(withInterval.querySelectorAll('.chart-error-bar')).toHaveLength(2)
  })

  it('keeps point positions fixed while switching interval type only changes the error bars', () => {
    const { container, rerender } = render(
      <PairedDotPlot
        pairs={pairs}
        beforeLabel="Before"
        afterLabel="After"
        intervalType="sd"
      />,
    )
    const positionsBefore = Array.from(
      container.querySelectorAll('.chart-point'),
    ).map((el) => el.outerHTML)

    rerender(
      <PairedDotPlot
        pairs={pairs}
        beforeLabel="Before"
        afterLabel="After"
        intervalType="ci95"
      />,
    )
    const positionsAfter = Array.from(
      container.querySelectorAll('.chart-point'),
    ).map((el) => el.outerHTML)

    expect(positionsAfter).toEqual(positionsBefore)
  })

  it('distinguishes the before/after columns by shape as well as color', () => {
    const { container } = render(
      <PairedDotPlot pairs={pairs} beforeLabel="Before" afterLabel="After" />,
    )
    expect(container.querySelectorAll('circle.chart-point')).toHaveLength(4)
    expect(container.querySelectorAll('rect.chart-point')).toHaveLength(4)
  })
})
