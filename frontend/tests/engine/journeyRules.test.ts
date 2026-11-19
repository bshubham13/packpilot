import { describe, it, expect } from 'vitest'
import { evaluateJourneyRules } from '../../src/engine/rules/journeyRules'
import { evaluateTransportRules } from '../../src/engine/rules/transportRules'
import { getReferenceWeight } from '../../src/engine/referenceWeights'
import type { JourneyContext, TravellerComposition, TripConfig } from '../../src/types'

describe('Journey Intelligence Rules (Milestone 7.2B-1 — Domain Corrections)', () => {
  const baseTravellers: TravellerComposition = {
    adults: 2,
    teens: 1,
    children: 0,
    infants: 0,
    seniors: 0,
  }

  const createJourney = (overrides: Partial<JourneyContext> = {}): JourneyContext => ({
    destination: {
      city: { id: 'delhi_in', name: 'Delhi', country: 'India', countryCode: 'IN' },
      coordinates: { latitude: 28.6139, longitude: 77.209, isCentroid: true },
    },
    isHeuristicDistance: true,
    classification: 'unknown',
    overnightSelection: 'auto',
    isOvernightTransit: false,
    isOvernightResolved: true,
    primaryTransport: 'train',
    secondaryTransportModes: [],
    destinationMobility: {},
    provenance: {
      distanceMethod: 'none',
      retrievalMethod: 'offline_fallback',
      availability: 'available',
    },
    ...overrides,
  })

  describe('1. Journey Duration & Flight Comfort Constraints', () => {
    it('does NOT generate transit snacks or second neck pillow for a 2.5-hour flight (Pune -> Delhi)', () => {
      const flightJourney = createJourney({
        straightLineDistanceKm: 1173.0,
        classification: 'intercity',
        durationRangeHours: { min: 2.2, max: 2.8, method: 'speed_envelope_heuristic' },
        primaryTransport: 'flight',
        isOvernightTransit: false,
        isOvernightResolved: true,
      })

      const candidates = evaluateJourneyRules(flightJourney, baseTravellers)
      const slugs = candidates.map((c) => c.itemSlug)

      // Reusable bottle is appropriate for intercity
      expect(slugs).toContain('gear-reusable-bottle')

      // Snacks MUST NOT be generated because durationMinHours (2.2) < 4.0
      expect(slugs).not.toContain('misc-transit-snacks')

      // Neck pillow MUST NOT be generated because flight comfort is owned by transportRules
      expect(slugs).not.toContain('wear-neck-pillow')

      // Power bank MUST NOT be generated at journey level (owned by baseRules)
      expect(slugs).not.toContain('elec-power-bank')
    })

    it('generates transit snacks for non-flight journeys with estimated duration >= 4.0 hours', () => {
      const longTrainJourney = createJourney({
        straightLineDistanceKm: 450.0,
        classification: 'intercity',
        durationRangeHours: { min: 6.0, max: 7.5, method: 'speed_envelope_heuristic' },
        primaryTransport: 'train',
      })

      const candidates = evaluateJourneyRules(longTrainJourney, baseTravellers)
      const snacks = candidates.find((c) => c.itemSlug === 'misc-transit-snacks')

      expect(snacks).toBeDefined()
      expect(snacks?.reasons[0]).toContain('estimated journey ≥ 4 hours')
      // Variable composite bundle weight must be undefined (unknown)
      expect(snacks?.weightGrams).toBeUndefined()
    })

    it('generates neck pillow for non-flight journeys of at least 4 hours', () => {
      const longBusJourney = createJourney({
        straightLineDistanceKm: 350.0,
        classification: 'intercity',
        durationRangeHours: { min: 5.5, max: 7.0, method: 'speed_envelope_heuristic' },
        primaryTransport: 'bus',
      })

      const candidates = evaluateJourneyRules(longBusJourney, baseTravellers)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('wear-neck-pillow')
    })
  })

  describe('2. Overnight Transit & Shared Canonical Sleep Slugs', () => {
    it('uses canonical wear-dorm-earplugs and wear-travel-blanket for confirmed overnight ground transit', () => {
      const overnightTrain = createJourney({
        straightLineDistanceKm: 1173.0,
        classification: 'intercity',
        durationRangeHours: { min: 24.0, max: 28.0, method: 'speed_envelope_heuristic' },
        primaryTransport: 'train',
        isOvernightTransit: true,
        isOvernightResolved: true,
      })

      const candidates = evaluateJourneyRules(overnightTrain, baseTravellers)
      const slugs = candidates.map((c) => c.itemSlug)

      // Uses single canonical slug shared with accommodationRules
      expect(slugs).toContain('wear-dorm-earplugs')
      expect(slugs).toContain('wear-travel-blanket')
      expect(slugs).toContain('wear-neck-pillow')

      // Does not introduce fragmented duplicate slugs
      expect(slugs).not.toContain('wear-sleep-mask')
      expect(slugs).not.toContain('wear-transit-earplugs')

      // Does not generate duplicate separate dental bundle
      expect(slugs).not.toContain('toil-transit-kit')
    })

    it('does not generate overnight items when overnight transit is false or unresolved', () => {
      const unresolvedJourney = createJourney({
        isOvernightTransit: false,
        isOvernightResolved: false,
      })

      const candidates = evaluateJourneyRules(unresolvedJourney, baseTravellers)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).not.toContain('wear-dorm-earplugs')
      expect(slugs).not.toContain('wear-travel-blanket')
      expect(slugs).not.toContain('wear-neck-pillow')
    })

    it('ensures daytime train does not generate travel blanket in transportRules or journeyRules', () => {
      // Daytime train trip config
      const daytimeTrainConfig: TripConfig = {
        name: 'Daytime Shatabdi',
        destination: 'Agra',
        startDate: '2026-10-10',
        endDate: '2026-10-10',
        transportModes: ['train'],
        activities: ['sightseeing'],
        travellers: baseTravellers,
        overnightSelection: 'auto', // Daytime train: auto resolves to false
      }

      const transportCandidates = evaluateTransportRules(daytimeTrainConfig)
      const transportSlugs = transportCandidates.map((c) => c.itemSlug)
      expect(transportSlugs).toContain('doc-train-ticket')
      expect(transportSlugs).not.toContain('wear-travel-blanket')

      const daytimeJourney = createJourney({
        classification: 'regional',
        durationRangeHours: { min: 2.0, max: 2.5, method: 'speed_envelope_heuristic' },
        primaryTransport: 'train',
        isOvernightTransit: false,
        isOvernightResolved: true,
      })

      const journeyCandidates = evaluateJourneyRules(daytimeJourney, baseTravellers)
      const journeySlugs = journeyCandidates.map((c) => c.itemSlug)
      expect(journeySlugs).not.toContain('wear-travel-blanket')
    })
  })

  describe('3. Destination Driving Intent (No Rental Assumptions)', () => {
    it('generates neutral driver licence and car mount, but NO rental voucher, when isDrivingAtDestination === true', () => {
      const drivingJourney = createJourney({
        primaryTransport: 'flight',
        destinationMobility: { isDrivingAtDestination: true },
      })

      const candidates = evaluateJourneyRules(drivingJourney, baseTravellers)
      const slugs = candidates.map((c) => c.itemSlug)

      // Neutral driver licence (shared, fixed: 1)
      expect(slugs).toContain('doc-driver-licence')
      const licence = candidates.find((c) => c.itemSlug === 'doc-driver-licence')
      expect(licence?.name).toBe('Valid Driver’s Licence')
      expect(licence?.isShared).toBe(true)
      expect(licence?.quantityStrategy).toBe('fixed')
      expect(licence?.quantityParams?.minQuantity).toBe(1)

      // Dashboard mount
      expect(slugs).toContain('elec-car-mount')

      // MUST NOT fabricate vehicle rental confirmation
      expect(slugs).not.toContain('doc-rental-confirmation')
    })

    it('does not generate driving items when isDrivingAtDestination is false or undefined', () => {
      const undefinedMobilityJourney = createJourney({
        primaryTransport: 'car',
        destinationMobility: {},
      })

      const candidates = evaluateJourneyRules(undefinedMobilityJourney, baseTravellers)
      const slugs = candidates.map((c) => c.itemSlug)

      // Destination mobility items must not be inferred from transport mode
      expect(slugs).not.toContain('doc-rental-confirmation')
      expect(slugs).not.toContain('doc-transit-pass')
    })
  })

  describe('4. Motion Relief Constraints (Bus/Coach Only)', () => {
    it('does NOT generate motion-relief wristbands for ordinary car journeys', () => {
      const carJourney = createJourney({
        classification: 'regional',
        durationRangeHours: { min: 2.5, max: 3.5, method: 'speed_envelope_heuristic' },
        primaryTransport: 'car',
        secondaryTransportModes: [],
      })

      const candidates = evaluateJourneyRules(carJourney, baseTravellers)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('gear-reusable-bottle')
      // Ordinary car trip must not trigger motion bands
      expect(slugs).not.toContain('health-motion-relief')
    })

    it('generates motion-relief wristbands for bus/coach journeys', () => {
      const busJourney = createJourney({
        classification: 'regional',
        durationRangeHours: { min: 3.5, max: 4.5, method: 'speed_envelope_heuristic' },
        primaryTransport: 'bus',
      })

      const candidates = evaluateJourneyRules(busJourney, baseTravellers)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('health-motion-relief')
      const motion = candidates.find((c) => c.itemSlug === 'health-motion-relief')
      expect(motion?.priority).toBe('optional')
      expect(motion?.reasons[0]).toContain('coach/bus transit')
    })

    it('generates motion-relief wristbands when bus is a secondary transit leg', () => {
      const multiModeJourney = createJourney({
        classification: 'intercity',
        durationRangeHours: { min: 5.0, max: 6.5, method: 'speed_envelope_heuristic' },
        primaryTransport: 'train',
        secondaryTransportModes: ['bus'],
      })

      const candidates = evaluateJourneyRules(multiModeJourney, baseTravellers)
      const slugs = candidates.map((c) => c.itemSlug)

      expect(slugs).toContain('health-motion-relief')
    })
  })

  describe('5. Reference Weight Audit for Variable Bundles', () => {
    it('treats composite bundles as unknown weight and discrete items as known weight', () => {
      expect(getReferenceWeight('misc-transit-snacks')).toBeUndefined()
      expect(getReferenceWeight('toil-transit-kit')).toBeUndefined()
      expect(getReferenceWeight('doc-rental-confirmation')).toBeUndefined()

      // Discrete physical items retain realistic baseline weights
      expect(getReferenceWeight('gear-reusable-bottle')).toBe(160)
      expect(getReferenceWeight('wear-neck-pillow')).toBe(190)
      expect(getReferenceWeight('wear-dorm-earplugs')).toBe(30)
      expect(getReferenceWeight('wear-travel-blanket')).toBe(290)
      expect(getReferenceWeight('doc-driver-licence')).toBe(15)
      expect(getReferenceWeight('doc-transit-pass')).toBe(10)
    })
  })
})
