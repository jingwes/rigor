import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ResearchQuestionStep } from './ResearchQuestionStep'
import { createInitialDraft } from '../wizardTypes'

describe('ResearchQuestionStep', () => {
  it('renders the plain-language questions with no statistical jargon', () => {
    render(<ResearchQuestionStep draft={createInitialDraft()} onUpdate={vi.fn()} />)

    expect(screen.getByLabelText('What are you trying to find out?')).toBeInTheDocument()
    expect(screen.getByLabelText('What did you measure?')).toBeInTheDocument()
    expect(screen.getByText('A numerical measurement')).toBeInTheDocument()

    const bodyText = document.body.textContent ?? ''
    for (const jargon of ['t-test', 'anova', 'paired t', 'pseudoreplication']) {
      expect(bodyText.toLowerCase()).not.toContain(jargon)
    }
  })

  it('reports free-text input back through onUpdate', () => {
    const onUpdate = vi.fn()
    render(<ResearchQuestionStep draft={createInitialDraft()} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByLabelText('What did you measure?'), {
      target: { value: 'height' },
    })

    expect(onUpdate).toHaveBeenCalledWith({ outcomeName: 'height' })
  })

  it('records "I\'m not sure" as the explicit unknown type, not a guess', () => {
    const onUpdate = vi.fn()
    render(<ResearchQuestionStep draft={createInitialDraft()} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByLabelText("I'm not sure"))

    expect(onUpdate).toHaveBeenCalledWith({ outcomeType: 'unknown' })
  })

  it('reflects the current draft value as the checked radio', () => {
    const draft = { ...createInitialDraft(), outcomeType: 'count' as const }
    render(<ResearchQuestionStep draft={draft} onUpdate={vi.fn()} />)

    expect(screen.getByLabelText('A count', { exact: false })).toBeChecked()
  })
})
