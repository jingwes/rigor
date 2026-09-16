/**
 * Shared numeric display formatting for the results/report views. Kept
 * separate and pure so both `generateInterpretationText.ts` and the results
 * UI format numbers identically.
 */
export function formatStatistic(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return 'not available'
  return Number.isInteger(value) ? value.toString() : value.toFixed(digits)
}
