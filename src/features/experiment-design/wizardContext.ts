import { createContext } from 'react'
import type { Dispatch } from 'react'
import type { WizardAction, WizardState } from './wizardReducer'

export interface WizardContextValue {
  state: WizardState
  dispatch: Dispatch<WizardAction>
}

export const WizardContext = createContext<WizardContextValue | undefined>(undefined)
