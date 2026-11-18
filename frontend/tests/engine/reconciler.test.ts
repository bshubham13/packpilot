import { describe, it, expect } from 'vitest'
import {
  mergeChecklists,
  dismissItem,
  restoreDismissedItem,
} from '../../src/engine/reconciler'
import type { PackingItem, DismissedItemRecord } from '../../src/types'

function createMockItem(overrides: Partial<PackingItem> = {}): PackingItem {
  return {
    id: 'item-1',
    tripId: 'trip-1',
    name: 'Sample Item',
    itemSlug: 'wear-tshirt',
    category: 'clothing',
    priority: 'recommended',
    quantityStrategy: 'per_person_per_day',
    generatedQuantity: 5,
    userAdjustedQuantity: undefined,
    effectiveQuantity: 5,
    packedQuantity: 0,
    isPacked: false,
    weightGrams: 150,
    isShared: false,
    isCustom: false,
    reasons: ['Base clothing requirement'],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('Checklist Reconciliation Engine (src/engine/reconciler.ts)', () => {
  describe('mergeChecklists', () => {
    it('initializes new items with packedQuantity=0 and isPacked=false when existing checklist is empty', () => {
      const incoming = [
        createMockItem({ itemSlug: 'doc-passport', effectiveQuantity: 1, generatedQuantity: 1 }),
        createMockItem({ itemSlug: 'toil-dental-kit', effectiveQuantity: 1, generatedQuantity: 1 }),
      ]

      const merged = mergeChecklists([], incoming, [])
      expect(merged).toHaveLength(2)
      expect(merged[0].packedQuantity).toBe(0)
      expect(merged[0].isPacked).toBe(false)
      expect(merged[0].isOrphaned).toBe(false)
    })

    it('strictly preserves userAdjustedQuantity over newly generated quantities', () => {
      const existing = [
        createMockItem({
          itemSlug: 'wear-tshirt',
          generatedQuantity: 5,
          userAdjustedQuantity: 8, // User manually bumped to 8
          effectiveQuantity: 8,
          packedQuantity: 4,
          isPacked: false,
        }),
      ]

      // Incoming recommendation from a regenerated 10-day trip calculates 7 t-shirts
      const incoming = [
        createMockItem({
          itemSlug: 'wear-tshirt',
          generatedQuantity: 7,
          effectiveQuantity: 7,
        }),
      ]

      const merged = mergeChecklists(existing, incoming, [])
      expect(merged).toHaveLength(1)
      expect(merged[0].userAdjustedQuantity).toBe(8)
      expect(merged[0].effectiveQuantity).toBe(8) // User override preserved!
      expect(merged[0].generatedQuantity).toBe(7) // Engine generated tracked separately
      expect(merged[0].packedQuantity).toBe(4) // Packed state preserved
    })

    it('preserves packedQuantity when effectiveQuantity increases (e.g. longer trip)', () => {
      const existing = [
        createMockItem({
          itemSlug: 'wear-socks',
          generatedQuantity: 4,
          effectiveQuantity: 4,
          packedQuantity: 4,
          isPacked: true, // Fully packed for 4 items
        }),
      ]

      // Trip extended to 7 days -> requires 7 socks
      const incoming = [
        createMockItem({
          itemSlug: 'wear-socks',
          generatedQuantity: 7,
          effectiveQuantity: 7,
        }),
      ]

      const merged = mergeChecklists(existing, incoming, [])
      expect(merged).toHaveLength(1)
      expect(merged[0].effectiveQuantity).toBe(7)
      expect(merged[0].packedQuantity).toBe(4) // Retains 4 packed
      expect(merged[0].isPacked).toBe(false) // No longer fully packed (needs 3 more)
    })

    it('preserves packedQuantity when effectiveQuantity decreases above packed count', () => {
      const existing = [
        createMockItem({
          itemSlug: 'wear-pants',
          generatedQuantity: 6,
          effectiveQuantity: 6,
          packedQuantity: 2,
          isPacked: false,
        }),
      ]

      // Trip shortened -> requires 4 pants
      const incoming = [
        createMockItem({
          itemSlug: 'wear-pants',
          generatedQuantity: 4,
          effectiveQuantity: 4,
        }),
      ]

      const merged = mergeChecklists(existing, incoming, [])
      expect(merged).toHaveLength(1)
      expect(merged[0].effectiveQuantity).toBe(4)
      expect(merged[0].packedQuantity).toBe(2) // 2 still packed
      expect(merged[0].isPacked).toBe(false)
    })

    it('clamps packedQuantity cleanly when effectiveQuantity decreases below packed count', () => {
      const existing = [
        createMockItem({
          itemSlug: 'wear-underwear',
          generatedQuantity: 8,
          effectiveQuantity: 8,
          packedQuantity: 6, // 6 packed
          isPacked: false,
        }),
      ]

      // Trip shortened drastically -> requires only 3 pairs
      const incoming = [
        createMockItem({
          itemSlug: 'wear-underwear',
          generatedQuantity: 3,
          effectiveQuantity: 3,
        }),
      ]

      const merged = mergeChecklists(existing, incoming, [])
      expect(merged).toHaveLength(1)
      expect(merged[0].effectiveQuantity).toBe(3)
      expect(merged[0].packedQuantity).toBe(3) // Clamped to 3!
      expect(merged[0].isPacked).toBe(true) // Fully packed at new target
    })

    it('preserves custom items (isCustom: true) 100% untouched even when omitted from recommendations', () => {
      const customItem = createMockItem({
        id: 'custom-guitar',
        name: 'Acoustic Travel Guitar',
        itemSlug: 'custom-acoustic-guitar',
        category: 'miscellaneous',
        priority: 'optional',
        quantityStrategy: 'user_defined',
        generatedQuantity: 1,
        effectiveQuantity: 1,
        packedQuantity: 1,
        isPacked: true,
        isCustom: true,
        reasons: ['User personal hobby'],
      })

      const existing = [customItem]
      // Incoming does not contain the guitar
      const incoming = [
        createMockItem({ itemSlug: 'doc-passport', effectiveQuantity: 1, generatedQuantity: 1 }),
      ]

      const merged = mergeChecklists(existing, incoming, [])
      expect(merged).toHaveLength(2)
      const foundCustom = merged.find((i) => i.itemSlug === 'custom-acoustic-guitar')
      expect(foundCustom).toBeDefined()
      expect(foundCustom?.isCustom).toBe(true)
      expect(foundCustom?.packedQuantity).toBe(1)
      expect(foundCustom?.isPacked).toBe(true)
      expect(foundCustom?.isOrphaned).toBeFalsy() // Custom items are never marked orphaned
    })

    it('suppresses dismissed items permanently using dismissed snapshot records (no zombie resurrection)', () => {
      const dismissedPassport: DismissedItemRecord = {
        itemSlug: 'doc-passport',
        name: 'Valid Travel Identification',
        category: 'documents',
        priority: 'critical',
        reasons: ['Border control'],
        dismissedAt: '2026-07-01T00:00:00Z',
        originalItemSnapshot: createMockItem({ itemSlug: 'doc-passport' }),
      }

      const existing: PackingItem[] = []
      // Recommendation engine re-generates doc-passport because flight mode is selected
      const incoming = [
        createMockItem({ itemSlug: 'doc-passport', effectiveQuantity: 1, generatedQuantity: 1 }),
        createMockItem({ itemSlug: 'toil-dental-kit', effectiveQuantity: 1, generatedQuantity: 1 }),
      ]

      const merged = mergeChecklists(existing, incoming, [dismissedPassport])
      expect(merged).toHaveLength(1)
      expect(merged[0].itemSlug).toBe('toil-dental-kit')
      // doc-passport was suppressed!
      expect(merged.some((i) => i.itemSlug === 'doc-passport')).toBe(false)
    })

    it('retains removed-activity items in an advisory state rather than silently deleting user items', () => {
      // User had beach activity, which recommended swimwear
      const existing = [
        createMockItem({
          id: 'item-swimwear',
          itemSlug: 'wear-swimwear',
          name: 'Swimwear',
          category: 'clothing',
          priority: 'recommended',
          effectiveQuantity: 2,
          packedQuantity: 1, // User already packed 1 pair
          isPacked: false,
          isCustom: false,
          reasons: ['Beach activity'],
        }),
      ]

      // User edited trip and REMOVED beach activity: incoming no longer recommends swimwear
      const incoming = [
        createMockItem({ itemSlug: 'toil-dental-kit', effectiveQuantity: 1, generatedQuantity: 1 }),
      ]

      const merged = mergeChecklists(existing, incoming, [])
      expect(merged).toHaveLength(2)

      const swimwear = merged.find((i) => i.itemSlug === 'wear-swimwear')
      expect(swimwear).toBeDefined()
      expect(swimwear?.isOrphaned).toBe(true) // Marked orphaned with advisory!
      expect(swimwear?.advisory).toContain('no longer active')
      expect(swimwear?.packedQuantity).toBe(1) // Packed progress preserved!
    })

    it('clears orphaned advisory state if a removed activity is re-added in subsequent regeneration', () => {
      // Item was previously orphaned
      const existing = [
        createMockItem({
          id: 'item-swimwear',
          itemSlug: 'wear-swimwear',
          effectiveQuantity: 2,
          isOrphaned: true,
          advisory: 'Activity no longer active',
        }),
      ]

      // User re-adds Beach activity
      const incoming = [
        createMockItem({
          itemSlug: 'wear-swimwear',
          effectiveQuantity: 2,
          generatedQuantity: 2,
        }),
      ]

      const merged = mergeChecklists(existing, incoming, [])
      expect(merged).toHaveLength(1)
      expect(merged[0].isOrphaned).toBe(false)
      expect(merged[0].advisory).toBeUndefined()
    })

    it('is strictly idempotent: repeated merges with unchanged inputs return identical checklists', () => {
      const existing = [
        createMockItem({
          id: 'item-1',
          itemSlug: 'doc-passport',
          effectiveQuantity: 1,
          packedQuantity: 1,
          isPacked: true,
        }),
      ]
      const incoming = [
        createMockItem({
          itemSlug: 'doc-passport',
          effectiveQuantity: 1,
          generatedQuantity: 1,
        }),
      ]

      const run1 = mergeChecklists(existing, incoming, [])
      const run2 = mergeChecklists(run1, incoming, [])

      expect(run2).toEqual(run1)
    })
  })

  describe('dismissItem and restoreDismissedItem', () => {
    it('dismissItem moves item out of active checklist and captures full snapshot', () => {
      const active = [
        createMockItem({ id: 'item-1', itemSlug: 'doc-passport', priority: 'critical' }),
        createMockItem({ id: 'item-2', itemSlug: 'wear-tshirt' }),
      ]

      const { updatedChecklist, dismissedRecord } = dismissItem(active, 'doc-passport')
      expect(updatedChecklist).toHaveLength(1)
      expect(updatedChecklist[0].itemSlug).toBe('wear-tshirt')
      expect(dismissedRecord).toBeDefined()
      expect(dismissedRecord?.itemSlug).toBe('doc-passport')
      expect(dismissedRecord?.priority).toBe('critical')
      expect(dismissedRecord?.originalItemSnapshot.id).toBe('item-1')
    })

    it('restoreDismissedItem restores original snapshot losslessly to active checklist', () => {
      const snapshot = createMockItem({
        id: 'item-1',
        itemSlug: 'doc-passport',
        priority: 'critical',
        effectiveQuantity: 1,
        packedQuantity: 1,
      })

      const dismissedRecords: DismissedItemRecord[] = [
        {
          itemSlug: 'doc-passport',
          name: 'Passport',
          category: 'documents',
          priority: 'critical',
          reasons: ['Travel'],
          dismissedAt: '2026-07-01T00:00:00Z',
          originalItemSnapshot: snapshot,
        },
      ]

      const activeChecklist: PackingItem[] = [
        createMockItem({ id: 'item-2', itemSlug: 'wear-tshirt' }),
      ]

      const { updatedChecklist, remainingDismissed } = restoreDismissedItem(
        activeChecklist,
        dismissedRecords,
        'doc-passport'
      )

      expect(updatedChecklist).toHaveLength(2)
      const restored = updatedChecklist.find((i) => i.itemSlug === 'doc-passport')
      expect(restored).toBeDefined()
      expect(restored?.id).toBe('item-1')
      expect(restored?.packedQuantity).toBe(1)
      expect(remainingDismissed).toHaveLength(0)
    })
  })
})
