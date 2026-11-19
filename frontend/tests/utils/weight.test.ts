import { describe, it, expect } from 'vitest'
import {
  deriveItemTotalWeightGrams,
  calculateLuggageWeight,
  formatWeightDisplay,
} from '../../src/utils/weight'
import type { PackingItem, BaggageConfig } from '../../src/types'

function createMockItem(overrides: Partial<PackingItem> = {}): PackingItem {
  return {
    id: 'item-1',
    tripId: 'trip-1',
    name: 'T-Shirt',
    itemSlug: 'wear-tshirt',
    category: 'clothing',
    quantityStrategy: 'per_person_per_day',
    generatedQuantity: 2,
    effectiveQuantity: 2,
    packedQuantity: 0,
    isPacked: false,
    priority: 'recommended',
    weightGrams: 150, // 150g per unit
    isShared: false,
    isCustom: false,
    reasons: ['Base clothing'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('Luggage Weight Utilities (src/utils/weight.ts)', () => {
  describe('deriveItemTotalWeightGrams', () => {
    it('correctly calculates total weight as unit weight * effectiveQuantity', () => {
      const item = createMockItem({ weightGrams: 200, effectiveQuantity: 3 })
      expect(deriveItemTotalWeightGrams(item)).toBe(600)
    })

    it('returns undefined if unit weight is unknown or undefined', () => {
      const item = createMockItem({ weightGrams: undefined, effectiveQuantity: 3 })
      expect(deriveItemTotalWeightGrams(item)).toBeUndefined()
    })

    it('returns 0 if effectiveQuantity is 0', () => {
      const item = createMockItem({ weightGrams: 500, effectiveQuantity: 0 })
      expect(deriveItemTotalWeightGrams(item)).toBe(0)
    })
  })

  describe('calculateLuggageWeight', () => {
    it('returns zero for an empty checklist', () => {
      const estimate = calculateLuggageWeight([])
      expect(estimate.totalKnownWeightGrams).toBe(0)
      expect(estimate.totalKnownWeightKg).toBe(0)
      expect(estimate.totalKnownWeightLbs).toBe(0)
      expect(estimate.itemsWithKnownWeightCount).toBe(0)
      expect(estimate.itemsWithUnknownWeightCount).toBe(0)
      expect(estimate.hasUnknownWeights).toBe(false)
      expect(estimate.isExceedingCabinLimit).toBe(false)
      expect(estimate.isExceedingCheckedLimit).toBe(false)

      // Sub-summaries
      expect(estimate.cabin.knownWeightGrams).toBe(0)
      expect(estimate.cabin.remainingCapacityKg).toBe(7.0)
      expect(estimate.cabin.isLimitExceeded).toBe(false)
      expect(estimate.checked.knownWeightGrams).toBe(0)
      expect(estimate.checked.isConfigured).toBe(false)
      expect(estimate.unassigned.knownWeightGrams).toBe(0)
      expect(estimate.combined.totalKnownWeightGrams).toBe(0)
    })

    it('sums known weights across multiple items and converts to kg and lbs', () => {
      const items: PackingItem[] = [
        createMockItem({ name: 'Jeans', weightGrams: 600, effectiveQuantity: 2, bagAssignment: 'cabin' }), // 1200g
        createMockItem({ name: 'T-Shirt', weightGrams: 150, effectiveQuantity: 4, bagAssignment: 'cabin' }), // 600g
        createMockItem({ name: 'Rain Jacket', weightGrams: 450, effectiveQuantity: 1, bagAssignment: 'cabin' }), // 450g
      ] // Total = 2250g = 2.3 kg (rounded to 1 decimal) -> 2.3 * 2.20462 = 5.1 lbs

      const estimate = calculateLuggageWeight(items, { hasCabinBaggage: true, cabinWeightLimitKg: 7.0 })
      expect(estimate.totalKnownWeightGrams).toBe(2250)
      expect(estimate.totalKnownWeightKg).toBe(2.3)
      expect(estimate.totalKnownWeightLbs).toBe(5.1)
      expect(estimate.itemsWithKnownWeightCount).toBe(3)
      expect(estimate.itemsWithUnknownWeightCount).toBe(0)
      expect(estimate.hasUnknownWeights).toBe(false)
      expect(estimate.isExceedingCabinLimit).toBe(false)
      expect(estimate.cabin.knownWeightKg).toBe(2.3)
      expect(estimate.cabin.remainingCapacityKg).toBe(4.7) // 7.0 - 2.3 = 4.7
      expect(estimate.cabin.percentageUsed).toBe(33) // 2.3 / 7.0 = 32.85 -> 33%
    })

    it('tracks unknown weights separately without treating them as zero', () => {
      const items: PackingItem[] = [
        createMockItem({ name: 'Laptop', weightGrams: 1800, effectiveQuantity: 1, bagAssignment: 'cabin' }), // 1800g
        createMockItem({ name: 'Custom Souvenir', weightGrams: undefined, effectiveQuantity: 2, bagAssignment: 'cabin' }), // Unknown
        createMockItem({ name: 'Handmade Scarf', weightGrams: undefined, effectiveQuantity: 1, bagAssignment: 'cabin' }), // Unknown
      ]

      const estimate = calculateLuggageWeight(items)
      expect(estimate.totalKnownWeightGrams).toBe(1800)
      expect(estimate.totalKnownWeightKg).toBe(1.8)
      expect(estimate.itemsWithKnownWeightCount).toBe(1)
      expect(estimate.itemsWithUnknownWeightCount).toBe(2)
      expect(estimate.hasUnknownWeights).toBe(true)
      expect(estimate.cabin.itemsWithKnownWeightCount).toBe(1)
      expect(estimate.cabin.itemsWithUnknownWeightCount).toBe(2)
      expect(estimate.cabin.hasUnknownWeights).toBe(true)
    })

    it('handles legacy items without bagAssignment by treating them as unassigned', () => {
      const items: PackingItem[] = [
        createMockItem({ name: 'Vintage Map', weightGrams: 100, effectiveQuantity: 1 }), // No bagAssignment
        createMockItem({ name: 'Travel Pillow', weightGrams: 300, effectiveQuantity: 1 }), // No bagAssignment
      ]

      const estimate = calculateLuggageWeight(items, { hasCabinBaggage: true, cabinWeightLimitKg: 7.0 })
      expect(estimate.unassigned.knownWeightGrams).toBe(400)
      expect(estimate.unassigned.knownWeightKg).toBe(0.4)
      expect(estimate.unassigned.totalItemCount).toBe(2)
      expect(estimate.cabin.knownWeightGrams).toBe(0)
      expect(estimate.checked.knownWeightGrams).toBe(0)
      expect(estimate.cabin.remainingCapacityKg).toBe(7.0)
      expect(estimate.cabin.isLimitExceeded).toBe(false)
    })

    it('correctly handles cabin-only assigned items', () => {
      const items: PackingItem[] = [
        createMockItem({ name: 'Tablet', weightGrams: 500, effectiveQuantity: 1, bagAssignment: 'cabin' }),
        createMockItem({ name: 'Charger', weightGrams: 100, effectiveQuantity: 1, bagAssignment: 'cabin' }),
      ]

      const estimate = calculateLuggageWeight(items, { hasCabinBaggage: true, cabinWeightLimitKg: 7.0 })
      expect(estimate.cabin.knownWeightGrams).toBe(600)
      expect(estimate.cabin.knownWeightKg).toBe(0.6)
      expect(estimate.cabin.itemsWithKnownWeightCount).toBe(2)
      expect(estimate.cabin.remainingCapacityKg).toBe(6.4)
      expect(estimate.checked.knownWeightGrams).toBe(0)
      expect(estimate.unassigned.knownWeightGrams).toBe(0)
      expect(estimate.isExceedingCabinLimit).toBe(false)
    })

    it('correctly handles checked-only assigned items', () => {
      const items: PackingItem[] = [
        createMockItem({ name: 'Heavy Boots', weightGrams: 1500, effectiveQuantity: 1, bagAssignment: 'checked' }),
        createMockItem({ name: 'Parka', weightGrams: 2000, effectiveQuantity: 1, bagAssignment: 'checked' }),
      ]

      const estimate = calculateLuggageWeight(items, {
        hasCabinBaggage: true,
        cabinWeightLimitKg: 7.0,
        hasCheckedBaggage: true,
        checkedWeightLimitKg: 20.0,
      })
      expect(estimate.checked.knownWeightGrams).toBe(3500)
      expect(estimate.checked.knownWeightKg).toBe(3.5)
      expect(estimate.checked.itemsWithKnownWeightCount).toBe(2)
      expect(estimate.checked.remainingCapacityKg).toBe(16.5)
      expect(estimate.checked.isLimitExceeded).toBe(false)
      expect(estimate.cabin.knownWeightGrams).toBe(0)
      expect(estimate.unassigned.knownWeightGrams).toBe(0)
    })

    it('strictly excludes unassigned items from cabin and checked bag limits', () => {
      // Unassigned items have 10 kg, which would exceed cabin limit (7kg) if naively included
      const items: PackingItem[] = [
        createMockItem({ name: 'Heavy Books', weightGrams: 5000, effectiveQuantity: 2 }), // 10,000g = 10.0 kg unassigned
        createMockItem({ name: 'Passport', weightGrams: 50, effectiveQuantity: 1, bagAssignment: 'cabin' }), // 50g cabin
      ]

      const estimate = calculateLuggageWeight(items, {
        hasCabinBaggage: true,
        cabinWeightLimitKg: 7.0,
        hasCheckedBaggage: true,
        checkedWeightLimitKg: 23.0,
      })
      expect(estimate.cabin.knownWeightGrams).toBe(50)
      expect(estimate.cabin.knownWeightKg).toBe(0.1)
      expect(estimate.cabin.isLimitExceeded).toBe(false)
      expect(estimate.checked.isLimitExceeded).toBe(false)
      expect(estimate.unassigned.knownWeightKg).toBe(10.0)
      expect(estimate.combined.totalKnownWeightKg).toBe(10.1)
    })

    it('computes combined known weight across all groups as informational only', () => {
      const items: PackingItem[] = [
        createMockItem({ name: 'Camera', weightGrams: 1000, effectiveQuantity: 1, bagAssignment: 'cabin' }), // 1.0 kg
        createMockItem({ name: 'Tent', weightGrams: 3000, effectiveQuantity: 1, bagAssignment: 'checked' }), // 3.0 kg
        createMockItem({ name: 'Guidebook', weightGrams: 400, effectiveQuantity: 1 }), // 0.4 kg unassigned
      ]

      const estimate = calculateLuggageWeight(items, {
        hasCabinBaggage: true,
        cabinWeightLimitKg: 7.0,
        hasCheckedBaggage: true,
        checkedWeightLimitKg: 23.0,
      })
      expect(estimate.combined.totalKnownWeightGrams).toBe(4400)
      expect(estimate.combined.totalKnownWeightKg).toBe(4.4)
      expect(estimate.combined.totalItemsWithKnownWeightCount).toBe(3)
      expect(estimate.combined.totalItemsWithUnknownWeightCount).toBe(0)
      expect(estimate.combined.hasUnknownWeights).toBe(false)
    })

    it('tracks unknown weights across cabin, checked, and unassigned groups separately and overall', () => {
      const items: PackingItem[] = [
        createMockItem({ name: 'Cabin Unknown 1', weightGrams: undefined, bagAssignment: 'cabin' }),
        createMockItem({ name: 'Checked Unknown 1', weightGrams: undefined, bagAssignment: 'checked' }),
        createMockItem({ name: 'Checked Unknown 2', weightGrams: undefined, bagAssignment: 'checked' }),
        createMockItem({ name: 'Unassigned Unknown 1', weightGrams: undefined }),
      ]

      const estimate = calculateLuggageWeight(items)
      expect(estimate.cabin.itemsWithUnknownWeightCount).toBe(1)
      expect(estimate.cabin.hasUnknownWeights).toBe(true)
      expect(estimate.checked.itemsWithUnknownWeightCount).toBe(2)
      expect(estimate.checked.hasUnknownWeights).toBe(true)
      expect(estimate.unassigned.itemsWithUnknownWeightCount).toBe(1)
      expect(estimate.unassigned.hasUnknownWeights).toBe(true)
      expect(estimate.combined.totalItemsWithUnknownWeightCount).toBe(4)
      expect(estimate.combined.hasUnknownWeights).toBe(true)
    })

    it('correctly detects independent cabin limit exceedance without affecting checked baggage', () => {
      // 8.0 kg in cabin vs 7.0 kg limit; 10.0 kg in checked vs 23.0 kg limit
      const items: PackingItem[] = [
        createMockItem({ name: 'Heavy Tech Gear', weightGrams: 4000, effectiveQuantity: 2, bagAssignment: 'cabin' }), // 8.0 kg
        createMockItem({ name: 'Checked Suitcase', weightGrams: 10000, effectiveQuantity: 1, bagAssignment: 'checked' }), // 10.0 kg
      ]
      const config: BaggageConfig = {
        hasCabinBaggage: true,
        cabinWeightLimitKg: 7.0,
        hasCheckedBaggage: true,
        checkedWeightLimitKg: 23.0,
      }

      const estimate = calculateLuggageWeight(items, config)
      expect(estimate.cabin.knownWeightKg).toBe(8.0)
      expect(estimate.cabin.isLimitExceeded).toBe(true)
      expect(estimate.cabin.exceededAmountKg).toBe(1.0)
      expect(estimate.cabin.remainingCapacityKg).toBe(0)
      expect(estimate.isExceedingCabinLimit).toBe(true)

      expect(estimate.checked.knownWeightKg).toBe(10.0)
      expect(estimate.checked.isLimitExceeded).toBe(false)
      expect(estimate.checked.remainingCapacityKg).toBe(13.0)
      expect(estimate.isExceedingCheckedLimit).toBe(false)
    })

    it('correctly detects independent checked limit exceedance without affecting cabin baggage', () => {
      // 5.0 kg in cabin vs 7.0 kg limit; 25.0 kg in checked vs 23.0 kg limit
      const items: PackingItem[] = [
        createMockItem({ name: 'Cabin Bag', weightGrams: 5000, effectiveQuantity: 1, bagAssignment: 'cabin' }),
        createMockItem({ name: 'Overweight Checked', weightGrams: 25000, effectiveQuantity: 1, bagAssignment: 'checked' }),
      ]
      const config: BaggageConfig = {
        hasCabinBaggage: true,
        cabinWeightLimitKg: 7.0,
        hasCheckedBaggage: true,
        checkedWeightLimitKg: 23.0,
      }

      const estimate = calculateLuggageWeight(items, config)
      expect(estimate.cabin.isLimitExceeded).toBe(false)
      expect(estimate.isExceedingCabinLimit).toBe(false)

      expect(estimate.checked.isLimitExceeded).toBe(true)
      expect(estimate.checked.exceededAmountKg).toBe(2.0)
      expect(estimate.checked.remainingCapacityKg).toBe(0)
      expect(estimate.isExceedingCheckedLimit).toBe(true)
    })

    it('handles disabled baggage configurations gracefully without silent reassignment', () => {
      // Item assigned to checked baggage, but checked baggage is disabled in trip config
      const items: PackingItem[] = [
        createMockItem({ name: 'Winter Coat', weightGrams: 2000, effectiveQuantity: 1, bagAssignment: 'checked' }),
      ]
      const config: BaggageConfig = {
        hasCabinBaggage: true,
        cabinWeightLimitKg: 7.0,
        hasCheckedBaggage: false,
        checkedWeightLimitKg: 23.0,
      }

      const estimate = calculateLuggageWeight(items, config)
      expect(estimate.checked.isConfigured).toBe(false)
      expect(estimate.checked.knownWeightKg).toBe(2.0)
      expect(estimate.checked.remainingCapacityKg).toBe(0)
      expect(estimate.checked.isLimitExceeded).toBe(false)
      expect(estimate.isExceedingCheckedLimit).toBe(false)
      // Confirm item was not silently moved to cabin or unassigned
      expect(estimate.cabin.knownWeightGrams).toBe(0)
      expect(estimate.unassigned.knownWeightGrams).toBe(0)
    })

    it('handles zero and invalid limits safely without NaN or division-by-zero errors', () => {
      const items: PackingItem[] = [
        createMockItem({ name: 'Camera', weightGrams: 500, effectiveQuantity: 1, bagAssignment: 'cabin' }),
      ]

      // Limit configured to 0
      const estimateZero = calculateLuggageWeight(items, {
        hasCabinBaggage: true,
        cabinWeightLimitKg: 0,
      })
      expect(estimateZero.cabin.limitKg).toBe(0)
      expect(estimateZero.cabin.isLimitExceeded).toBe(true)
      expect(estimateZero.cabin.percentageUsed).toBe(0) // Safe from division by zero
      expect(Number.isNaN(estimateZero.cabin.percentageUsed)).toBe(false)

      // Invalid negative limit
      // @ts-expect-error testing invalid negative input
      const estimateInvalid = calculateLuggageWeight(items, { cabinWeightLimitKg: -10 })
      expect(estimateInvalid.cabin.limitKg).toBe(0)
      expect(Number.isNaN(estimateInvalid.cabin.limitKg)).toBe(false)

      // Invalid NaN limit
      // @ts-expect-error testing invalid NaN input
      const estimateNaN = calculateLuggageWeight(items, { cabinWeightLimitKg: Number.NaN })
      expect(estimateNaN.cabin.limitKg).toBe(7.0) // Safe fallback to default
    })

    it('counts packing item records, not individual quantity units', () => {
      const items: PackingItem[] = [
        createMockItem({ name: 'Socks', weightGrams: 60, effectiveQuantity: 7, bagAssignment: 'cabin' }), // 420g, 1 item record
        createMockItem({ name: 'Shirts', weightGrams: 150, effectiveQuantity: 5, bagAssignment: 'cabin' }), // 750g, 1 item record
      ]

      const estimate = calculateLuggageWeight(items)
      expect(estimate.cabin.itemsWithKnownWeightCount).toBe(2) // 2 records, not 12 units
      expect(estimate.combined.totalItemsWithKnownWeightCount).toBe(2)
      expect(estimate.cabin.knownWeightGrams).toBe(1170)
    })
  })

  describe('formatWeightDisplay', () => {
    it('formats gram weights under 1000g as integer grams', () => {
      expect(formatWeightDisplay(450)).toBe('450 g')
      expect(formatWeightDisplay(80)).toBe('80 g')
    })

    it('formats weights 1000g and above as kilograms with one decimal', () => {
      expect(formatWeightDisplay(1500)).toBe('1.5 kg')
      expect(formatWeightDisplay(7000)).toBe('7.0 kg')
    })

    it('formats weights in pounds when requested', () => {
      // 1000g = 1 kg = 2.2 lbs
      expect(formatWeightDisplay(1000, 'lbs')).toBe('2.2 lbs')
    })

    it('handles undefined or invalid values cleanly', () => {
      expect(formatWeightDisplay(undefined)).toBe('Unknown')
      // @ts-expect-error testing invalid input
      expect(formatWeightDisplay(null)).toBe('Unknown')
      expect(formatWeightDisplay(Number.NaN)).toBe('Unknown')
    })
  })
})
