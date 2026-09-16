export interface QuestionForkStepProps {
  onChooseGroupComparison: () => void
  onChooseCorrelation: () => void
  onExit: () => void
}

/**
 * Milestone 10's new entry point, shown right after "Start an analysis" and
 * before the existing group-comparison wizard's first step. This is a
 * research-question-SHAPE fork ("what are you trying to find out"), not a
 * statistical-test menu - consistent with the project's "start from the
 * design, not the test" philosophy.
 *
 * This is purely an additive fork placed ahead of the existing wizard: it
 * does not modify anything inside `ExperimentDesignWizard`/`WizardProvider`/
 * the group-comparison step components. Choosing "differs between groups or
 * conditions" routes into that existing flow completely unchanged; choosing
 * "related to each other" routes into the new, separate correlation design
 * flow (`CorrelationDesignFlow`).
 */
export function QuestionForkStep({
  onChooseGroupComparison,
  onChooseCorrelation,
  onExit,
}: QuestionForkStepProps) {
  return (
    <section aria-labelledby="question-fork-title">
      <h2 id="question-fork-title">What are you trying to find out?</h2>
      <p>Pick the option that best matches your research question.</p>

      <div className="format-options">
        <div className="format-option">
          <h3>Whether an outcome differs between groups or conditions</h3>
          <p className="option-examples">
            e.g. does a treatment change recovery rate; is one variety taller than another; did a
            behavior change before vs. after an intervention.
          </p>
          <button type="button" onClick={onChooseGroupComparison}>
            My question is about differences between groups or conditions
          </button>
        </div>

        <div className="format-option">
          <h3>Whether two measurements are related to each other</h3>
          <p className="option-examples">
            e.g. is height related to weight; does study time predict test score - one X
            measurement and one Y measurement per independent unit, no groups involved.
          </p>
          <button type="button" onClick={onChooseCorrelation}>
            My question is about a relationship between two measurements
          </button>
        </div>
      </div>

      <div className="wizard-nav">
        <button type="button" onClick={onExit} className="wizard-back">
          Back to home
        </button>
      </div>
    </section>
  )
}
