import { describe, it, expect } from 'vitest'
import { getReferenceWeight, REFERENCE_WEIGHTS } from '../../src/engine/referenceWeights'
import { calculateLuggageWeight } from '../../src/utils/weight'
import type { PackingItem } from '../../src/types'

describe('Reference Weights Catalog (src/engine/referenceWeights.ts)', () => {
  it('returns verified weights for common items', () => {
    expect(getReferenceWeight('doc-passport')).toBe(45)
    expect(getReferenceWeight('doc-travel-id')).toBe(45)
    expect(getReferenceWeight('toil-cabin-liquids-bag')).toBe(35)
    expect(getReferenceWeight('wear-underwear')).toBe(60)
    expect(getReferenceWeight('gear-camp-tent')).toBe(2200)
    expect(getReferenceWeight('elec-work-laptop')).toBe(1800)
    expect(getReferenceWeight('toil-dental-kit')).toBe(110)
  })

  it('returns undefined for uncataloged or unknown item slugs without substituting fallback values', () => {
    expect(getReferenceWeight('custom-unweighted-item')).toBeUndefined()
    expect(getReferenceWeight('unknown-gear-widget')).toBeUndefined()
    expect(getReferenceWeight('')).toBeUndefined()
    // @ts-expect-error testing invalid input types
    expect(getReferenceWeight(null)).toBeUndefined()
    // @ts-expect-error testing invalid input types
    expect(getReferenceWeight(12345)).toBeUndefined()
  })

  it('ensures downstream weight calculations handle undefined weights safely without fabricating values', () => {
    const items: PackingItem[] = [
      {
        id: 'item-1',
        tripId: 'trip-1',
        name: 'Passport',
        category: 'documents',
        priority: 'critical',
        baseQuantity: 1,
        effectiveQuantity: 1,
        packedQuantity: 1,
        isPacked: true,
        weightGrams: getReferenceWeight('doc-travel-id'), // 45g
        isShared: false,
        reasons: ['ID'],
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
      },
      {
        id: 'item-2',
        tripId: 'trip-1',
        name: 'Custom Handmade Souvenir',
        category: 'miscellaneous',
        priority: 'optional',
        baseQuantity: 1,
        effectiveQuantity: 1,
        packedQuantity: 0,
        isPacked: false,
        weightGrams: getReferenceWeight('custom-handmade-souvenir'), // undefined
        isShared: false,
        reasons: ['Souvenir'],
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
      },
    ]

    const estimate = calculateLuggageWeight(items)
    // Only the known item (45g) is summed; unknown item is NOT assigned 200g
    expect(estimate.totalKnownWeightGrams).toBe(45)
    expect(estimate.itemsWithKnownWeightCount).toBe(1)
    expect(estimate.itemsWithUnknownWeightCount).toBe(1)
    expect(estimate.hasUnknownWeights).toBe(true)
  })

  it('verifies that all cataloged weights are non-negative numbers', () => {
    for (const [slug, weight] of Object.entries(REFERENCE_WEIGHTS)) {
      expect(typeof weight).toBe('number')
      expect(weight).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(weight)).toBe(true)
      expect(slug.length).toBeGreaterThan(0)
    }
  })
})
