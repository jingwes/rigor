import { useCallback, useState } from 'react'
import type { ExperimentDesign } from '../../models/ExperimentDesign'
import type { AuditEntry } from '../../models/AuditEntry'
import {
  initialAnalysisPlanAuditState,
  lockAnalysisPlan,
  reachResults,
  resetAnalysisPlanAudit,
  type AnalysisPlanAuditState,
} from './analysisPlanAudit'

export interface UseAnalysisPlanAudit {
  history: AuditEntry[]
  /** Whether "Lock analysis plan and view results" has been clicked at least once this session. */
  isLocked: boolean
  /** Appends a `'plan-locked'` entry and captures the current design as the new baseline. */
  lock: (design: ExperimentDesign) => void
  /**
   * Call once a results-eligible view is about to render, while locked.
   * Never blocks rendering - only decides what (if anything) to log.
   */
  markResultsReached: (design: ExperimentDesign) => void
  /** Starts a brand-new, empty audit trail (a new analysis session). */
  reset: () => void
}

/**
 * Milestone 11: a thin `useState` wrapper around the pure state machine in
 * `analysisPlanAudit.ts` - all real decision-making lives there so it stays
 * unit-testable without React.
 */
export function useAnalysisPlanAudit(): UseAnalysisPlanAudit {
  const [state, setState] = useState<AnalysisPlanAuditState>(initialAnalysisPlanAuditState)

  const lock = useCallback((design: ExperimentDesign) => {
    setState((prev) => lockAnalysisPlan(prev, design))
  }, [])

  const markResultsReached = useCallback((design: ExperimentDesign) => {
    setState((prev) => reachResults(prev, design))
  }, [])

  const reset = useCallback(() => {
    setState(resetAnalysisPlanAudit())
  }, [])

  return {
    history: state.history,
    isLocked: state.lockedFields !== undefined,
    lock,
    markResultsReached,
    reset,
  }
}
