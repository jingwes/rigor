import { useReducer } from 'react'
import type { ReactNode } from 'react'
import { WizardContext } from './wizardContext'
import { createInitialWizardState, wizardReducer } from './wizardReducer'

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, undefined, createInitialWizardState)

  return <WizardContext.Provider value={{ state, dispatch }}>{children}</WizardContext.Provider>
}
