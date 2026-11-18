import { describe, it, expect } from 'vitest'
import {
  calculateItemQuantity,
  getEligibleTravellerCount,
} from '../../src/engine/quantityCalculator'
import type { TravellerComposition } from '../../src/types'

describe('Quantity Calculator & Strategy Engine (src/engine/quantityCalculator.ts)', () => {
  const defaultTravellers: TravellerComposition = {
    adults: 2,
    teens: 1,
    children: 1,
    infants: 1,
    seniors: 0,
  } // Total = 5 travellers

  describe('getEligibleTravellerCount', () => {
    it('correctly resolves total travellers for "all"', () => {
      expect(getEligibleTravellerCount(defaultTravellers, 'all')).toBe(5)
    })

    it('correctly filters specific age groups', () => {
      expect(getEligibleTravellerCount(defaultTravellers, 'adults')).toBe(2)
      expect(getEligibleTravellerCount(defaultTravellers, 'teens')).toBe(1)
      expect(getEligibleTravellerCount(defaultTravellers, 'children')).toBe(1)
      expect(getEligibleTravellerCount(defaultTravellers, 'infants')).toBe(1)
      expect(getEligibleTravellerCount(defaultTravellers, 'seniors')).toBe(0)
      expect(getEligibleTravellerCount(defaultTravellers, 'adults_and_teens')).toBe(3)
    })
  })

  describe('Strategy: per_person', () => {
    it('scales exactly 1 per person by default', () => {
      const qty = calculateItemQuantity('per_person', {}, {
        durationDays: 7,
        hasLaundry: false,
        travellers: defaultTravellers,
      })
      expect(qty).toBe(5) // 5 total travellers
    })

    it('scales per eligible age group count when targetAgeGroup is specified', () => {
      const qty = calculateItemQuantity('per_person', {}, {
        durationDays: 7,
        hasLaundry: false,
        travellers: defaultTravellers,
        targetAgeGroup: 'adults',
      })
      expect(qty).toBe(2) // 2 adults
    })

    it('returns 0 when targetAgeGroup has 0 travellers', () => {
      const qty = calculateItemQuantity('per_person', {}, {
        durationDays: 7,
        hasLaundry: false,
        travellers: defaultTravellers,
        targetAgeGroup: 'seniors',
      })
      expect(qty).toBe(0) // 0 seniors
    })

    it('scales by unitsPerPerson when multiple units are required per person', () => {
      // E.g. 2 feeding bottles per infant: 1 infant * 2 = 2 bottles
      const qty1 = calculateItemQuantity('per_person', { unitsPerPerson: 2 }, {
        durationDays: 7,
        hasLaundry: false,
        travellers: defaultTravellers,
        targetAgeGroup: 'infants',
      })
      expect(qty1).toBe(2)

      // 2 infants * 2 bottles each = 4 bottles
      const qty2 = calculateItemQuantity('per_person', { unitsPerPerson: 2 }, {
        durationDays: 7,
        hasLaundry: false,
        travellers: { adults: 2, teens: 0, children: 0, infants: 2, seniors: 0 },
        targetAgeGroup: 'infants',
      })
      expect(qty2).toBe(4)
    })
  })

  describe('Strategy: per_day', () => {
    it('scales directly with trip calendar days independent of traveller count', () => {
      const qty = calculateItemQuantity('per_day', { baseUnitsPerDay: 2 }, {
        durationDays: 5,
        hasLaundry: false,
        travellers: defaultTravellers,
      })
      expect(qty).toBe(10) // 5 days * 2 units/day
    })

    it('clamps minimum duration to 1 day if negative or zero duration is passed', () => {
      const qty = calculateItemQuantity('per_day', { baseUnitsPerDay: 1 }, {
        durationDays: -5,
        hasLaundry: false,
        travellers: defaultTravellers,
      })
      expect(qty).toBe(1)
    })
  })

  describe('Strategy: per_person_per_day (Laundry vs No-Laundry)', () => {
    const soloTraveller: TravellerComposition = {
      adults: 1,
      teens: 0,
      children: 0,
      infants: 0,
      seniors: 0,
    }

    it('rotates clothing on laundryRotationDays cycle when laundry is available', () => {
      // For a 14-day trip with laundry (7-day cap, buffer +1): (7 + 1) * 1 = 8 pairs
      const qtyWithLaundry = calculateItemQuantity(
        'per_person_per_day',
        { laundryRotationDays: 7, bufferUnits: 1 },
        { durationDays: 14, hasLaundry: true, travellers: soloTraveller }
      )
      expect(qtyWithLaundry).toBe(8)
    })

    it('scales up to noLaundryMaxCap when laundry is NOT available', () => {
      // For a 14-day trip without laundry (cap 21, buffer +1): (14 + 1) * 1 = 15 pairs
      const qtyNoLaundry = calculateItemQuantity(
        'per_person_per_day',
        { laundryRotationDays: 7, noLaundryMaxCap: 21, bufferUnits: 1 },
        { durationDays: 14, hasLaundry: false, travellers: soloTraveller }
      )
      expect(qtyNoLaundry).toBe(15)
    })

    it('enforces item-specific noLaundryMaxCap on long trips (e.g. 60-day trip)', () => {
      // 60-day trip without laundry, capped at 21 + 1 buffer = 22 pairs
      const qtyLongTrip = calculateItemQuantity(
        'per_person_per_day',
        { laundryRotationDays: 7, noLaundryMaxCap: 21, bufferUnits: 1 },
        { durationDays: 60, hasLaundry: false, travellers: soloTraveller }
      )
      expect(qtyLongTrip).toBe(22)
    })

    it('multiplies correctly by eligible traveller count', () => {
      // 5-day trip with laundry for 2 adults: (5 + 1 buffer) * 2 adults = 12
      const qty = calculateItemQuantity(
        'per_person_per_day',
        { laundryRotationDays: 7, bufferUnits: 1 },
        { durationDays: 5, hasLaundry: true, travellers: defaultTravellers, targetAgeGroup: 'adults' }
      )
      expect(qty).toBe(12)
    })

    it('correctly multiplies effective days by baseUnitsPerDay (e.g. consumables)', () => {
      // 5-day trip with baseUnitsPerDay = 4 and buffer = 2 for 1 infant:
      // (5 * 4) + 2 = 22 units
      const qty1 = calculateItemQuantity(
        'per_person_per_day',
        { baseUnitsPerDay: 4, bufferUnits: 2, laundryRotationDays: 10, noLaundryMaxCap: 10 },
        { durationDays: 5, hasLaundry: false, travellers: defaultTravellers, targetAgeGroup: 'infants' }
      )
      expect(qty1).toBe(22)

      // Same trip for 2 infants: 22 * 2 = 44 units
      const qty2 = calculateItemQuantity(
        'per_person_per_day',
        { baseUnitsPerDay: 4, bufferUnits: 2, laundryRotationDays: 10, noLaundryMaxCap: 10 },
        {
          durationDays: 5,
          hasLaundry: false,
          travellers: { adults: 2, teens: 0, children: 0, infants: 2, seniors: 0 },
          targetAgeGroup: 'infants',
        }
      )
      expect(qty2).toBe(44)
    })

    it('calculates infant diaper quantities across different trip durations without under-recommending', () => {
      const diaperParams = {
        baseUnitsPerDay: 4,
        bufferUnits: 2,
        laundryRotationDays: 10,
        noLaundryMaxCap: 10,
      }
      const singleInfant: TravellerComposition = {
        adults: 2,
        teens: 0,
        children: 0,
        infants: 1,
        seniors: 0,
      }

      // 1-day trip: (1 * 4) + 2 = 6 diapers
      expect(
        calculateItemQuantity('per_person_per_day', diaperParams, {
          durationDays: 1,
          hasLaundry: false,
          travellers: singleInfant,
          targetAgeGroup: 'infants',
        })
      ).toBe(6)

      // 3-day trip: (3 * 4) + 2 = 14 diapers
      expect(
        calculateItemQuantity('per_person_per_day', diaperParams, {
          durationDays: 3,
          hasLaundry: false,
          travellers: singleInfant,
          targetAgeGroup: 'infants',
        })
      ).toBe(14)

      // 7-day trip: (7 * 4) + 2 = 30 diapers (exceeds old arbitrary 24 cap)
      expect(
        calculateItemQuantity('per_person_per_day', diaperParams, {
          durationDays: 7,
          hasLaundry: false,
          travellers: singleInfant,
          targetAgeGroup: 'infants',
        })
      ).toBe(30)

      // 14-day trip: capped at 10 days of luggage capacity = (10 * 4) + 2 = 42 diapers
      expect(
        calculateItemQuantity('per_person_per_day', diaperParams, {
          durationDays: 14,
          hasLaundry: false,
          travellers: singleInfant,
          targetAgeGroup: 'infants',
        })
      ).toBe(42)

      // 7-day trip with 2 infants: ((7 * 4) + 2) * 2 = 60 diapers
      const twinInfants: TravellerComposition = {
        adults: 2,
        teens: 0,
        children: 0,
        infants: 2,
        seniors: 0,
      }
      expect(
        calculateItemQuantity('per_person_per_day', diaperParams, {
          durationDays: 7,
          hasLaundry: false,
          travellers: twinInfants,
          targetAgeGroup: 'infants',
        })
      ).toBe(60)
    })
  })

  describe('Strategy: shared_capacity', () => {
    it('calculates durable shared gear by capacity (e.g. 1 tent per 2 travellers)', () => {
      // 5 travellers, tent capacity 2: ceil(5 / 2) = 3 tents
      const qty = calculateItemQuantity(
        'shared_capacity',
        { capacityPerUnit: 2 },
        { durationDays: 4, hasLaundry: false, travellers: defaultTravellers }
      )
      expect(qty).toBe(3)
    })

    it('calculates consumable shared items by capacity and replenishment days', () => {
      // Sunscreen: 1 bottle per 3 travellers, lasts 10 days
      // 5 travellers for 15 days:
      // Units for group = ceil(5 / 3) = 2 bottles
      // Replenishment cycles = ceil(15 / 10) = 2 cycles
      // Total bottles = 2 * 2 = 4 bottles
      const qty = calculateItemQuantity(
        'shared_capacity',
        { capacityPerUnit: 3, baseUnitsPerDay: 10 },
        { durationDays: 15, hasLaundry: false, travellers: defaultTravellers }
      )
      expect(qty).toBe(4)
    })

    it('safely handles capacity <= 0 by clamping to 1 to prevent division by zero', () => {
      const qty = calculateItemQuantity(
        'shared_capacity',
        { capacityPerUnit: 0 },
        { durationDays: 3, hasLaundry: false, travellers: defaultTravellers }
      )
      expect(qty).toBe(5) // ceil(5 / 1) = 5
    })
  })

  describe('Strategy: fixed & user_defined', () => {
    it('returns fixed constant quantity independent of duration and travellers', () => {
      const qtyFixed = calculateItemQuantity('fixed', { minQuantity: 2 }, {
        durationDays: 20,
        hasLaundry: true,
        travellers: defaultTravellers,
      })
      expect(qtyFixed).toBe(2)

      const qtyUser = calculateItemQuantity('user_defined', { minQuantity: 3 }, {
        durationDays: 2,
        hasLaundry: false,
        travellers: defaultTravellers,
      })
      expect(qtyUser).toBe(3)
    })
  })

  describe('Boundary Clamping (minQuantity & maxQuantity)', () => {
    it('respects minQuantity and maxQuantity limits for active items', () => {
      const clampedMax = calculateItemQuantity(
        'per_day',
        { baseUnitsPerDay: 10, maxQuantity: 25 },
        { durationDays: 10, hasLaundry: false, travellers: defaultTravellers }
      ) // 10 * 10 = 100, clamped to 25
      expect(clampedMax).toBe(25)

      const clampedMin = calculateItemQuantity(
        'per_person',
        { minQuantity: 8 },
        { durationDays: 3, hasLaundry: false, travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 0 } }
      ) // 2 * 1 = 2, clamped to min 8
      expect(clampedMin).toBe(8)
    })
  })

  describe('Zero-Traveller Handling & Clamping Safety', () => {
    const zeroTravellers: TravellerComposition = {
      adults: 0,
      teens: 0,
      children: 0,
      infants: 0,
      seniors: 0,
    }

    it('prevents minQuantity clamping from creating artificial items when travellers = 0', () => {
      // per_person must return 0 even with minQuantity = 5
      expect(
        calculateItemQuantity(
          'per_person',
          { minQuantity: 5 },
          { durationDays: 7, hasLaundry: false, travellers: zeroTravellers }
        )
      ).toBe(0)

      // per_person_per_day must return 0 even with minQuantity = 10
      expect(
        calculateItemQuantity(
          'per_person_per_day',
          { minQuantity: 10, baseUnitsPerDay: 4 },
          { durationDays: 7, hasLaundry: false, travellers: zeroTravellers }
        )
      ).toBe(0)

      // shared_capacity must return 0 even with minQuantity = 2
      expect(
        calculateItemQuantity(
          'shared_capacity',
          { minQuantity: 2, capacityPerUnit: 2 },
          { durationDays: 7, hasLaundry: false, travellers: zeroTravellers }
        )
      ).toBe(0)

      // per_day must return 0 when no travellers exist
      expect(
        calculateItemQuantity(
          'per_day',
          { minQuantity: 3, baseUnitsPerDay: 2 },
          { durationDays: 7, hasLaundry: false, travellers: zeroTravellers }
        )
      ).toBe(0)
    })

    it('preserves fixed and user-defined quantities even when traveller count = 0', () => {
      // Fixed items (e.g. emergency car kit or power converter)
      expect(
        calculateItemQuantity(
          'fixed',
          { minQuantity: 2 },
          { durationDays: 7, hasLaundry: false, travellers: zeroTravellers }
        )
      ).toBe(2)

      // User-defined items
      expect(
        calculateItemQuantity(
          'user_defined',
          { minQuantity: 3 },
          { durationDays: 7, hasLaundry: false, travellers: zeroTravellers }
        )
      ).toBe(3)
    })
  })

  describe('Input Validation & Resilience (NaN, Negatives, Infinity)', () => {
    it('sanitizes invalid or negative durationDays safely', () => {
      // Negative duration clamps to 1
      expect(
        calculateItemQuantity(
          'per_day',
          { baseUnitsPerDay: 2 },
          { durationDays: -10, hasLaundry: false, travellers: defaultTravellers }
        )
      ).toBe(2)

      // NaN duration clamps to 1
      expect(
        calculateItemQuantity(
          'per_day',
          { baseUnitsPerDay: 3 },
          { durationDays: NaN, hasLaundry: false, travellers: defaultTravellers }
        )
      ).toBe(3)

      // Infinity duration clamps to 1
      expect(
        calculateItemQuantity(
          'per_day',
          { baseUnitsPerDay: 1 },
          { durationDays: Infinity, hasLaundry: false, travellers: defaultTravellers }
        )
      ).toBe(1)
    })

    it('sanitizes negative or invalid traveller compositions', () => {
      const invalidTravellers = {
        adults: -3,
        teens: NaN,
        children: 2,
        infants: -1,
        seniors: 0,
      } as unknown as TravellerComposition

      // Only children (2) are valid
      expect(
        calculateItemQuantity(
          'per_person',
          {},
          { durationDays: 3, hasLaundry: false, travellers: invalidTravellers, targetAgeGroup: 'children' }
        )
      ).toBe(2)

      // Adults were -3 -> 0
      expect(
        calculateItemQuantity(
          'per_person',
          {},
          { durationDays: 3, hasLaundry: false, travellers: invalidTravellers, targetAgeGroup: 'adults' }
        )
      ).toBe(0)
    })

    it('never produces NaN, negative, or infinite return values', () => {
      const res = calculateItemQuantity(
        'per_person_per_day',
        {
          baseUnitsPerDay: NaN,
          bufferUnits: -5,
          laundryRotationDays: Infinity,
        },
        { durationDays: NaN, hasLaundry: true, travellers: defaultTravellers }
      )
      expect(Number.isFinite(res)).toBe(true)
      expect(res).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(res)).toBe(true)
    })
  })
})
