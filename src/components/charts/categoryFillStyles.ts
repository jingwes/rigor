/**
 * Milestone 9: per-outcome-category visual encoding for
 * `CategoricalBarChart`, following the same "never color alone" principle
 * `groupStyles.ts` established for point shapes - bars additionally use a
 * distinct SVG hatch pattern per category, plus the category's text label is
 * always rendered (axis/legend), so color-blind or grayscale viewing still
 * distinguishes categories.
 *
 * Deliberately a separate module from `groupStyles.ts` rather than reusing
 * its `PointShape`s: a filled bar needs a fill *pattern*, not a point shape.
 * Colors reuse the SAME validated categorical palette values as
 * `groupStyles.ts` (kept as independent constants here, rather than
 * importing/repurposing that module's shape-coupled export) so the app's
 * color language stays consistent.
 */

export type FillPatternKind =
  | 'solid'
  | 'diagonal'
  | 'diagonal-reverse'
  | 'dots'
  | 'horizontal'
  | 'vertical'

export interface CategoryFillStyle {
  color: string
  pattern: FillPatternKind
}

const CATEGORY_SLOTS: readonly CategoryFillStyle[] = [
  { color: '#2a78d6', pattern: 'solid' },
  { color: '#eb6834', pattern: 'diagonal' },
  { color: '#1baf7a', pattern: 'dots' },
  { color: '#eda100', pattern: 'diagonal-reverse' },
  { color: '#e87ba4', pattern: 'horizontal' },
  { color: '#4a3aa7', pattern: 'vertical' },
]

/** Cycles through the palette for any number of categories. */
export function getCategoryFillStyle(index: number): CategoryFillStyle {
  return CATEGORY_SLOTS[index % CATEGORY_SLOTS.length]
}
