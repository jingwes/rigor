import type { WizardDraft, WizardStepId } from './wizardTypes'
import { createInitialDraft } from './wizardTypes'
import { getNextStepId, getPreviousStepId, resizeGroupNames } from './wizardLogic'

export interface WizardState {
  step: WizardStepId
  draft: WizardDraft
}

export function createInitialWizardState(): WizardState {
  return { step: 'researchQuestion', draft: createInitialDraft() }
}

export type WizardAction =
  | { type: 'UPDATE_DRAFT'; patch: Partial<WizardDraft> }
  | { type: 'SET_GROUP_COUNT'; choice: WizardDraft['groupCountChoice']; count: number | undefined }
  | { type: 'GO_NEXT' }
  | { type: 'GO_BACK' }
  | { type: 'GO_TO_STEP'; step: WizardStepId }
  | { type: 'RESTART' }

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'UPDATE_DRAFT':
      return { ...state, draft: { ...state.draft, ...action.patch } }

    case 'SET_GROUP_COUNT': {
      const count = action.count
      return {
        ...state,
        draft: {
          ...state.draft,
          groupCountChoice: action.choice,
          groupsCount: count,
          groupNames: resizeGroupNames(state.draft.groupNames, count ?? 0),
          // Changing the group count can make the relationship question
          // inapplicable (1 group) or change its meaning (2 vs 3+) - clear
          // any previous answer rather than carrying a stale one forward.
          relationship: undefined,
        },
      }
    }

    case 'GO_NEXT': {
      const next = getNextStepId(state.step, state.draft)
      return next ? { ...state, step: next } : state
    }

    case 'GO_BACK': {
      const previous = getPreviousStepId(state.step, state.draft)
      return previous ? { ...state, step: previous } : state
    }

    case 'GO_TO_STEP':
      return { ...state, step: action.step }

    case 'RESTART':
      return createInitialWizardState()

    default:
      return state
  }
}
