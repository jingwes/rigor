/**
 * Deterministic horizontal jitter for raw-observation dot plots.
 *
 * Points are spread out within a group's category so that overlapping
 * observations remain individually visible, without resorting to a
 * non-reproducible `Math.random()` call - the same `count`/`seed` always
 * produces the same offsets, so a chart's on-screen layout and its
 * SVG/PNG export always match, and re-rendering (e.g. after a
 * customization change) doesn't shuffle points around.
 */

/** mulberry32: a small, fast, deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let state = seed
  return function next() {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Returns `count` deterministic offsets in the range [-0.5, 0.5], suitable
 * for multiplying by a jitter width and adding to each point's category
 * x-position.
 */
export function computeJitterOffsets(count: number, seed = 1): number[] {
  const random = mulberry32((count + 1) * 2654435761 + seed)
  const offsets: number[] = []
  for (let i = 0; i < count; i++) {
    offsets.push(random() - 0.5)
  }
  return offsets
}
