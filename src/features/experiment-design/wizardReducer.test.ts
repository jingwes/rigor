import { describe, expect, it } from 'vitest'
import { createAuditEntry } from '../../models/AuditEntry'
import { createInitialWizardState, wizardReducer } from './wizardReducer'

describe('wizardReducer - APPEND_AUDIT_ENTRY (Milestone 14)', () => {
  it('starts with an empty methodDescriptionAuditHistory', () => {
    expect(createInitialWizardState().methodDescriptionAuditHistory).toEqual([])
  })

  it('appends an entry without mutating the previous state/history', () => {
    const state = createInitialWizardState()
    const entry = createAuditEntry({
      action: 'method-description-override',
      description: 'Reviewed and kept the original answer.',
    })

    const next = wizardReducer(state, { type: 'APPEND_AUDIT_ENTRY', entry })

    expect(state.methodDescriptionAuditHistory).toEqual([]) // original untouched
    expect(next.methodDescriptionAuditHistory).toEqual([entry])
    expect(next.draft).toBe(state.draft) // unrelated state left alone
    expect(next.step).toBe(state.step)
  })

  it('preserves order across repeated appends', () => {
    let state = createInitialWizardState()
    const first = createAuditEntry({ action: 'method-description-override', description: 'first' })
    const second = createAuditEntry({ action: 'method-description-override', description: 'second' })

    state = wizardReducer(state, { type: 'APPEND_AUDIT_ENTRY', entry: first })
    state = wizardReducer(state, { type: 'APPEND_AUDIT_ENTRY', entry: second })

    expect(state.methodDescriptionAuditHistory).toEqual([first, second])
  })

  it('RESTART clears the wizard-time audit history along with the draft', () => {
    const entry = createAuditEntry({ action: 'method-description-override', description: 'x' })
    let state = createInitialWizardState()
    state = wizardReducer(state, { type: 'APPEND_AUDIT_ENTRY', entry })
    expect(state.methodDescriptionAuditHistory).toHaveLength(1)

    state = wizardReducer(state, { type: 'RESTART' })
    expect(state.methodDescriptionAuditHistory).toEqual([])
  })
})
