/**
 * Milestone 6: p-value formatting.
 *
 * Per the project's philosophy, a p-value is never shown as "P = 0.000" -
 * that misrepresents an arbitrarily small (but nonzero) probability as
 * exactly zero. Below a fixed threshold we report "P < 0.001" instead; at or
 * above it, we round to three decimal places. This is presentation-only -
 * it never rounds/truncates the underlying number used anywhere else.
 */

const SMALL_P_THRESHOLD = 0.001

export function formatPValue(pValue: number): string {
  if (!Number.isFinite(pValue)) {
    return 'P is undefined'
  }
  if (pValue < SMALL_P_THRESHOLD) {
    return 'P < 0.001'
  }
  // Rounding a value like 0.0009999 up to 0.001 would collide with the
  // "< 0.001" bucket's own boundary - guard against that edge case so we
  // never print the misleading "P = 0.001" for something that rounds up to
  // it from just above the strict less-than cutoff, while also never
  // printing "P = 0.000" for anything at or above the threshold.
  const rounded = pValue.toFixed(3)
  if (rounded === '0.000') {
    return 'P < 0.001'
  }
  return `P = ${rounded}`
}
