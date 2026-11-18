import { describe, it, expect } from 'vitest'
import { calculateReadinessScore, PRIORITY_WEIGHTS } from '../../src/utils/scoring'
import type { PackingItem, DismissedItemRecord } from '../../src/types'

function createMockItem(overrides: Partial<PackingItem> = {}): PackingItem {
  return {
    id: 'item-1',
    tripId: 'trip-1',
    name: 'Test Item',
    itemSlug: 'test-item',
    category: 'clothing',
    quantityStrategy: 'per_person',
    generatedQuantity: 1,
    effectiveQuantity: 1,
    packedQuantity: 0,
    isPacked: false,
    priority: 'recommended',
    isShared: false,
    isCustom: false,
    reasons: ['Test reason'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function createMockDismissedItem(overrides: Partial<DismissedItemRecord> = {}): DismissedItemRecord {
  return {
    itemSlug: 'dismissed-item',
    name: 'Dismissed Essential',
    category: 'documents',
    priority: 'critical',
    reasons: ['Dismissed for test'],
    dismissedAt: new Date().toISOString(),
    originalItemSnapshot: createMockItem({ priority: 'critical', name: 'Dismissed Essential' }),
    ...overrides,
  }
}

describe('Readiness Scoring Utilities (src/utils/scoring.ts)', () => {
  it('correctly reports 0% for an empty checklist', () => {
    const score = calculateReadinessScore([])
    expect(score.percentage).toBe(0)
    expect(score.packedPoints).toBe(0)
    expect(score.totalPossiblePoints).toBe(0)
    expect(score.hasOutstandingCritical).toBe(false)
    expect(score.isFullyReady).toBe(false)
  })

  it('computes 0% when no items have been packed', () => {
    const items: PackingItem[] = [
      createMockItem({ priority: 'critical', effectiveQuantity: 1, packedQuantity: 0 }),
      createMockItem({ priority: 'recommended', effectiveQuantity: 2, packedQuantity: 0 }),
      createMockItem({ priority: 'optional', effectiveQuantity: 1, packedQuantity: 0 }),
    ]
    const score = calculateReadinessScore(items)
    expect(score.percentage).toBe(0)
    expect(score.totalPossiblePoints).toBe(PRIORITY_WEIGHTS.critical + PRIORITY_WEIGHTS.recommended + PRIORITY_WEIGHTS.optional) // 3 + 2 + 1 = 6
    expect(score.unpackedCriticalCount).toBe(1)
    expect(score.hasOutstandingCritical).toBe(true)
    expect(score.isFullyReady).toBe(false)
  })

  it('weights priorities correctly: Critical (3), Recommended (2), Optional (1)', () => {
    // Pack only the critical item (3 points out of 6 total = 50%)
    const items: PackingItem[] = [
      createMockItem({ priority: 'critical', effectiveQuantity: 1, packedQuantity: 1 }),
      createMockItem({ priority: 'recommended', effectiveQuantity: 1, packedQuantity: 0 }),
      createMockItem({ priority: 'optional', effectiveQuantity: 1, packedQuantity: 0 }),
    ]
    const score = calculateReadinessScore(items)
    expect(score.percentage).toBe(50)
    expect(score.packedPoints).toBe(3)
    expect(score.totalPossiblePoints).toBe(6)
    expect(score.unpackedCriticalCount).toBe(0)
    expect(score.hasOutstandingCritical).toBe(false)
    expect(score.isFullyReady).toBe(false)
  })

  it('handles partial packing proportionally', () => {
    // Critical item (weight 3): 2 of 4 packed = 50% of 3 points = 1.5 points
    // Recommended item (weight 2): 1 of 1 packed = 100% of 2 points = 2.0 points
    // Total possible points = 3 + 2 = 5 points
    // Total packed points = 1.5 + 2.0 = 3.5 points -> 3.5 / 5 = 70%
    const items: PackingItem[] = [
      createMockItem({ priority: 'critical', effectiveQuantity: 4, packedQuantity: 2 }),
      createMockItem({ priority: 'recommended', effectiveQuantity: 1, packedQuantity: 1 }),
    ]
    const score = calculateReadinessScore(items)
    expect(score.packedPoints).toBe(3.5)
    expect(score.totalPossiblePoints).toBe(5)
    expect(score.percentage).toBe(70)
    // Critical item is partially packed (2 < 4), so still counts as unpacked critical
    expect(score.unpackedCriticalCount).toBe(1)
    expect(score.hasOutstandingCritical).toBe(true)
    expect(score.isFullyReady).toBe(false)
  })

  it('achieves 100% readiness and isFullyReady when all active items are packed and no critical items are dismissed', () => {
    const items: PackingItem[] = [
      createMockItem({ priority: 'critical', effectiveQuantity: 1, packedQuantity: 1 }),
      createMockItem({ priority: 'recommended', effectiveQuantity: 2, packedQuantity: 2 }),
    ]
    const score = calculateReadinessScore(items, [])
    expect(score.percentage).toBe(100)
    expect(score.unpackedCriticalCount).toBe(0)
    expect(score.dismissedCriticalCount).toBe(0)
    expect(score.hasOutstandingCritical).toBe(false)
    expect(score.isFullyReady).toBe(true)
  })

  it('PREVENTS misleading 100% isFullyReady when a critical essential is dismissed', () => {
    // All active items in checklist are packed
    const items: PackingItem[] = [
      createMockItem({ priority: 'recommended', effectiveQuantity: 1, packedQuantity: 1 }),
    ]
    // But user dismissed Passport (critical)
    const dismissed: DismissedItemRecord[] = [
      createMockDismissedItem({ priority: 'critical', name: 'Passport' }),
    ]

    const score = calculateReadinessScore(items, dismissed)
    expect(score.percentage).toBe(100)
    expect(score.unpackedCriticalCount).toBe(0)
    expect(score.dismissedCriticalCount).toBe(1)
    expect(score.hasOutstandingCritical).toBe(true)
    // Critical safety invariant: isFullyReady MUST be false!
    expect(score.isFullyReady).toBe(false)
  })

  it('allows 100% isFullyReady when only optional items were dismissed', () => {
    const items: PackingItem[] = [
      createMockItem({ priority: 'critical', effectiveQuantity: 1, packedQuantity: 1 }),
    ]
    // User dismissed an optional book
    const dismissed: DismissedItemRecord[] = [
      createMockDismissedItem({ priority: 'optional', name: 'Paperback Novel' }),
    ]

    const score = calculateReadinessScore(items, dismissed)
    expect(score.percentage).toBe(100)
    expect(score.dismissedCriticalCount).toBe(0)
    expect(score.hasOutstandingCritical).toBe(false)
    expect(score.isFullyReady).toBe(true)
  })

  it('safely handles items with effectiveQuantity = 0 without dividing by zero', () => {
    const items: PackingItem[] = [
      createMockItem({ priority: 'recommended', effectiveQuantity: 0, packedQuantity: 0 }),
    ]
    const score = calculateReadinessScore(items)
    expect(score.percentage).toBe(0)
    expect(score.totalPossiblePoints).toBe(0)
  })
})
