/**
 * Milestone 5: per-group visual encoding.
 *
 * Groups are never distinguished by color alone: each slot pairs a
 * categorical color with a distinct point *shape*, and callers always also
 * render the group's text label (on the axis and/or in the legend). Losing
 * the color (grayscale printout, color-blind viewer) still leaves shape +
 * position + label to tell groups apart.
 *
 * Colors are the validated categorical palette from the project's data-viz
 * guidelines (light/dark pairs chosen to clear color-vision-deficiency and
 * contrast checks), reused here as fixed constants - no runtime color
 * generation.
 */

export type PointShape =
  'circle' | 'square' | 'triangle' | 'diamond' | 'cross' | 'triangle-down'

export interface GroupVisualStyle {
  color: string
  darkColor: string
  shape: PointShape
}

const CATEGORICAL_SLOTS: readonly GroupVisualStyle[] = [
  { color: '#2a78d6', darkColor: '#3987e5', shape: 'circle' },
  { color: '#eb6834', darkColor: '#d95926', shape: 'square' },
  { color: '#1baf7a', darkColor: '#199e70', shape: 'triangle' },
  { color: '#eda100', darkColor: '#c98500', shape: 'diamond' },
  { color: '#e87ba4', darkColor: '#d55181', shape: 'cross' },
  { color: '#4a3aa7', darkColor: '#9085e9', shape: 'triangle-down' },
]

/** Cycles through the palette for any number of groups. */
export function getGroupVisualStyle(index: number): GroupVisualStyle {
  return CATEGORICAL_SLOTS[index % CATEGORICAL_SLOTS.length]
}
