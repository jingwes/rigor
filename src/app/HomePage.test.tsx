import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  it('has one dominant, functional action', () => {
    const onStartAnalysis = vi.fn()
    render(<HomePage onStartAnalysis={onStartAnalysis} />)

    fireEvent.click(screen.getByRole('button', { name: 'Start an analysis' }))
    expect(onStartAnalysis).toHaveBeenCalledTimes(1)
  })

  it('shows secondary actions as visibly disabled, not fake-functional', () => {
    render(<HomePage onStartAnalysis={vi.fn()} />)

    for (const label of ['Open saved project', 'Try example', 'Learn how this works']) {
      const button = screen.getByRole('button', { name: label })
      expect(button).toBeDisabled()
    }
    expect(screen.getAllByText('Coming soon')).toHaveLength(3)
  })

  it('never displays a statistical-test name', () => {
    render(<HomePage onStartAnalysis={vi.fn()} />)
    const bodyText = (document.body.textContent ?? '').toLowerCase()
    expect(bodyText).not.toContain('t-test')
    expect(bodyText).not.toContain('anova')
  })
})
