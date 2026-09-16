/**
 * Numeric coercion for a raw, student-typed value string.
 *
 * This never throws away information: it either returns the parsed number
 * (which may be `Infinity`, `-Infinity`, or otherwise unusable - callers
 * decide what to do about that) or `undefined` when the string genuinely
 * isn't numeric at all (e.g. "ten"). It never rounds, clamps, or "corrects"
 * anything.
 */
export function parseNumericValue(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined
  const trimmed = raw.trim()
  if (trimmed.length === 0) return undefined

  const parsed = Number(trimmed)
  if (Number.isNaN(parsed)) return undefined
  return parsed
}
