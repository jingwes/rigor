import { describe, expect, it } from 'vitest'
import { checkMethodDescription } from './methodDescriptionChecker'
import type { ExperimentDesign } from '../models/ExperimentDesign'

type CheckedDesign = Pick<ExperimentDesign, 'relationship' | 'technicalReplication'>

function designWith(overrides: Partial<CheckedDesign>): CheckedDesign {
  return {
    relationship: 'independent',
    technicalReplication: { present: false },
    ...overrides,
  }
}

describe('checkMethodDescription', () => {
  describe('empty/neutral input', () => {
    it('returns no alerts for an empty description', () => {
      expect(checkMethodDescription('', designWith({}))).toEqual([])
    })

    it('returns no alerts for whitespace-only description', () => {
      expect(checkMethodDescription('   \n  ', designWith({}))).toEqual([])
    })

    it('returns no alerts for unrelated, neutral text', () => {
      const text = 'We measured plant height using a ruler once a week for a month.'
      expect(checkMethodDescription(text, designWith({}))).toEqual([])
    })
  })

  describe('family 1: paired/repeated-structure phrases vs independent relationship', () => {
    const independentDesign = designWith({ relationship: 'independent' })

    it.each([
      ['same participants', 'Ten participants completed the same participants test twice.'],
      ['same subjects', 'The same subjects were tested twice.'],
      ['same mice', 'We used the same mice in both conditions.'],
      ['before and after', 'Reaction time was measured before and after drinking coffee.'],
      ['pre and post', 'Scores were compared pre and post the intervention.'],
      ['matched', 'Samples were matched to a donor-specific control.'],
      ['paired', 'Each treated sample was paired with a control from the same donor.'],
      ['each animal', 'We took a baseline reading from each animal.'],
      ['per animal', 'One reading was recorded per animal.'],
      ['each well', 'Absorbance was read for each well.'],
      ['per well', 'One measurement was taken per well.'],
    ])('fires on "%s"', (_label, text) => {
      const alerts = checkMethodDescription(text, independentDesign)
      const relationshipAlert = alerts.find((a) => a.id === 'relationship-paired-phrase-vs-independent')
      expect(relationshipAlert).toBeDefined()
      expect(relationshipAlert?.designField).toBe('relationship')
      expect(text.toLowerCase()).toContain(relationshipAlert!.matchedPhrase.toLowerCase())
    })

    it('fires on "repeated measures"', () => {
      const alerts = checkMethodDescription(
        'We used a repeated measures design for reaction time.',
        independentDesign,
      )
      expect(
        alerts.some((a) => a.id === 'relationship-paired-phrase-vs-independent'),
      ).toBe(true)
    })

    it('fires on "measured ... repeatedly"', () => {
      const alerts = checkMethodDescription(
        'Each participant was measured repeatedly across the session.',
        independentDesign,
      )
      expect(
        alerts.some((a) => a.id === 'relationship-paired-phrase-vs-independent'),
      ).toBe(true)
    })

    it('fires on "repeatedly measured"', () => {
      const alerts = checkMethodDescription(
        'Blood pressure was repeatedly measured throughout the day.',
        independentDesign,
      )
      expect(
        alerts.some((a) => a.id === 'relationship-paired-phrase-vs-independent'),
      ).toBe(true)
    })

    it('does NOT fire on bare "repeated" without a measurement-phrase context (the documented false-positive guard)', () => {
      const text = 'We repeated the setup twice for consistency before starting.'
      const alerts = checkMethodDescription(text, independentDesign)
      expect(alerts.some((a) => a.id === 'relationship-paired-phrase-vs-independent')).toBe(false)
    })

    it('does NOT fire on "repeated three times" alone (that is family 3, not family 1)', () => {
      const text = 'The whole experiment was repeated three times.'
      const alerts = checkMethodDescription(text, independentDesign)
      expect(alerts.some((a) => a.id === 'relationship-paired-phrase-vs-independent')).toBe(false)
    })

    it('does not match "paired"/"repeated" inside unrelated longer words (word-boundary check)', () => {
      const text = 'The unpairedness of the repairedly-calibrated sensors was noted.'
      const alerts = checkMethodDescription(text, independentDesign)
      expect(alerts.some((a) => a.id === 'relationship-paired-phrase-vs-independent')).toBe(false)
    })

    it('does NOT fire when the description is consistent with a paired design (relationship !== independent)', () => {
      const pairedDesign = designWith({ relationship: 'paired' })
      const text = 'The same participants were measured before and after the intervention.'
      const alerts = checkMethodDescription(text, pairedDesign)
      expect(alerts.some((a) => a.designField === 'relationship')).toBe(false)
    })
  })

  describe('family 2: technical-replicate phrases vs technicalReplication.present', () => {
    it.each([
      ['triplicate', 'Each sample was run in triplicate.'],
      ['technical replicate', 'We included one technical replicate per sample.'],
      ['technical replicates', 'Three technical replicates were performed per condition.'],
      ['each well', 'Fluorescence was recorded for each well.'],
      ['per well', 'Two readings were taken per well.'],
    ])('fires on "%s" when technicalReplication.present is false', (_label, text) => {
      const design = designWith({ technicalReplication: { present: false } })
      const alerts = checkMethodDescription(text, design)
      expect(alerts.some((a) => a.id === 'technical-replication-phrase-vs-absent')).toBe(true)
    })

    it('fires when technicalReplication.present is null ("not sure"/not asked)', () => {
      const design = designWith({ technicalReplication: { present: null } })
      const alerts = checkMethodDescription('Each sample was run in triplicate.', design)
      expect(alerts.some((a) => a.id === 'technical-replication-phrase-vs-absent')).toBe(true)
    })

    it('does NOT fire when technicalReplication.present is true (consistent with the description)', () => {
      const design = designWith({ technicalReplication: { present: true, measurementsPerUnit: 3 } })
      const alerts = checkMethodDescription('Each sample was run in triplicate.', design)
      expect(alerts.some((a) => a.id === 'technical-replication-phrase-vs-absent')).toBe(false)
    })

    it('can fire alongside the relationship alert for the same "each well"/"per well" phrase', () => {
      const design = designWith({
        relationship: 'independent',
        technicalReplication: { present: false },
      })
      const alerts = checkMethodDescription('Absorbance was read for each well.', design)
      expect(alerts).toHaveLength(2)
      expect(alerts.map((a) => a.designField).sort()).toEqual(['relationship', 'technicalReplication'])
    })
  })

  describe('family 3: independent-replicate phrases vs paired/repeated relationship', () => {
    it.each([
      ['independent experiment', 'This was run as an independent experiment.', 'paired' as const],
      ['independent experiments', 'We ran three independent experiments.', 'repeated' as const],
      ['repeated three times', 'The whole experiment was repeated three times.', 'paired' as const],
    ])('fires on "%s" when relationship is %s', (_label, text, relationship) => {
      const design = designWith({ relationship })
      const alerts = checkMethodDescription(text, design)
      expect(alerts.some((a) => a.id === 'relationship-independent-phrase-vs-paired')).toBe(true)
    })

    it('does NOT fire when relationship is independent (already consistent)', () => {
      const design = designWith({ relationship: 'independent' })
      const alerts = checkMethodDescription('We ran three independent experiments.', design)
      expect(alerts.some((a) => a.id === 'relationship-independent-phrase-vs-paired')).toBe(false)
    })

    it('does NOT fire on the bare word "independent" without "experiment(s)"', () => {
      const design = designWith({ relationship: 'paired' })
      const alerts = checkMethodDescription(
        'Groups were treated independent of one another in the schedule.',
        design,
      )
      expect(alerts.some((a) => a.id === 'relationship-independent-phrase-vs-paired')).toBe(false)
    })
  })

  describe('design is never mutated', () => {
    it('leaves a frozen design object untouched', () => {
      const design = Object.freeze(
        designWith({
          relationship: 'independent',
          technicalReplication: Object.freeze({ present: false }),
        }),
      )
      expect(() =>
        checkMethodDescription(
          'The same participants were measured before and after, in triplicate.',
          design,
        ),
      ).not.toThrow()
    })

    it('the returned alerts never reference or alter the design object identity', () => {
      const design = designWith({ relationship: 'independent' })
      const before = JSON.parse(JSON.stringify(design))
      checkMethodDescription('The same participants were tested before and after.', design)
      expect(design).toEqual(before)
    })
  })
})
