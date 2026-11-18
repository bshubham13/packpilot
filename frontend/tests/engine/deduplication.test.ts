import { describe, it, expect } from 'vitest'
import {
  deduplicateCandidates,
  comparePriority,
  PRIORITY_RANK,
} from '../../src/engine/deduplication'
import type { RecommendationCandidate } from '../../src/types'

describe('Candidate Deduplication Engine (src/engine/deduplication.ts)', () => {
  it('returns empty array when given empty candidate list', () => {
    expect(deduplicateCandidates([])).toEqual([])
  })

  it('promotes priority when identical itemSlug is recommended with different priorities', () => {
    const candidates: RecommendationCandidate[] = [
      {
        itemSlug: 'toil-sunscreen-spf50',
        name: 'Sunscreen SPF 50',
        category: 'toiletries',
        priority: 'optional',
        quantityStrategy: 'shared_capacity',
        quantityParams: { capacityPerUnit: 3, baseUnitsPerDay: 10 },
        weightGrams: 150,
        isShared: true,
        reasons: ['Sun protection for warm climate'],
      },
      {
        itemSlug: 'toil-sunscreen-spf50',
        name: 'High-Protection Sunscreen SPF 50',
        category: 'toiletries',
        priority: 'critical', // Promoted to critical!
        quantityStrategy: 'shared_capacity',
        quantityParams: { capacityPerUnit: 3, baseUnitsPerDay: 7 },
        weightGrams: 150,
        isShared: true,
        reasons: ['UVA/UVB sun protection during beach outings'],
      },
      {
        itemSlug: 'toil-sunscreen-spf50',
        name: 'Sunscreen SPF 50',
        category: 'toiletries',
        priority: 'recommended',
        quantityStrategy: 'shared_capacity',
        quantityParams: { capacityPerUnit: 3, baseUnitsPerDay: 10 },
        weightGrams: 150,
        isShared: true,
        reasons: ['High altitude UV protection'],
      },
    ]

    const deduplicated = deduplicateCandidates(candidates)
    expect(deduplicated).toHaveLength(1)

    const result = deduplicated[0]
    expect(result.itemSlug).toBe('toil-sunscreen-spf50')
    expect(result.priority).toBe('critical')
    expect(result.name).toBe('High-Protection Sunscreen SPF 50')
  })

  it('unions and deduplicates recommendation reasons preserving unique rationale', () => {
    const candidates: RecommendationCandidate[] = [
      {
        itemSlug: 'gear-travel-umbrella',
        name: 'Compact Travel Umbrella',
        category: 'gear',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        isShared: false,
        reasons: ['Rain protection for rainy destination', 'Compact wind-resistant shelter'],
      },
      {
        itemSlug: 'gear-travel-umbrella',
        name: 'Compact Travel Umbrella',
        category: 'gear',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        isShared: false,
        reasons: ['Rain protection for rainy destination', 'Emergency sun shade'],
      },
    ]

    const deduplicated = deduplicateCandidates(candidates)
    expect(deduplicated).toHaveLength(1)
    expect(deduplicated[0].reasons).toEqual([
      'Rain protection for rainy destination',
      'Compact wind-resistant shelter',
      'Emergency sun shade',
    ])
  })

  it('merges quantity strategy parameters conservatively', () => {
    const candidates: RecommendationCandidate[] = [
      {
        itemSlug: 'fam-infant-bottles',
        name: 'Infant Feeding Bottles',
        category: 'gear',
        priority: 'critical',
        quantityStrategy: 'per_person',
        quantityParams: { unitsPerPerson: 1, minQuantity: 1 },
        isShared: false,
        reasons: ['Feeding supply'],
      },
      {
        itemSlug: 'fam-infant-bottles',
        name: 'Infant Feeding Bottles',
        category: 'gear',
        priority: 'critical',
        quantityStrategy: 'per_person',
        quantityParams: { unitsPerPerson: 2, minQuantity: 2 },
        isShared: false,
        reasons: ['Sterile transit hydration'],
      },
    ]

    const deduplicated = deduplicateCandidates(candidates)
    expect(deduplicated).toHaveLength(1)
    expect(deduplicated[0].quantityParams?.unitsPerPerson).toBe(2)
    expect(deduplicated[0].quantityParams?.minQuantity).toBe(2)
  })

  it('resolves conflicting quantity strategies based on priority and strategy specificity hierarchy', () => {
    const candidates: RecommendationCandidate[] = [
      {
        itemSlug: 'misc-emergency-blanket',
        name: 'Emergency Space Blanket',
        category: 'gear',
        priority: 'optional',
        quantityStrategy: 'fixed',
        quantityParams: { minQuantity: 1 },
        isShared: true,
        reasons: ['Car emergency safety'],
      },
      {
        itemSlug: 'misc-emergency-blanket',
        name: 'Thermal Emergency Blanket',
        category: 'gear',
        priority: 'critical',
        quantityStrategy: 'per_person',
        quantityParams: { unitsPerPerson: 1 },
        isShared: false,
        reasons: ['Sub-zero high-altitude survival gear'],
      },
    ]

    const deduplicated = deduplicateCandidates(candidates)
    expect(deduplicated).toHaveLength(1)
    // Critical candidate dictates strategy
    expect(deduplicated[0].priority).toBe('critical')
    expect(deduplicated[0].quantityStrategy).toBe('per_person')
  })

  it('retains metadata such as weightGrams, isShared, and specific targetAgeGroup', () => {
    const candidates: RecommendationCandidate[] = [
      {
        itemSlug: 'health-first-aid-kit',
        name: 'Compact First Aid Kit',
        category: 'health',
        priority: 'recommended',
        quantityStrategy: 'shared_capacity',
        weightGrams: 320,
        isShared: true,
        targetAgeGroup: 'all',
        reasons: ['General injury response'],
      },
      {
        itemSlug: 'health-first-aid-kit',
        name: 'Adventure First Aid Kit',
        category: 'health',
        priority: 'critical',
        quantityStrategy: 'shared_capacity',
        weightGrams: 320,
        isShared: false,
        targetAgeGroup: 'seniors',
        reasons: ['Senior medical contingency'],
      },
    ]

    const deduplicated = deduplicateCandidates(candidates)
    expect(deduplicated).toHaveLength(1)
    expect(deduplicated[0].isShared).toBe(true) // If either is shared, it is shared
    expect(deduplicated[0].weightGrams).toBe(320)
    expect(deduplicated[0].targetAgeGroup).toBe('seniors') // Specific age group preserved
  })

  it('sorts deduplicated candidates deterministically (critical -> recommended -> optional, then category, then slug)', () => {
    const candidates: RecommendationCandidate[] = [
      {
        itemSlug: 'wear-swimwear',
        name: 'Swimwear',
        category: 'clothing',
        priority: 'optional',
        quantityStrategy: 'per_person',
        isShared: false,
        reasons: ['Beach'],
      },
      {
        itemSlug: 'doc-passport',
        name: 'Passport',
        category: 'documents',
        priority: 'critical',
        quantityStrategy: 'per_person',
        isShared: false,
        reasons: ['Travel'],
      },
      {
        itemSlug: 'toil-sunscreen-spf50',
        name: 'Sunscreen',
        category: 'toiletries',
        priority: 'recommended',
        quantityStrategy: 'shared_capacity',
        isShared: true,
        reasons: ['Sun'],
      },
    ]

    const deduplicated = deduplicateCandidates(candidates)
    expect(deduplicated[0].itemSlug).toBe('doc-passport') // critical first
    expect(deduplicated[1].itemSlug).toBe('toil-sunscreen-spf50') // recommended second
    expect(deduplicated[2].itemSlug).toBe('wear-swimwear') // optional third
  })

  it('comparePriority correctly compares priority rankings', () => {
    expect(comparePriority('critical', 'optional')).toBe('critical')
    expect(comparePriority('recommended', 'critical')).toBe('critical')
    expect(comparePriority('optional', 'recommended')).toBe('recommended')
    expect(comparePriority('recommended', 'recommended')).toBe('recommended')
    expect(PRIORITY_RANK.critical).toBeGreaterThan(PRIORITY_RANK.recommended)
    expect(PRIORITY_RANK.recommended).toBeGreaterThan(PRIORITY_RANK.optional)
  })
})
