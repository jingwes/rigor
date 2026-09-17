import { useState } from 'react'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import { createAuditEntry, type AuditEntry } from '../../models/AuditEntry'
import {
  checkMethodDescription,
  type MethodDescriptionAlert,
} from '../../rules/methodDescriptionChecker'
import type { WizardStepId } from './wizardTypes'

export interface MethodDescriptionCheckProps {
  description: string
  onChangeDescription: (value: string) => void
  design: ExperimentDesign
  /** Navigates back to a given wizard step, without discarding any draft data. */
  onReviewStep: (step: WizardStepId) => void
  /** Records the (append-only) audit entry for a dismissed alert. */
  onRecordOverride: (entry: AuditEntry) => void
}

function stepForDesignField(field: MethodDescriptionAlert['designField']): WizardStepId {
  return field === 'relationship' ? 'relationship' : 'experimentalUnit'
}

/**
 * Milestone 14: the optional "describe your experiment in your own words"
 * box and its deterministic cross-check UI. This never runs automatically
 * and never changes anything the student already answered - it only ever
 * shows advisory alerts, each with three actions (see the three handlers
 * below), once the student explicitly asks for the check.
 */
export function MethodDescriptionCheck({
  description,
  onChangeDescription,
  design,
  onReviewStep,
  onRecordOverride,
}: MethodDescriptionCheckProps) {
  const [alerts, setAlerts] = useState<MethodDescriptionAlert[] | undefined>(undefined)
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set())

  function handleCheck() {
    setAlerts(checkMethodDescription(description, design))
    setDismissedIds(new Set())
    setExpandedIds(new Set())
  }

  function handleDismiss(alert: MethodDescriptionAlert) {
    setDismissedIds((prev) => new Set(prev).add(alert.id))
    const entry = createAuditEntry({
      action: 'method-description-override',
      description:
        `Reviewed a method-description cross-check flag and kept the original answer. ` +
        `Description phrase: "${alert.matchedPhrase}". ${alert.explanation}`,
      before: { designField: alert.designField, matchedPhrase: alert.matchedPhrase },
      after: { acknowledged: true },
    })
    onRecordOverride(entry)
  }

  function toggleExplanation(alert: MethodDescriptionAlert) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(alert.id)) next.delete(alert.id)
      else next.add(alert.id)
      return next
    })
  }

  const visibleAlerts = (alerts ?? []).filter((alert) => !dismissedIds.has(alert.id))

  return (
    <section aria-labelledby="method-description-title" className="method-description-check">
      <h3 id="method-description-title">Want an extra check? (optional)</h3>
      <p>
        Describe your experiment in your own words, and Rigor will look for phrases that might
        suggest a different design than the one you selected above - purely as a second look. This
        is completely optional, never required to continue, and never changes any answer you've
        already given.
      </p>

      <div className="field">
        <label htmlFor="method-description">Describe your experiment in your own words</label>
        <textarea
          id="method-description"
          value={description}
          onChange={(e) => onChangeDescription(e.target.value)}
          rows={3}
          placeholder="e.g. Ten students completed the reaction-time test before and after drinking coffee."
        />
      </div>

      <button type="button" onClick={handleCheck} className="wizard-back">
        Check my description
      </button>

      {alerts !== undefined && visibleAlerts.length === 0 && (
        <p className="method-description-ok">
          No possible design mismatches found in your description.
        </p>
      )}

      {visibleAlerts.map((alert) => (
        <div className="method-description-alert" key={alert.id} role="alert">
          <p>
            Your description contains &ldquo;{alert.matchedPhrase}&rdquo; - this may suggest a
            different design than the one you selected. This is only an advisory check - review it
            before continuing.
          </p>

          {expandedIds.has(alert.id) && (
            <p className="method-description-explanation">{alert.explanation}</p>
          )}

          <div className="wizard-nav">
            <button type="button" onClick={() => onReviewStep(stepForDesignField(alert.designField))}>
              Review design
            </button>
            <button type="button" onClick={() => handleDismiss(alert)}>
              My selection is correct
            </button>
            <button
              type="button"
              className="link-button"
              onClick={() => toggleExplanation(alert)}
            >
              {expandedIds.has(alert.id) ? 'Hide explanation' : 'Explain why this was flagged'}
            </button>
          </div>
        </div>
      ))}
    </section>
  )
}
