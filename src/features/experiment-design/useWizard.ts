import { useContext } from 'react'
import { WizardContext } from './wizardContext'
import type { WizardContextValue } from './wizardContext'

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext)
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider')
  }
  return context
}
