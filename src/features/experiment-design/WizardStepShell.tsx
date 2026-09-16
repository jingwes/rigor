import type { ReactNode } from 'react'

interface WizardStepShellProps {
  title: string
  stepNumber: number
  totalSteps: number
  children: ReactNode
  onBack?: () => void
  onNext: () => void
  canProceed: boolean
  nextLabel?: string
}

export function WizardStepShell({
  title,
  stepNumber,
  totalSteps,
  children,
  onBack,
  onNext,
  canProceed,
  nextLabel = 'Continue',
}: WizardStepShellProps) {
  return (
    <section aria-labelledby="wizard-step-title">
      <p className="wizard-progress">
        Step {stepNumber} of {totalSteps}
      </p>
      <h2 id="wizard-step-title">{title}</h2>
      <div className="wizard-step-body">{children}</div>
      <div className="wizard-nav">
        {onBack && (
          <button type="button" onClick={onBack} className="wizard-back">
            Back
          </button>
        )}
        <button type="button" onClick={onNext} disabled={!canProceed} className="wizard-next">
          {nextLabel}
        </button>
      </div>
    </section>
  )
}
