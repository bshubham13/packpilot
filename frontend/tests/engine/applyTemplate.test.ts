import { describe, it, expect } from 'vitest'
import { applyTemplateToChecklist } from '../../src/engine/applyTemplate'
import type {
  PackingTemplate,
  TemplateItemConfig,
  PackingItem,
  DismissedItemRecord,
} from '../../src/types'

function createMockPackingItem(overrides: Partial<PackingItem> = {}): PackingItem {
  return {
    id: 'existing-item-1',
    tripId: 'trip-100',
    name: 'Existing Swim Trunks',
    itemSlug: 'wear-swimwear',
    category: 'clothing',
    priority: 'recommended',
    quantityStrategy: 'fixed',
    generatedQuantity: 1,
    userAdjustedQuantity: undefined,
    effectiveQuantity: 1,
    packedQuantity: 0,
    isPacked: false,
    weightGrams: 200,
    isShared: false,
    isCustom: false,
    reasons: ['Warm weather clothing'],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function createMockTemplate(
  items: TemplateItemConfig[],
  overrides: Partial<PackingTemplate> = {}
): PackingTemplate {
  return {
    id: 'template-beach',
    name: 'Beach Getaway',
    description: 'Essentials for coastal trips',
    category: 'activity',
    isSystem: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    items,
    ...overrides,
  }
}

describe('applyTemplateToChecklist (src/engine/applyTemplate.ts)', () => {
  const FIXED_NOW = '2026-11-20T12:00:00.000Z'

  describe('Empty checklist baseline', () => {
    it('instantiates all template items when checklist is empty', () => {
      const template = createMockTemplate([
        {
          itemSlug: 'wear-swimwear',
          name: 'Swimwear',
          category: 'clothing',
          priority: 'critical',
          defaultQuantity: 2,
          quantityStrategy: 'fixed',
          weightGrams: 250,
          isShared: false,
        },
        {
          itemSlug: 'beach-towel',
          name: 'Microfiber Beach Towel',
          category: 'gear',
          priority: 'recommended',
          defaultQuantity: 1,
          quantityStrategy: 'fixed',
          weightGrams: 300,
          isShared: true,
        },
      ])

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-target',
        existingItems: [],
        now: FIXED_NOW,
      })

      expect(result.items).toHaveLength(2)
      expect(result.addedCount).toBe(2)
      expect(result.mergedCount).toBe(0)
      expect(result.skippedDismissedCount).toBe(0)

      const swim = result.items.find((i) => i.itemSlug === 'wear-swimwear')!
      expect(swim).toBeDefined()
      expect(swim.tripId).toBe('trip-target')
      expect(swim.priority).toBe('critical')
      expect(swim.effectiveQuantity).toBe(2)
      expect(swim.generatedQuantity).toBe(2)
      expect(swim.packedQuantity).toBe(0)
      expect(swim.isPacked).toBe(false)
      expect(swim.weightGrams).toBe(250)
      expect(swim.reasons).toContain('Template: Beach Getaway')
      expect(swim.createdAt).toBe(FIXED_NOW)
      expect(swim.updatedAt).toBe(FIXED_NOW)

      const towel = result.items.find((i) => i.itemSlug === 'beach-towel')!
      expect(towel).toBeDefined()
      expect(towel.isShared).toBe(true)
      expect(towel.id).not.toBe(swim.id)
    })

    it('generates unique item IDs for all newly instantiated items', () => {
      const template = createMockTemplate([
        { itemSlug: 'slug-1', name: 'Item 1', category: 'clothing', priority: 'optional', defaultQuantity: 1 },
        { itemSlug: 'slug-2', name: 'Item 2', category: 'gear', priority: 'optional', defaultQuantity: 1 },
        { itemSlug: 'slug-3', name: 'Item 3', category: 'documents', priority: 'optional', defaultQuantity: 1 },
      ])

      const result = applyTemplateToChecklist(template, { tripId: 'trip-unique' })
      const ids = result.items.map((i) => i.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(3)
    })
  })

  describe('Existing items reconciliation', () => {
    it('preserves existing items not in the template without modification', () => {
      const untouchedItem = createMockPackingItem({
        id: 'passport-1',
        itemSlug: 'doc-passport',
        name: 'Passport',
        category: 'documents',
        priority: 'critical',
        effectiveQuantity: 1,
      })

      const template = createMockTemplate([
        {
          itemSlug: 'beach-umbrella',
          name: 'Beach Umbrella',
          category: 'gear',
          priority: 'recommended',
          defaultQuantity: 1,
        },
      ])

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [untouchedItem],
      })

      expect(result.items).toHaveLength(2)
      expect(result.addedCount).toBe(1)
      expect(result.mergedCount).toBe(0)
      expect(result.items[0]).toBe(untouchedItem)
    })

    it('preserves existing list order when merging matching items', () => {
      const first = createMockPackingItem({ id: 'item-a', itemSlug: 'slug-a', name: 'A' })
      const second = createMockPackingItem({ id: 'item-b', itemSlug: 'slug-b', name: 'B' })
      const third = createMockPackingItem({ id: 'item-c', itemSlug: 'slug-c', name: 'C' })

      const template = createMockTemplate([
        { itemSlug: 'slug-b', name: 'Updated B', category: 'clothing', priority: 'recommended', defaultQuantity: 2 },
        { itemSlug: 'slug-new', name: 'New Item', category: 'gear', priority: 'optional', defaultQuantity: 1 },
      ])

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [first, second, third],
      })

      expect(result.items.map((i) => i.itemSlug)).toEqual(['slug-a', 'slug-b', 'slug-c', 'slug-new'])
      expect(result.mergedCount).toBe(1)
      expect(result.addedCount).toBe(1)
    })
  })

  describe('Quantity reconciliation logic', () => {
    it('raises automatically calculated quantity when template default is higher', () => {
      const existing = createMockPackingItem({
        itemSlug: 'beach-towel',
        generatedQuantity: 1,
        userAdjustedQuantity: undefined,
        effectiveQuantity: 1,
      })

      const template = createMockTemplate([
        {
          itemSlug: 'beach-towel',
          name: 'Beach Towel',
          category: 'gear',
          priority: 'recommended',
          defaultQuantity: 3,
        },
      ])

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [existing],
      })

      expect(result.items[0].effectiveQuantity).toBe(3)
      expect(result.items[0].generatedQuantity).toBe(3)
    })

    it('preserves existing calculated quantity when existing is higher than template default', () => {
      // e.g. multi-day trip already calculated 7 shirts, template default is 2
      const existing = createMockPackingItem({
        itemSlug: 'wear-shirt',
        generatedQuantity: 7,
        userAdjustedQuantity: undefined,
        effectiveQuantity: 7,
      })

      const template = createMockTemplate([
        {
          itemSlug: 'wear-shirt',
          name: 'Shirt',
          category: 'clothing',
          priority: 'recommended',
          defaultQuantity: 2,
        },
      ])

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [existing],
      })

      expect(result.items[0].effectiveQuantity).toBe(7)
      expect(result.items[0].generatedQuantity).toBe(7)
    })

    it('strictly preserves manual userAdjustedQuantity over template default quantity', () => {
      const existing = createMockPackingItem({
        itemSlug: 'wear-swimwear',
        generatedQuantity: 1,
        userAdjustedQuantity: 5, // user explicitly chose 5
        effectiveQuantity: 5,
      })

      const template = createMockTemplate([
        {
          itemSlug: 'wear-swimwear',
          name: 'Swimwear',
          category: 'clothing',
          priority: 'recommended',
          defaultQuantity: 2,
        },
      ])

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [existing],
      })

      expect(result.items[0].userAdjustedQuantity).toBe(5)
      expect(result.items[0].effectiveQuantity).toBe(5)
      expect(result.items[0].generatedQuantity).toBe(2)
    })
  })

  describe('Packed state preservation', () => {
    it('never resets packedQuantity or decreases it', () => {
      const existing = createMockPackingItem({
        itemSlug: 'wear-swimwear',
        packedQuantity: 2,
        effectiveQuantity: 2,
        isPacked: true,
      })

      const template = createMockTemplate([
        {
          itemSlug: 'wear-swimwear',
          name: 'Swimwear',
          category: 'clothing',
          priority: 'recommended',
          defaultQuantity: 4,
        },
      ])

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [existing],
      })

      const merged = result.items[0]
      expect(merged.packedQuantity).toBe(2) // Intact, not reset to 0
      expect(merged.effectiveQuantity).toBe(4) // Bumped to 4
      expect(merged.isPacked).toBe(false) // 2 < 4, so not fully packed anymore
    })

    it('keeps isPacked true if packedQuantity still covers new effectiveQuantity', () => {
      const existing = createMockPackingItem({
        itemSlug: 'wear-hat',
        generatedQuantity: 1,
        effectiveQuantity: 1,
        packedQuantity: 2,
        isPacked: true,
      })

      const template = createMockTemplate([
        {
          itemSlug: 'wear-hat',
          name: 'Sun Hat',
          category: 'clothing',
          priority: 'recommended',
          defaultQuantity: 2,
        },
      ])

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [existing],
      })

      const merged = result.items[0]
      expect(merged.packedQuantity).toBe(2)
      expect(merged.effectiveQuantity).toBe(2)
      expect(merged.isPacked).toBe(true)
    })

    it('clamps packedQuantity to effectiveQuantity when packedQuantity exceeds effectiveQuantity', () => {
      const existing = createMockPackingItem({
        itemSlug: 'beach-towel',
        generatedQuantity: 2,
        userAdjustedQuantity: 2,
        effectiveQuantity: 2,
        packedQuantity: 5, // irregular / out-of-bounds packed progress
        isPacked: true,
      })

      const template = createMockTemplate([
        {
          itemSlug: 'beach-towel',
          name: 'Beach Towel',
          category: 'gear',
          priority: 'recommended',
          defaultQuantity: 2,
        },
      ])

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [existing],
      })

      const merged = result.items[0]
      expect(merged.effectiveQuantity).toBe(2)
      expect(merged.packedQuantity).toBe(2) // defensively clamped to effectiveQuantity
      expect(merged.isPacked).toBe(true)
    })

    it('preserves valid partial packed progress when quantity is elevated', () => {
      const existing = createMockPackingItem({
        itemSlug: 'wear-swimwear',
        generatedQuantity: 2,
        effectiveQuantity: 2,
        packedQuantity: 1, // partially packed: 1 of 2
        isPacked: false,
      })

      const template = createMockTemplate([
        {
          itemSlug: 'wear-swimwear',
          name: 'Swimwear',
          category: 'clothing',
          priority: 'recommended',
          defaultQuantity: 4,
        },
      ])

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [existing],
      })

      const merged = result.items[0]
      expect(merged.packedQuantity).toBe(1) // preserved exactly
      expect(merged.effectiveQuantity).toBe(4) // elevated
      expect(merged.isPacked).toBe(false)
    })
  })

  describe('Priority promotion hierarchy', () => {
    it('promotes priority when template priority is higher (optional -> critical)', () => {
      const existing = createMockPackingItem({
        itemSlug: 'med-kit',
        priority: 'optional',
      })

      const template = createMockTemplate([
        {
          itemSlug: 'med-kit',
          name: 'First Aid Kit',
          category: 'health',
          priority: 'critical',
          defaultQuantity: 1,
        },
      ])

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [existing],
      })

      expect(result.items[0].priority).toBe('critical')
    })

    it('does not downgrade priority when existing priority is higher (critical > recommended)', () => {
      const existing = createMockPackingItem({
        itemSlug: 'med-kit',
        priority: 'critical',
      })

      const template = createMockTemplate([
        {
          itemSlug: 'med-kit',
          name: 'First Aid Kit',
          category: 'health',
          priority: 'recommended',
          defaultQuantity: 1,
        },
      ])

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [existing],
      })

      expect(result.items[0].priority).toBe('critical')
    })
  })

  describe('User customization preservation', () => {
    it('preserves custom name, category, notes, and bag assignments', () => {
      const existing = createMockPackingItem({
        itemSlug: 'wear-shoes',
        name: 'My Special Hiking Boots',
        category: 'gear',
        notes: 'Cleaned and waterproofed',
        bagAssignment: 'cabin',
      })

      const template = createMockTemplate([
        {
          itemSlug: 'wear-shoes',
          name: 'Walking Shoes',
          category: 'clothing',
          priority: 'recommended',
          defaultQuantity: 1,
        },
      ])

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [existing],
      })

      const item = result.items[0]
      expect(item.name).toBe('My Special Hiking Boots')
      expect(item.category).toBe('gear')
      expect(item.notes).toBe('Cleaned and waterproofed')
      expect(item.bagAssignment).toBe('cabin')
    })
  })

  describe('Orphan state clearance', () => {
    it('clears stale isOrphaned status and obsolete advisory text when matching template item', () => {
      const orphanedItem = createMockPackingItem({
        itemSlug: 'beach-towel',
        name: 'Beach Towel',
        isOrphaned: true,
        advisory: 'Activity or transport condition is no longer active in trip parameters. Retained for your review.',
      })

      const template = createMockTemplate([
        {
          itemSlug: 'beach-towel',
          name: 'Beach Towel',
          category: 'gear',
          priority: 'recommended',
          defaultQuantity: 2,
        },
      ])

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [orphanedItem],
      })

      const merged = result.items[0]
      expect(merged.isOrphaned).toBe(false)
      expect(merged.advisory).toBeUndefined()
    })

    it('preserves unrelated user customizations while clearing orphan status', () => {
      const orphanedItem = createMockPackingItem({
        itemSlug: 'beach-towel',
        name: 'Custom Monogrammed Towel',
        notes: 'Blue stripes, fast drying',
        bagAssignment: 'checked',
        isOrphaned: true,
        advisory: 'Activity or transport condition is no longer active.',
      })

      const template = createMockTemplate([
        {
          itemSlug: 'beach-towel',
          name: 'Beach Towel',
          category: 'gear',
          priority: 'recommended',
          defaultQuantity: 1,
        },
      ])

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [orphanedItem],
      })

      const merged = result.items[0]
      expect(merged.isOrphaned).toBe(false)
      expect(merged.advisory).toBeUndefined()
      expect(merged.name).toBe('Custom Monogrammed Towel')
      expect(merged.notes).toBe('Blue stripes, fast drying')
      expect(merged.bagAssignment).toBe('checked')
    })
  })

  describe('Dismissed items suppression', () => {
    it('skips template items matching dismissed item records and increments count', () => {
      const template = createMockTemplate([
        {
          itemSlug: 'beach-snorkle',
          name: 'Snorkel Gear',
          category: 'gear',
          priority: 'optional',
          defaultQuantity: 1,
        },
        {
          itemSlug: 'sunscreen',
          name: 'Sunscreen',
          category: 'health',
          priority: 'critical',
          defaultQuantity: 1,
        },
      ])

      const dismissedRecords: DismissedItemRecord[] = [
        {
          id: 'dismiss-1',
          tripId: 'trip-100',
          itemSlug: 'beach-snorkle',
          dismissedAt: '2026-07-02T00:00:00.000Z',
        },
      ]

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [],
        dismissedRecords,
      })

      expect(result.items).toHaveLength(1)
      expect(result.items[0].itemSlug).toBe('sunscreen')
      expect(result.skippedDismissedCount).toBe(1)
      expect(result.addedCount).toBe(1)
    })
  })

  describe('Custom items recreation', () => {
    it('re-instantiates custom items with isCustom: true and fresh unique UUIDs', () => {
      const template = createMockTemplate([
        {
          itemSlug: 'custom-yoga-mat-12345',
          name: 'Travel Yoga Mat',
          category: 'activity',
          priority: 'recommended',
          defaultQuantity: 1,
          weightGrams: 900,
        },
      ])

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [],
      })

      expect(result.items).toHaveLength(1)
      const customItem = result.items[0]
      expect(customItem.isCustom).toBe(true)
      expect(customItem.name).toBe('Travel Yoga Mat')
      expect(customItem.itemSlug).toBe('custom-yoga-mat-12345')
      expect(customItem.id).toBeDefined()
    })
  })

  describe('Internal template deduplication', () => {
    it('gracefully handles duplicate slugs within the template definition', () => {
      const template = createMockTemplate([
        {
          itemSlug: 'sun-lotion',
          name: 'Sunscreen SPF 30',
          category: 'health',
          priority: 'recommended',
          defaultQuantity: 1,
          reasons: ['Reason A'],
        },
        {
          itemSlug: 'sun-lotion',
          name: 'Sunscreen SPF 50',
          category: 'health',
          priority: 'critical',
          defaultQuantity: 2,
          reasons: ['Reason B'],
        },
      ])

      const result = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [],
      })

      expect(result.items).toHaveLength(1)
      expect(result.items[0].priority).toBe('critical')
      expect(result.items[0].effectiveQuantity).toBe(2)
      expect(result.items[0].reasons).toContain('Reason A')
      expect(result.items[0].reasons).toContain('Reason B')
      expect(result.addedCount).toBe(1)
    })
  })

  describe('Idempotency', () => {
    it('yields identical results when applied repeatedly to the same checklist', () => {
      const template = createMockTemplate([
        {
          itemSlug: 'beach-towel',
          name: 'Beach Towel',
          category: 'gear',
          priority: 'recommended',
          defaultQuantity: 2,
        },
      ])

      const firstRun = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: [],
        now: FIXED_NOW,
      })

      expect(firstRun.addedCount).toBe(1)
      expect(firstRun.mergedCount).toBe(0)

      const secondRun = applyTemplateToChecklist(template, {
        tripId: 'trip-100',
        existingItems: firstRun.items,
        now: FIXED_NOW,
      })

      expect(secondRun.addedCount).toBe(0)
      expect(secondRun.mergedCount).toBe(1)
      expect(secondRun.items).toHaveLength(1)
      expect(secondRun.items[0].itemSlug).toBe('beach-towel')
      expect(secondRun.items[0].effectiveQuantity).toBe(2)
      expect(secondRun.items[0].id).toBe(firstRun.items[0].id)
    })
  })

  describe('Edge cases and argument polymorphism', () => {
    it('returns a clone of existing items if template is null or empty', () => {
      const existing = [createMockPackingItem()]
      const emptyTemplate = createMockTemplate([])

      const result = applyTemplateToChecklist(emptyTemplate, {
        tripId: 'trip-100',
        existingItems: existing,
      })

      expect(result.items).toHaveLength(1)
      expect(result.addedCount).toBe(0)
      expect(result.mergedCount).toBe(0)
      expect(result.skippedDismissedCount).toBe(0)
    })

    it('supports positional arguments as an alternative to options object', () => {
      const template = createMockTemplate([
        {
          itemSlug: 'beach-towel',
          name: 'Beach Towel',
          category: 'gear',
          priority: 'recommended',
          defaultQuantity: 1,
        },
      ])

      const result = applyTemplateToChecklist(template, 'trip-positional', [])

      expect(result.items).toHaveLength(1)
      expect(result.items[0].tripId).toBe('trip-positional')
      expect(result.addedCount).toBe(1)
    })
  })
})
