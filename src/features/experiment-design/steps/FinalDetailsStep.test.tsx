import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FinalDetailsStep } from './FinalDetailsStep'
import { createInitialDraft } from '../wizardTypes'

describe('FinalDetailsStep', () => {
  it('captures exclusionsPredefined as a plain yes/no question', () => {
    const onUpdate = vi.fn()
    render(<FinalDetailsStep draft={createInitialDraft()} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByLabelText('Yes'))
    expect(onUpdate).toHaveBeenCalledWith({ exclusionsPredefined: true })

    fireEvent.click(screen.getByLabelText('No'))
    expect(onUpdate).toHaveBeenCalledWith({ exclusionsPredefined: false })
  })

  it('captures free-text notes', () => {
    const onUpdate = vi.fn()
    render(<FinalDetailsStep draft={createInitialDraft()} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByLabelText(/Anything else we should know/), {
      target: { value: 'Ran during exam week, some distraction risk.' },
    })

    expect(onUpdate).toHaveBeenCalledWith({ notes: 'Ran during exam week, some distraction risk.' })
  })
})
