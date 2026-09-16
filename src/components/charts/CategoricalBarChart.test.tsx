import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { CategoricalBarChart } from './CategoricalBarChart'

const groupLabels = ['Control', 'Treatment']
const categoryLabels = ['Improved', 'Not improved']
const counts = [
  [20, 10],
  [10, 20],
]

describe('CategoricalBarChart', () => {
  it('renders one bar per group x category combination', () => {
    const { container } = render(
      <CategoricalBarChart
        groupLabels={groupLabels}
        categoryLabels={categoryLabels}
        counts={counts}
      />,
    )
    expect(container.querySelectorAll('[data-testid^="bar-Control-"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-testid^="bar-Treatment-"]')).toHaveLength(2)
  })

  it('always shows the raw count as a text label, in both counts and proportions mode', () => {
    const { container: countsContainer } = render(
      <CategoricalBarChart
        groupLabels={groupLabels}
        categoryLabels={categoryLabels}
        counts={counts}
        mode="counts"
      />,
    )
    expect(countsContainer.textContent).toContain('20')
    expect(countsContainer.textContent).toContain('10')

    const { container: proportionsContainer } = render(
      <CategoricalBarChart
        groupLabels={groupLabels}
        categoryLabels={categoryLabels}
        counts={counts}
        mode="proportions"
      />,
    )
    expect(proportionsContainer.textContent).toContain('20')
    expect(proportionsContainer.textContent).toContain('10')
  })

  it('distinguishes categories by a fill pattern (not color alone) via distinct <pattern> defs', () => {
    const { container } = render(
      <CategoricalBarChart
        groupLabels={groupLabels}
        categoryLabels={categoryLabels}
        counts={counts}
      />,
    )
    const patterns = container.querySelectorAll('defs pattern')
    expect(patterns).toHaveLength(2)
    const ids = [...patterns].map((p) => p.getAttribute('id'))
    expect(new Set(ids).size).toBe(2)
  })

  it('includes a screen-reader-accessible text summary generated from the same data', () => {
    const { container } = render(
      <CategoricalBarChart
        groupLabels={groupLabels}
        categoryLabels={categoryLabels}
        counts={counts}
        outcomeName="recovery status"
      />,
    )
    const summaryEl = container.querySelector('p.visually-hidden')
    expect(summaryEl?.textContent).toMatch(/recovery status/)
    expect(summaryEl?.textContent).toMatch(/Control \(n=30\)/)
    expect(summaryEl?.textContent).toMatch(/Improved 20 \(66\.7%\)/)
  })

  it('always shows group and category text labels (never color/pattern alone)', () => {
    const { container } = render(
      <CategoricalBarChart
        groupLabels={groupLabels}
        categoryLabels={categoryLabels}
        counts={counts}
      />,
    )
    expect(container.textContent).toContain('Control')
    expect(container.textContent).toContain('Treatment')
    expect(container.textContent).toContain('Improved')
    expect(container.textContent).toContain('Not improved')
  })
})
