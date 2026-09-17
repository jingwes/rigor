/**
 * Milestone 14: the deterministic method-description cross-checker (project
 * spec Section 40).
 *
 * This is NOT an LLM, NOT fuzzy matching, and NOT a statistics computation.
 * It is a small set of plain, case-insensitive phrase/substring rules run
 * over the free-text "describe your experiment in your own words" box, that
 * looks for wording suggesting a different experimental structure than the
 * one the student already selected earlier in the wizard. Every rule below
 * is a fixed, readable regular expression - nothing here guesses meaning,
 * calls out to a model, or does any NLP-style disambiguation.
 *
 * Like everything else in Rigor, this is a safety-NET, not a gate: it only
 * ever returns advisory `MethodDescriptionAlert`s describing a *possible*
 * mismatch for the student to look at. Nothing in this module ever reads or
 * writes application state, touches `ExperimentDesign` fields, or decides
 * anything on the student's behalf - it is a pure function of the text and
 * the (read-only) design fields relevant to each check.
 *
 * ---------------------------------------------------------------------------
 * Phrase families and matching approach
 * ---------------------------------------------------------------------------
 *
 * 1. "Paired/repeated-structure" phrases - wording that usually describes
 *    linked or repeated measurements (the same participants/units measured
 *    more than once, or deliberately matched):
 *      - "same <participants/subjects/mice/rats/students/patients/animals/
 *        plants/samples/cells/wells/donors>" (one rule, generalized over a
 *        small explicit noun list - not exhaustive, deliberately so)
 *      - "before and after"
 *      - "pre and post"
 *      - "matched"
 *      - "paired"
 *      - "repeated measures", or "measured ... repeatedly"/"repeatedly
 *        measured" - see the note on "repeated" below
 *      - "each animal" / "per animal"
 *      - "each well" / "per well"
 *    Checked against `design.relationship === 'independent'`.
 *
 * 2. "Technical-replicate" phrases - wording that usually describes repeated
 *    measurements of the same experimental unit (not itself about
 *    independence/pairing, but about `technicalReplication`):
 *      - "triplicate"
 *      - "technical replicate(s)"
 *      - "each well" / "per well" (shared with family 1 - a well-based
 *        description can be evidence for BOTH a relationship mismatch and a
 *        technical-replication mismatch at once; these are checked
 *        independently and can both fire)
 *    Checked against `design.technicalReplication.present !== true` (i.e.
 *    the student said "no", or said they weren't sure/didn't answer).
 *
 * 3. "Independent-replicate" phrases - wording that usually describes
 *    separate, unlinked repeats of a whole experiment (the opposite
 *    direction from family 1):
 *      - "independent experiment(s)" (also matches "three independent
 *        experiments")
 *      - "repeated three times"
 *    Checked against `design.relationship === 'paired' || 'repeated'`.
 *
 * Note on "repeated": the bare word "repeated" is far too common a word
 * (e.g. "we repeated the setup to check consistency") to treat as a
 * standalone signal - a bare substring match on it would false-positive
 * constantly. So it is deliberately NOT included as a bare pattern anywhere
 * below. It only contributes to a match as part of a specific phrase:
 * "repeated measures", "measured ... repeatedly"/"repeatedly measured" (family
 * 1), or "repeated three times" (family 3). Plain "repeated" alone never
 * matches anything in this module - this is specifically unit-tested.
 *
 * Note on "paired": unlike "repeated", the bare word "paired" IS matched as
 * its own rule (per the project spec's phrase list). This can occasionally
 * false-positive on incidental, non-experimental-design usage (e.g. "the
 * water was paired with electrodes"). Per the spec, this is an accepted,
 * documented trade-off, not something this deterministic, non-NLP module
 * tries to disambiguate away - the whole point of "deterministic" here is
 * simple, explainable substring/regex rules, not NLP-grade context
 * understanding.
 *
 * Word-boundary handling: every pattern uses `\b` word boundaries around its
 * key words, so e.g. "paired" does not match inside an unrelated word like
 * "repaired" or "unpaired-sounding", and phrase rules require the words to
 * appear as whole words in the given order (allowing normal whitespace
 * between them).
 */

import type { ExperimentDesign } from '../models/ExperimentDesign'

export interface MethodDescriptionAlert {
  id: string
  /** The exact phrase/substring found in the student's text (original casing preserved). */
  matchedPhrase: string
  designField: 'relationship' | 'technicalReplication'
  /** Plain-language, non-judgmental explanation - "possible design mismatch," never "you are wrong." */
  explanation: string
}

interface PhraseRule {
  id: string
  pattern: RegExp
}

// Family 1: paired/repeated-structure phrases (see module doc comment above
// for the full rationale). Order matters only in that the FIRST matching
// rule's exact substring becomes the alert's `matchedPhrase`.
const PAIRED_STRUCTURE_RULES: PhraseRule[] = [
  {
    id: 'same-unit',
    pattern:
      /\bsame\s+(participants?|subjects?|mice|mouse|rats?|students?|patients?|animals?|plants?|samples?|cells?|wells?|donors?)\b/i,
  },
  { id: 'before-and-after', pattern: /\bbefore\s+and\s+after\b/i },
  { id: 'pre-and-post', pattern: /\bpre\s+and\s+post\b/i },
  { id: 'matched', pattern: /\bmatched\b/i },
  { id: 'paired', pattern: /\bpaired\b/i },
  {
    // "repeated measures", or "measured ... repeatedly" / "repeatedly
    // measured" - deliberately NOT a bare "repeated" match; see the module
    // doc comment's note on "repeated".
    id: 'repeated-measures-context',
    pattern: /\brepeated\s+measures?\b|\bmeasured\s+(?:\w+\s+){0,4}repeatedly\b|\brepeatedly\s+measured\b/i,
  },
  { id: 'each-or-per-animal', pattern: /\b(?:each|per)\s+animal\b/i },
  { id: 'each-or-per-well-relationship', pattern: /\b(?:each|per)\s+well\b/i },
]

// Family 2: technical-replicate phrases.
const TECHNICAL_REPLICATE_RULES: PhraseRule[] = [
  { id: 'triplicate', pattern: /\btriplicate\b/i },
  { id: 'technical-replicate', pattern: /\btechnical\s+replicates?\b/i },
  { id: 'each-or-per-well-technical', pattern: /\b(?:each|per)\s+well\b/i },
]

// Family 3: independent-replicate phrases (the opposite direction of family 1).
const INDEPENDENT_REPLICATE_RULES: PhraseRule[] = [
  // Also matches "three independent experiments".
  { id: 'independent-experiment', pattern: /\b(?:three\s+)?independent\s+experiments?\b/i },
  { id: 'repeated-three-times', pattern: /\brepeated\s+three\s+times\b/i },
]

function firstMatch(text: string, rules: PhraseRule[]): string | undefined {
  for (const rule of rules) {
    const match = rule.pattern.exec(text)
    if (match) return match[0]
  }
  return undefined
}

/**
 * Runs every phrase family against `description`, cross-checking each
 * against the relevant part of `design`, and returns the (possibly empty)
 * list of advisory alerts. Pure: never reads or mutates anything besides its
 * arguments, and never touches `design` itself.
 */
export function checkMethodDescription(
  description: string,
  design: Pick<ExperimentDesign, 'relationship' | 'technicalReplication'>,
): MethodDescriptionAlert[] {
  const text = (description ?? '').trim()
  if (text.length === 0) return []

  const alerts: MethodDescriptionAlert[] = []

  if (design.relationship === 'independent') {
    const phrase = firstMatch(text, PAIRED_STRUCTURE_RULES)
    if (phrase) {
      alerts.push({
        id: 'relationship-paired-phrase-vs-independent',
        matchedPhrase: phrase,
        designField: 'relationship',
        explanation:
          `Your description contains "${phrase}," which usually describes linked or repeated ` +
          'measurements (the same participants or units measured more than once, or ' +
          'deliberately matched) - but you selected independent samples for this design. This ' +
          'is a possible design mismatch: paired or repeated-measures data usually needs a ' +
          'different statistical test than independent samples. Review this before continuing.',
      })
    }
  }

  if (design.technicalReplication.present !== true) {
    const phrase = firstMatch(text, TECHNICAL_REPLICATE_RULES)
    if (phrase) {
      const priorAnswer =
        design.technicalReplication.present === false
          ? 'said there were no technical replicates'
          : "weren't sure whether there were technical replicates"
      alerts.push({
        id: 'technical-replication-phrase-vs-absent',
        matchedPhrase: phrase,
        designField: 'technicalReplication',
        explanation:
          `Your description contains "${phrase}," which usually describes technical replicates ` +
          `(repeated measurements taken from the same experimental unit) - but you ${priorAnswer} ` +
          'for this design. This is a possible design mismatch: technical replicates need to be ' +
          'aggregated or accounted for, or they can understate real uncertainty ' +
          '(pseudoreplication). Review this before continuing.',
      })
    }
  }

  if (design.relationship === 'paired' || design.relationship === 'repeated') {
    const phrase = firstMatch(text, INDEPENDENT_REPLICATE_RULES)
    if (phrase) {
      alerts.push({
        id: 'relationship-independent-phrase-vs-paired',
        matchedPhrase: phrase,
        designField: 'relationship',
        explanation:
          `Your description contains "${phrase}," which usually describes independent, unlinked ` +
          `repeats of an experiment - but you selected a ${design.relationship} design, where the ` +
          'same subjects or units are measured more than once. This is a possible design ' +
          'mismatch. Review this before continuing.',
      })
    }
  }

  return alerts
}
