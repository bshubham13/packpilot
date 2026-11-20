import { describe, it, expect } from 'vitest'
import {
  generateRecommendations,
  determineHasLaundry,
  dismissItem,
} from '../../src/engine'
import { calculateReadinessScore } from '../../src/utils/scoring'
import type { TripConfig, PackingItem, NormalizedTripContext } from '../../src/types'

function createSampleTrip(overrides: Partial<TripConfig> = {}): TripConfig {
  return {
    name: 'Alpine Summer Adventure',
    destination: 'Interlaken, Switzerland',
    startDate: '2026-07-01',
    endDate: '2026-07-07', // 7 days (UTC safe)
    transportModes: ['flight'],
    activities: ['sightseeing', 'trekking'],
    climate: 'mixed',
    accommodationType: 'hotel',
    travellers: {
      adults: 2,
      teens: 0,
      children: 0,
      infants: 0,
      seniors: 0,
    },
    personalPreferences: ['medications'],
    ...overrides,
  }
}

describe('Recommendation Orchestration Pipeline (src/engine/index.ts)', () => {
  describe('determineHasLaundry', () => {
    it('returns false for hotel, rental, or friends_family accommodation without explicit laundry confirmation', () => {
      expect(determineHasLaundry(createSampleTrip({ accommodationType: 'hotel' }))).toBe(false)
      expect(determineHasLaundry(createSampleTrip({ accommodationType: 'rental' }))).toBe(false)
      expect(determineHasLaundry(createSampleTrip({ accommodationType: 'friends_family' }))).toBe(false)
    })

    it('returns false for camping, hostel, or other accommodation with no selection', () => {
      expect(determineHasLaundry(createSampleTrip({ accommodationType: 'camping' }))).toBe(false)
      expect(determineHasLaundry(createSampleTrip({ accommodationType: 'hostel' }))).toBe(false)
      expect(determineHasLaundry(createSampleTrip({ accommodationType: undefined }))).toBe(false)
    })

    it('returns true for any accommodation when laundry is explicitly selected in personalPreferences', () => {
      expect(
        determineHasLaundry(
          createSampleTrip({ accommodationType: 'hotel', personalPreferences: ['laundry'] })
        )
      ).toBe(true)
      expect(
        determineHasLaundry(
          createSampleTrip({ accommodationType: 'camping', personalPreferences: ['laundry'] })
        )
      ).toBe(true)
    })

    it('returns true when hasLaundryAccess is explicitly set to true on trip config', () => {
      expect(
        determineHasLaundry(
          createSampleTrip({ accommodationType: 'rental', hasLaundryAccess: true })
        )
      ).toBe(true)
    })

    it('returns false when hasLaundryAccess is explicitly set to false even if preference was selected', () => {
      expect(
        determineHasLaundry(
          createSampleTrip({
            accommodationType: 'hotel',
            hasLaundryAccess: false,
            personalPreferences: ['laundry'],
          })
        )
      ).toBe(false)
    })
  })

  describe('New Trip Generation', () => {
    it('orchestrates 7 modular rules, deduplication, and quantity calculation end-to-end', () => {
      const trip = createSampleTrip({
        transportModes: ['flight', 'car'],
        activities: ['beach', 'trekking'],
        climate: 'warm',
        travellers: { adults: 2, teens: 0, children: 0, infants: 1, seniors: 0 },
        hasLaundryAccess: true, // explicitly confirmed laundry
      })

      const result = generateRecommendations(trip)

      expect(result.durationDays).toBe(7)
      expect(result.hasLaundry).toBe(true)
      expect(result.items.length).toBeGreaterThan(15)

      const slugs = result.items.map((i) => i.itemSlug)

      // Verified base rules
      expect(slugs).toContain('doc-id-card')
      expect(slugs).toContain('wear-underwear')
      expect(slugs).toContain('toil-dental-kit')

      // Verified flight rules (neutral ID wording)
      expect(slugs).toContain('doc-passport')
      expect(slugs).toContain('toil-cabin-liquids-bag')

      // Verified car rules
      expect(slugs).toContain('gear-car-roadside-kit')

      // Verified beach & trekking activity rules
      expect(slugs).toContain('wear-swimwear')
      expect(slugs).toContain('wear-trekking-boots')

      // Verified composition rules for 1 infant
      expect(slugs).toContain('fam-diapers-pack')
      expect(slugs).toContain('fam-infant-bottles')

      // Verified zero duplicate slugs
      const uniqueSlugs = new Set(slugs)
      expect(uniqueSlugs.size).toBe(slugs.length)
    })

    it('merges multiple triggers and rationales when multiple rules recommend the same item', () => {
      const trip = createSampleTrip({
        climate: 'warm', // recommends sunscreen (recommended)
        activities: ['beach'], // also recommends sunscreen (recommended)
      })

      const result = generateRecommendations(trip)
      const sunscreen = result.items.find((i) => i.itemSlug === 'toil-sunscreen-spf50')

      expect(sunscreen).toBeDefined()
      expect(sunscreen?.priority).toBe('recommended')
      // Reasons from both climate (warm) and activity (beach) merged without duplicate slugs
      expect(sunscreen?.reasons.length).toBeGreaterThanOrEqual(2)
      // Exactly one sunscreen item in the list
      const sunscreenCount = result.items.filter((i) => i.itemSlug === 'toil-sunscreen-spf50').length
      expect(sunscreenCount).toBe(1)
    })

    it('uses corrected laundry detection to scale clothing quantities between laundry and no-laundry trips', () => {
      // 14-day trip at a hotel WITHOUT explicit laundry selection: hasLaundry must be false
      const tripWithoutLaundry = createSampleTrip({
        startDate: '2026-07-01',
        endDate: '2026-07-14', // 14 days
        accommodationType: 'hotel',
        personalPreferences: [], // no laundry selected
        hasLaundryAccess: undefined,
        travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 0 },
      })
      const resultNoLaundry = generateRecommendations(tripWithoutLaundry)
      expect(resultNoLaundry.hasLaundry).toBe(false)

      const tshirtsNoLaundry = resultNoLaundry.items.find((i) => i.itemSlug === 'wear-tshirt')
      // Without laundry: 14 days capped at noLaundryMaxCap 10 (buffer 0) = 10 per adult * 2 adults = 20
      expect(tshirtsNoLaundry?.effectiveQuantity).toBe(20)

      // Same 14-day trip WITH explicit laundry access confirmed: hasLaundry must be true
      const tripWithLaundry = createSampleTrip({
        startDate: '2026-07-01',
        endDate: '2026-07-14', // 14 days
        accommodationType: 'hotel',
        hasLaundryAccess: true, // explicit confirmation
        travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 0 },
      })
      const resultWithLaundry = generateRecommendations(tripWithLaundry)
      expect(resultWithLaundry.hasLaundry).toBe(true)

      const tshirtsWithLaundry = resultWithLaundry.items.find((i) => i.itemSlug === 'wear-tshirt')
      // With laundry: 5-day rotation cap (buffer 0) = 5 per adult * 2 adults = 10
      expect(tshirtsWithLaundry?.effectiveQuantity).toBe(10)
    })
  })

  describe('Checklist Regeneration & Parameter Edits', () => {
    it('preserves user custom items and packed states during trip regeneration', () => {
      const trip = createSampleTrip()
      const initial = generateRecommendations(trip)

      // User packs 2 t-shirts and adds a custom item
      const userChecklist: PackingItem[] = initial.items.map((item) => {
        if (item.itemSlug === 'wear-tshirt') {
          return { ...item, packedQuantity: 2 }
        }
        return item
      })

      const customGear: PackingItem = {
        id: 'custom-binoculars-id',
        tripId: 'trip-default',
        name: 'High-Powered Birding Binoculars',
        itemSlug: 'custom-binoculars',
        category: 'gear',
        priority: 'optional',
        quantityStrategy: 'user_defined',
        generatedQuantity: 1,
        effectiveQuantity: 1,
        packedQuantity: 1,
        isPacked: true,
        isShared: true,
        isCustom: true,
        reasons: ['User personal hobby'],
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
      }
      userChecklist.push(customGear)

      // Regenerate trip with changed dates (extended from 7 to 10 days)
      const extendedTrip = { ...trip, endDate: '2026-07-10' }
      const regenerated = generateRecommendations(extendedTrip, { existingItems: userChecklist })

      // Custom item strictly preserved
      const foundCustom = regenerated.items.find((i) => i.itemSlug === 'custom-binoculars')
      expect(foundCustom).toBeDefined()
      expect(foundCustom?.isCustom).toBe(true)
      expect(foundCustom?.packedQuantity).toBe(1)

      // Packed progress preserved
      const tshirt = regenerated.items.find((i) => i.itemSlug === 'wear-tshirt')
      expect(tshirt?.packedQuantity).toBe(2)
    })

    it('retains items from removed activities in an advisory state rather than deleting them', () => {
      // User initially had beach activity
      const beachTrip = createSampleTrip({ activities: ['beach', 'sightseeing'] })
      const initial = generateRecommendations(beachTrip)

      const initialSwimwear = initial.items.find((i) => i.itemSlug === 'wear-swimwear')
      expect(initialSwimwear).toBeDefined()

      // User packs the swimwear
      const existingWithPacked = initial.items.map((i) =>
        i.itemSlug === 'wear-swimwear' ? { ...i, packedQuantity: 1 } : i
      )

      // User removes beach activity (only sightseeing left)
      const nonBeachTrip = createSampleTrip({ activities: ['sightseeing'] })
      const regenerated = generateRecommendations(nonBeachTrip, {
        existingItems: existingWithPacked,
      })

      // Swimwear is NOT deleted; marked orphaned with advisory note
      const orphanedSwimwear = regenerated.items.find((i) => i.itemSlug === 'wear-swimwear')
      expect(orphanedSwimwear).toBeDefined()
      expect(orphanedSwimwear?.isOrphaned).toBe(true)
      expect(orphanedSwimwear?.advisory).toContain('no longer active')
      expect(orphanedSwimwear?.packedQuantity).toBe(1) // User packed progress preserved
      expect(regenerated.orphanedItems.some((i) => i.itemSlug === 'wear-swimwear')).toBe(true)
    })

    it('suppresses dismissed critical items and flags outstanding warnings for readiness score', () => {
      const trip = createSampleTrip({ transportModes: ['flight'] })
      const initial = generateRecommendations(trip)

      // User dismisses passport (e.g. domestic flight where passport is not needed)
      const { updatedChecklist, dismissedRecord } = dismissItem(initial.items, 'doc-passport')
      expect(dismissedRecord).toBeDefined()
      expect(dismissedRecord?.priority).toBe('critical')

      // Regenerate trip with flight mode still active
      const regenerated = generateRecommendations(trip, {
        existingItems: updatedChecklist,
        dismissedRecords: [dismissedRecord!],
      })

      // doc-passport is NOT resurrected
      expect(regenerated.items.some((i) => i.itemSlug === 'doc-passport')).toBe(false)

      // Flags outstanding critical dismissed warning
      expect(regenerated.criticalDismissedWarnings).toHaveLength(1)
      expect(regenerated.criticalDismissedWarnings[0].itemSlug).toBe('doc-passport')

      // Readiness score integration: Even if all active items are 100% packed,
      // the dismissed critical item prevents isFullyReady = true
      const fullyPackedActive = regenerated.items.map((i) => ({
        ...i,
        packedQuantity: i.effectiveQuantity,
        isPacked: true,
      }))
      const score = calculateReadinessScore(fullyPackedActive, regenerated.dismissedRecords)
      expect(score.hasOutstandingCritical).toBe(true)
      expect(score.isFullyReady).toBe(false) // Safety guardrail: cannot claim false 100% readiness
    })

    it('pipeline is strictly idempotent across repeated invocations', () => {
      const trip = createSampleTrip()
      const run1 = generateRecommendations(trip)
      const run2 = generateRecommendations(trip, { existingItems: run1.items })

      expect(run2.items.map((i) => i.itemSlug)).toEqual(run1.items.map((i) => i.itemSlug))
      expect(run2.items.map((i) => i.effectiveQuantity)).toEqual(
        run1.items.map((i) => i.effectiveQuantity)
      )
    })
  })

  describe('Zero Travellers & Edge Cases', () => {
    it('handles trip with zero travellers safely without throwing or fabricating personal items', () => {
      const zeroTrip = createSampleTrip({
        travellers: { adults: 0, teens: 0, children: 0, infants: 0, seniors: 0 },
      })

      const result = generateRecommendations(zeroTrip)
      expect(result.durationDays).toBe(7)

      // Personal items like underwear or toothbrushes must not exist
      const personalItems = result.items.filter((i) => i.quantityStrategy === 'per_person')
      expect(personalItems).toHaveLength(0)

      // Fixed items (like roadside kit or universal adapter) are preserved
      const fixedItems = result.items.filter((i) => i.quantityStrategy === 'fixed')
      expect(fixedItems.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Journey Intelligence Pipeline Integration (Milestone 7.2B-2A)', () => {
    const intercityContext: NormalizedTripContext = {
      contextVersion: '2.0.0',
      contextState: 'current',
      tripId: 'trip-intercity-1',
      name: 'Delhi Conference',
      startDate: '2026-10-10',
      endDate: '2026-10-14',
      durationDays: 5,
      travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 0 },
      hasLaundryAccess: false,
      activities: ['sightseeing'],
      personalPreferences: [],
      baggageConfig: { hasCabinBaggage: true, cabinWeightLimitKg: 7, hasCheckedBaggage: false, checkedWeightLimitKg: 23 },
      legacyClimateEnum: 'mixed',
      journey: {
        origin: {
          city: { id: 'pune_in', name: 'Pune', country: 'India', countryCode: 'IN' },
          coordinates: { latitude: 18.5204, longitude: 73.8567, isCentroid: true },
        },
        destination: {
          city: { id: 'delhi_in', name: 'Delhi', country: 'India', countryCode: 'IN' },
          coordinates: { latitude: 28.6139, longitude: 77.209, isCentroid: true },
        },
        straightLineDistanceKm: 1173.0,
        isHeuristicDistance: true,
        classification: 'intercity',
        durationRangeHours: { min: 24.0, max: 28.0, method: 'speed_envelope_heuristic' },
        overnightSelection: 'auto',
        isOvernightTransit: true,
        isOvernightResolved: true,
        primaryTransport: 'train',
        secondaryTransportModes: [],
        destinationMobility: { isDrivingAtDestination: true },
        provenance: { distanceMethod: 'haversine', retrievalMethod: 'offline_fallback', availability: 'available' },
      },
      environment: {
        daily: [],
        summary: {},
        hasFullForecastCoverage: false,
        hasPartialForecastCoverage: false,
        contextProvenance: { provider: 'none', retrievalMethod: 'offline_fallback', source: 'none', availability: 'unresolved_location', confidence: 'unavailable' },
        attribution: 'Open-Meteo.com',
      },
      contextGeneratedAt: '2026-10-01T00:00:00Z',
    }

    it('1. generates eligible journey recommendations for intercity journey with supplied normalized context', () => {
      const trip = createSampleTrip({
        transportModes: ['train'],
        startDate: '2026-10-10',
        endDate: '2026-10-14',
      })

      const result = generateRecommendations(trip, {
        normalizedContext: intercityContext,
      })

      const slugs = result.items.map((i) => i.itemSlug)
      // Confirmed overnight ground transit
      expect(slugs).toContain('wear-dorm-earplugs')
      expect(slugs).toContain('wear-travel-blanket')
      expect(slugs).toContain('wear-neck-pillow')
      // Intercity hydration & duration items
      expect(slugs).toContain('gear-reusable-bottle')
      expect(slugs).toContain('misc-transit-snacks')
      // Destination mobility items (isDrivingAtDestination === true)
      expect(slugs).toContain('doc-driver-licence')
      expect(slugs).toContain('elec-car-mount')
    })

    it('2. does not generate distance-dependent recommendations for local journey', () => {
      const localContext: NormalizedTripContext = {
        ...intercityContext,
        journey: {
          ...intercityContext.journey,
          straightLineDistanceKm: 25.0,
          classification: 'local',
          durationRangeHours: { min: 0.5, max: 1.0, method: 'speed_envelope_heuristic' },
          isOvernightTransit: false,
          isOvernightResolved: true,
          destinationMobility: {},
        },
      }

      const trip = createSampleTrip({ transportModes: ['car'] })
      const result = generateRecommendations(trip, { normalizedContext: localContext })
      const slugs = result.items.map((i) => i.itemSlug)

      // Suppressed for local trips
      expect(slugs).not.toContain('gear-reusable-bottle')
      expect(slugs).not.toContain('misc-transit-snacks')
      expect(slugs).not.toContain('wear-neck-pillow')
      expect(slugs).not.toContain('wear-dorm-earplugs')
      expect(slugs).not.toContain('wear-travel-blanket')
    })

    it('3. suppresses distance-dependent recommendations when origin is unknown', () => {
      const tripWithoutOrigin = createSampleTrip({
        origin: undefined,
        originLocation: undefined,
      })

      // Evaluated without supplied context; fallback triggers with unknown classification
      const result = generateRecommendations(tripWithoutOrigin)
      const slugs = result.items.map((i) => i.itemSlug)

      expect(slugs).not.toContain('gear-reusable-bottle')
      expect(slugs).not.toContain('misc-transit-snacks')
      expect(slugs).not.toContain('wear-neck-pillow')
    })

    it('4. legacy trip without normalized context remains fully functional', () => {
      const legacyTrip: TripConfig = {
        name: 'Legacy 1.0 Trip',
        destination: 'Goa',
        startDate: '2026-11-01',
        endDate: '2026-11-05',
        transportModes: ['flight'],
        activities: ['beach'],
        climate: 'warm',
        travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 0 },
      }

      const result = generateRecommendations(legacyTrip)
      expect(result.durationDays).toBe(5)
      expect(result.items.length).toBeGreaterThan(10)

      const slugs = result.items.map((i) => i.itemSlug)
      // Standard legacy items present
      expect(slugs).toContain('doc-id-card')
      expect(slugs).toContain('doc-passport')
      expect(slugs).toContain('wear-swimwear')
      expect(slugs).toContain('toil-sunscreen-spf50')

      // Zero distance items fabricated
      expect(slugs).not.toContain('gear-reusable-bottle')
      expect(slugs).not.toContain('misc-transit-snacks')
    })

    it('5. preserves existing climate and transport recommendations intact', () => {
      const coldTrip = createSampleTrip({
        climate: 'cold',
        transportModes: ['bike'],
      })

      const result = generateRecommendations(coldTrip)
      const slugs = result.items.map((i) => i.itemSlug)

      // Climate rules intact
      expect(slugs).toContain('wear-thermal-layers')
      expect(slugs).toContain('wear-winter-jacket')
      // Transport rules intact
      expect(slugs).toContain('gear-moto-helmet')
      expect(slugs).toContain('wear-moto-jacket')
    })

    it('6. shared slugs deduplicate and merge reasons correctly across rules', () => {
      // Overnight hostel trip: accommodationRules emits wear-dorm-earplugs, journeyRules also emits wear-dorm-earplugs
      const hostelContext: NormalizedTripContext = {
        ...intercityContext,
        accommodationType: 'hostel',
      }

      const hostelTrip = createSampleTrip({
        accommodationType: 'hostel',
        transportModes: ['train'],
      })

      const result = generateRecommendations(hostelTrip, { normalizedContext: hostelContext })
      const earplugItems = result.items.filter((i) => i.itemSlug === 'wear-dorm-earplugs')

      // Deduplication guarantees exactly ONE physical item
      expect(earplugItems).toHaveLength(1)
      // Reasons from both accommodation (dormitory noise) and journey (overnight transit) are merged
      expect(earplugItems[0].reasons.length).toBeGreaterThanOrEqual(2)
      expect(earplugItems[0].reasons.some((r) => r.includes('dormitories'))).toBe(true)
      expect(earplugItems[0].reasons.some((r) => r.includes('overnight transit'))).toBe(true)
    })

    it('7. preserves user-adjusted quantities, packed state, dismissed snapshots, and custom items during reconciliation', () => {
      const trip = createSampleTrip({ transportModes: ['train'] })
      const initial = generateRecommendations(trip, { normalizedContext: intercityContext })

      // User custom item
      const customItem: PackingItem = {
        id: 'custom-item-1',
        tripId: 'trip-intercity-1',
        name: 'Personal Travel Journal',
        itemSlug: 'custom-journal',
        category: 'miscellaneous',
        priority: 'optional',
        quantityStrategy: 'user_defined',
        generatedQuantity: 1,
        effectiveQuantity: 1,
        packedQuantity: 1,
        isPacked: true,
        isCustom: true,
        isShared: false,
        reasons: ['User entry'],
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      }

      // User adjusts quantity of reusable bottle to 3 and packs 2
      const modifiedList: PackingItem[] = [
        ...initial.items.map((item) => {
          if (item.itemSlug === 'gear-reusable-bottle') {
            return {
              ...item,
              userAdjustedQuantity: 3,
              effectiveQuantity: 3,
              packedQuantity: 2,
              isPacked: false,
            }
          }
          return item
        }),
        customItem,
      ]

      // User dismisses wear-neck-pillow
      const { updatedChecklist, dismissedRecord } = dismissItem(modifiedList, 'wear-neck-pillow')

      // Re-run pipeline (simulating checklist regeneration)
      const reconciled = generateRecommendations(trip, {
        existingItems: updatedChecklist,
        dismissedRecords: [dismissedRecord!],
        normalizedContext: intercityContext,
      })

      // Custom item preserved
      const journal = reconciled.items.find((i) => i.itemSlug === 'custom-journal')
      expect(journal).toBeDefined()
      expect(journal?.isCustom).toBe(true)
      expect(journal?.isPacked).toBe(true)

      // User-adjusted quantity & packed progress preserved
      const bottle = reconciled.items.find((i) => i.itemSlug === 'gear-reusable-bottle')
      expect(bottle?.userAdjustedQuantity).toBe(3)
      expect(bottle?.effectiveQuantity).toBe(3)
      expect(bottle?.packedQuantity).toBe(2)

      // Dismissed neck pillow is NOT resurrected
      expect(reconciled.items.some((i) => i.itemSlug === 'wear-neck-pillow')).toBe(false)
    })

    it('8. repeated identical inputs produce strictly deterministic results', () => {
      const trip = createSampleTrip({ transportModes: ['train'] })
      const fixedNow = '2026-10-01T00:00:00.000Z'
      const run1 = generateRecommendations(trip, { normalizedContext: intercityContext, now: fixedNow })
      const run2 = generateRecommendations(trip, { normalizedContext: intercityContext, now: fixedNow })

      expect(run1.items).toEqual(run2.items)
    })
  })
})
