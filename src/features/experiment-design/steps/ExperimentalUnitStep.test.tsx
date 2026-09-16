import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ExperimentalUnitStep } from './ExperimentalUnitStep'
import { createInitialDraft } from '../wizardTypes'

describe('ExperimentalUnitStep', () => {
  it('reveals a free-text field only when "Other" is chosen', () => {
    const draft = createInitialDraft()
    const { rerender } = render(<ExperimentalUnitStep draft={draft} onUpdate={vi.fn()} />)
    expect(screen.queryByLabelText('Please describe it')).not.toBeInTheDocument()

    rerender(
      <ExperimentalUnitStep
        draft={{ ...draft, experimentalUnitLabel: 'Other' }}
        onUpdate={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Please describe it')).toBeInTheDocument()
  })

  it('treats "not sure" as a distinct, explicit answer (null), not a guessed no', () => {
    const onUpdate = vi.fn()
    render(<ExperimentalUnitStep draft={createInitialDraft()} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByLabelText('Not sure'))

    expect(onUpdate).toHaveBeenCalledWith({
      technicalReplicationPresent: null,
      technicalReplicationMeasurementsPerUnit: '',
    })
  })

  it('only asks for a measurements-per-unit count after answering yes', () => {
    const draft = createInitialDraft()
    const { rerender } = render(<ExperimentalUnitStep draft={draft} onUpdate={vi.fn()} />)
    expect(screen.queryByLabelText(/measurements per unit/i)).not.toBeInTheDocument()

    rerender(
      <ExperimentalUnitStep
        draft={{ ...draft, technicalReplicationPresent: true }}
        onUpdate={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/measurements per unit/i)).toBeInTheDocument()
  })
})
