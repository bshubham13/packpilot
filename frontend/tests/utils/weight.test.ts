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
    })

    it('sums known weights across multiple items and converts to kg and lbs', () => {
      const items: PackingItem[] = [
        createMockItem({ name: 'Jeans', weightGrams: 600, effectiveQuantity: 2 }), // 1200g
        createMockItem({ name: 'T-Shirt', weightGrams: 150, effectiveQuantity: 4 }), // 600g
        createMockItem({ name: 'Rain Jacket', weightGrams: 450, effectiveQuantity: 1 }), // 450g
      ] // Total = 2250g = 2.3 kg (rounded to 1 decimal) -> 2.3 * 2.20462 = 5.1 lbs

      const estimate = calculateLuggageWeight(items, { hasCabinBaggage: true, cabinWeightLimitKg: 7.0 })
      expect(estimate.totalKnownWeightGrams).toBe(2250)
      expect(estimate.totalKnownWeightKg).toBe(2.3)
      expect(estimate.totalKnownWeightLbs).toBe(5.1)
      expect(estimate.itemsWithKnownWeightCount).toBe(3)
      expect(estimate.itemsWithUnknownWeightCount).toBe(0)
      expect(estimate.hasUnknownWeights).toBe(false)
      expect(estimate.isExceedingCabinLimit).toBe(false)
    })

    it('tracks unknown weights separately without treating them as zero', () => {
      const items: PackingItem[] = [
        createMockItem({ name: 'Laptop', weightGrams: 1800, effectiveQuantity: 1 }), // 1800g
        createMockItem({ name: 'Custom Souvenir', weightGrams: undefined, effectiveQuantity: 2 }), // Unknown
        createMockItem({ name: 'Handmade Scarf', weightGrams: undefined, effectiveQuantity: 1 }), // Unknown
      ]

      const estimate = calculateLuggageWeight(items)
      expect(estimate.totalKnownWeightGrams).toBe(1800)
      expect(estimate.totalKnownWeightKg).toBe(1.8)
      expect(estimate.itemsWithKnownWeightCount).toBe(1)
      expect(estimate.itemsWithUnknownWeightCount).toBe(2)
      expect(estimate.hasUnknownWeights).toBe(true)
    })

    it('correctly detects when luggage exceeds cabin baggage limit', () => {
      // 8.0 kg total vs 7.0 kg limit
      const items: PackingItem[] = [
        createMockItem({ name: 'Heavy Tech Gear', weightGrams: 4000, effectiveQuantity: 2 }), // 8000g = 8.0 kg
      ]
      const config: BaggageConfig = {
        hasCabinBaggage: true,
        cabinWeightLimitKg: 7.0,
        hasCheckedBaggage: false,
        checkedWeightLimitKg: 23.0,
      }

      const estimate = calculateLuggageWeight(items, config)
      expect(estimate.totalKnownWeightKg).toBe(8.0)
      expect(estimate.isExceedingCabinLimit).toBe(true)
      expect(estimate.isExceedingCheckedLimit).toBe(false)
    })

    it('correctly evaluates dual baggage limits when checked baggage is enabled', () => {
      // 12.0 kg total: exceeds 7.0 kg cabin limit, but within 23.0 kg checked limit and 30.0 kg combined
      const items: PackingItem[] = [
        createMockItem({ name: 'Travel Wardrobe', weightGrams: 3000, effectiveQuantity: 4 }), // 12000g = 12.0 kg
      ]
      const config: BaggageConfig = {
        hasCabinBaggage: true,
        cabinWeightLimitKg: 7.0,
        hasCheckedBaggage: true,
        checkedWeightLimitKg: 23.0,
      }

      const estimate = calculateLuggageWeight(items, config)
      expect(estimate.totalKnownWeightKg).toBe(12.0)
      expect(estimate.isExceedingCabinLimit).toBe(true)
      expect(estimate.isExceedingCheckedLimit).toBe(false)
      expect(estimate.isExceedingCombinedLimit).toBe(false)
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
