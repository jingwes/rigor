import type { ExperimentDesign } from '../../models/ExperimentDesign'
import { useWizard } from './useWizard'
import { WizardStepShell } from './WizardStepShell'
import { canProceedFromStep, getStepNumber, getTotalSteps } from './wizardLogic'
import type { WizardStepId } from './wizardTypes'
import { ResearchQuestionStep } from './steps/ResearchQuestionStep'
import { GroupsStep } from './steps/GroupsStep'
import { RelationshipStep } from './steps/RelationshipStep'
import { ExperimentalUnitStep } from './steps/ExperimentalUnitStep'
import { FinalDetailsStep } from './steps/FinalDetailsStep'
import { SummaryStep } from './steps/SummaryStep'

const STEP_TITLES: Record<WizardStepId, string> = {
  researchQuestion: 'Your question and what you measured',
  groups: 'Groups or conditions',
  relationship: 'Where the measurements came from',
  experimentalUnit: 'Experimental unit and replication',
  finalDetails: 'A couple of final questions',
  summary: 'Design summary',
}

export interface ExperimentDesignWizardProps {
  onExit: () => void
  onEnterData: (design: ExperimentDesign) => void
}

export function ExperimentDesignWizard({
  onExit,
  onEnterData,
}: ExperimentDesignWizardProps) {
  const { state, dispatch } = useWizard()
  const { step, draft } = state

  const onUpdate = (patch: Partial<typeof draft>) =>
    dispatch({ type: 'UPDATE_DRAFT', patch })

  if (step === 'summary') {
    return (
      <SummaryStep
        draft={draft}
        onEditStep={(target) => dispatch({ type: 'GO_TO_STEP', step: target })}
        onRestart={() => dispatch({ type: 'RESTART' })}
        onExit={onExit}
        onEnterData={onEnterData}
      />
    )
  }

  const stepNumber = getStepNumber(step, draft)
  const totalSteps = getTotalSteps(draft)
  const canProceed = canProceedFromStep(step, draft)

  return (
    <WizardStepShell
      title={STEP_TITLES[step]}
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      onBack={stepNumber > 1 ? () => dispatch({ type: 'GO_BACK' }) : undefined}
      onNext={() => dispatch({ type: 'GO_NEXT' })}
      canProceed={canProceed}
    >
      {step === 'researchQuestion' && (
        <ResearchQuestionStep draft={draft} onUpdate={onUpdate} />
      )}
      {step === 'groups' && (
        <GroupsStep
          draft={draft}
          onUpdate={onUpdate}
          onSetGroupCount={(choice, count) =>
            dispatch({ type: 'SET_GROUP_COUNT', choice, count })
          }
        />
      )}
      {step === 'relationship' && (
        <RelationshipStep draft={draft} onUpdate={onUpdate} />
      )}
      {step === 'experimentalUnit' && (
        <ExperimentalUnitStep draft={draft} onUpdate={onUpdate} />
      )}
      {step === 'finalDetails' && (
        <FinalDetailsStep draft={draft} onUpdate={onUpdate} />
      )}
    </WizardStepShell>
  )
}
