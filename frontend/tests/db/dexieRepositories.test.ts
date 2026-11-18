import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PackPilotDatabase } from '../../src/db/dexie/db'
import { DexieTripsRepository } from '../../src/db/dexie/tripsRepository'
import { DexieItemsRepository } from '../../src/db/dexie/itemsRepository'
import { DexieTemplatesRepository } from '../../src/db/dexie/templatesRepository'
import type { Trip, PackingItem, PackingTemplate } from '../../src/types'
import { DEFAULT_BAGGAGE_CONFIG } from '../../src/types'

describe('Dexie IndexedDB Repositories', () => {
  let db: PackPilotDatabase
  let tripsRepo: DexieTripsRepository
  let itemsRepo: DexieItemsRepository
  let templatesRepo: DexieTemplatesRepository

  beforeEach(() => {
    // Unique in-memory database name per test
    const dbName = `TestDB_${Date.now()}_${Math.random()}`
    db = new PackPilotDatabase(dbName)
    tripsRepo = new DexieTripsRepository(db)
    itemsRepo = new DexieItemsRepository(db)
    templatesRepo = new DexieTemplatesRepository(db)
  })

  afterEach(async () => {
    await db.delete()
  })

  function createSampleTrip(id = 'trip-1'): Trip {
    return {
      id,
      name: 'Swiss Alps Hiking',
      destination: 'Zermatt, Switzerland',
      startDate: '2026-08-01',
      endDate: '2026-08-07',
      durationDays: 7,
      totalTravellerCount: 2,
      transportModes: ['train'],
      activities: ['trekking'],
      climate: 'moderate',
      accommodationType: 'hotel',
      travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 0 },
      personalPreferences: [],
      baggageConfig: DEFAULT_BAGGAGE_CONFIG,
      dismissedItems: [],
      engineVersion: '1.0.0',
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    }
  }

  function createSampleItem(id = 'item-1', tripId = 'trip-1', slug = 'wear-socks'): PackingItem {
    return {
      id,
      tripId,
      name: 'Merino Wool Socks',
      itemSlug: slug,
      category: 'clothing',
      priority: 'recommended',
      quantityStrategy: 'per_person_per_day',
      generatedQuantity: 5,
      effectiveQuantity: 5,
      packedQuantity: 0,
      isPacked: false,
      weightGrams: 60,
      isShared: false,
      isCustom: false,
      reasons: ['Hiking comfort'],
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    }
  }

  describe('DexieTripsRepository', () => {
    it('saves a trip with items atomically and retrieves it', () => {
      return tripsRepo
        .saveTripWithItems(createSampleTrip('trip-1'), [
          createSampleItem('item-1', 'trip-1'),
          createSampleItem('item-2', 'trip-1', 'wear-tshirt'),
        ])
        .then(async () => {
          const trip = await tripsRepo.getTripById('trip-1')
          expect(trip).toBeDefined()
          expect(trip?.name).toBe('Swiss Alps Hiking')

          const items = await itemsRepo.getItemsForTrip('trip-1')
          expect(items).toHaveLength(2)
        })
    })

    it('updates an existing trip', async () => {
      await tripsRepo.saveTripWithItems(createSampleTrip('trip-1'), [])
      await tripsRepo.updateTrip('trip-1', { name: 'Updated Alps Trek' })

      const trip = await tripsRepo.getTripById('trip-1')
      expect(trip?.name).toBe('Updated Alps Trek')
    })

    it('cascades deletion to child items preventing orphaned records', async () => {
      await tripsRepo.saveTripWithItems(createSampleTrip('trip-1'), [
        createSampleItem('item-1', 'trip-1'),
        createSampleItem('item-2', 'trip-1', 'wear-tshirt'),
      ])

      // Verify items exist before delete
      let items = await itemsRepo.getItemsForTrip('trip-1')
      expect(items).toHaveLength(2)

      // Delete trip
      await tripsRepo.deleteTrip('trip-1')

      // Verify trip is deleted
      const trip = await tripsRepo.getTripById('trip-1')
      expect(trip).toBeNull()

      // Verify NO orphaned items remain in the database
      items = await itemsRepo.getItemsForTrip('trip-1')
      expect(items).toHaveLength(0)

      const allItemsInDb = await db.items.toArray()
      expect(allItemsInDb).toHaveLength(0)
    })

    it('duplicates a trip and all its child items with new IDs', async () => {
      await tripsRepo.saveTripWithItems(createSampleTrip('trip-1'), [
        createSampleItem('item-1', 'trip-1'),
      ])

      const duplicated = await tripsRepo.duplicateTrip('trip-1', 'trip-2', 'Cloned Alps Trip')
      expect(duplicated.id).toBe('trip-2')
      expect(duplicated.name).toBe('Cloned Alps Trip')

      const clonedItems = await itemsRepo.getItemsForTrip('trip-2')
      expect(clonedItems).toHaveLength(1)
      expect(clonedItems[0].tripId).toBe('trip-2')
      expect(clonedItems[0].id).not.toBe('item-1') // Has a unique new ID
    })

    it('duplicates a trip with dismissed items, ensuring snapshots are independent and restorable without mutating original', async () => {
      const trip = createSampleTrip('trip-1')
      const originalItem = createSampleItem('item-1', 'trip-1', 'doc-passport')
      await tripsRepo.saveTripWithItems(trip, [originalItem])

      // Dismiss the item on trip-1
      const dismissedRecord = await itemsRepo.dismissItem('trip-1', 'item-1')
      expect(dismissedRecord.itemSlug).toBe('doc-passport')

      // Verify trip-1 has 1 dismissed record and 0 active items
      const trip1AfterDismiss = await tripsRepo.getTripById('trip-1')
      expect(trip1AfterDismiss?.dismissedItems).toHaveLength(1)
      expect(await itemsRepo.getItemsForTrip('trip-1')).toHaveLength(0)

      // Duplicate trip-1 into trip-2
      const duplicated = await tripsRepo.duplicateTrip('trip-1', 'trip-2', 'Swiss Alps Copy')
      expect(duplicated.id).toBe('trip-2')
      expect(duplicated.dismissedItems).toHaveLength(1)

      const clonedRecord = duplicated.dismissedItems[0]
      expect(clonedRecord.itemSlug).toBe('doc-passport')
      expect(clonedRecord.originalItemSnapshot.tripId).toBe('trip-2')
      expect(clonedRecord.originalItemSnapshot.id).not.toBe('item-1')

      // Restore the dismissed item in duplicated trip (trip-2)
      const restored = await itemsRepo.restoreDismissedItem('trip-2', 'doc-passport')
      expect(restored.tripId).toBe('trip-2')
      expect(restored.itemSlug).toBe('doc-passport')

      // Check trip-2 items and dismissed records
      const trip2Items = await itemsRepo.getItemsForTrip('trip-2')
      expect(trip2Items).toHaveLength(1)
      expect(trip2Items[0].tripId).toBe('trip-2')
      const trip2AfterRestore = await tripsRepo.getTripById('trip-2')
      expect(trip2AfterRestore?.dismissedItems).toHaveLength(0)

      // Check original trip-1: must remain completely unchanged!
      const trip1Items = await itemsRepo.getItemsForTrip('trip-1')
      expect(trip1Items).toHaveLength(0)
      const trip1Final = await tripsRepo.getTripById('trip-1')
      expect(trip1Final?.dismissedItems).toHaveLength(1)
      expect(trip1Final?.dismissedItems[0].originalItemSnapshot.tripId).toBe('trip-1')
    })
  })

  describe('DexieItemsRepository', () => {
    it('updates packedQuantity with automatic clamping and isPacked transition', async () => {
      await itemsRepo.saveItem(createSampleItem('item-1', 'trip-1'))

      // Partially pack 3 of 5
      await itemsRepo.updatePackedQuantity('item-1', 3)
      let item = await itemsRepo.getItemById('item-1')
      expect(item?.packedQuantity).toBe(3)
      expect(item?.isPacked).toBe(false)

      // Fully pack 5 of 5
      await itemsRepo.updatePackedQuantity('item-1', 5)
      item = await itemsRepo.getItemById('item-1')
      expect(item?.packedQuantity).toBe(5)
      expect(item?.isPacked).toBe(true)

      // Clamps to effectiveQuantity if overpacked
      await itemsRepo.updatePackedQuantity('item-1', 10)
      item = await itemsRepo.getItemById('item-1')
      expect(item?.packedQuantity).toBe(5)
      expect(item?.isPacked).toBe(true)
    })

    it('updates user quantity and clamps packedQuantity when required quantity drops', async () => {
      const item = createSampleItem('item-1', 'trip-1')
      item.effectiveQuantity = 8
      item.packedQuantity = 6
      item.isPacked = false
      await itemsRepo.saveItem(item)

      // User reduces required quantity to 4
      await itemsRepo.updateItemQuantity('item-1', 4)

      const updated = await itemsRepo.getItemById('item-1')
      expect(updated?.userAdjustedQuantity).toBe(4)
      expect(updated?.effectiveQuantity).toBe(4)
      expect(updated?.packedQuantity).toBe(4) // Clamped from 6 to 4
      expect(updated?.isPacked).toBe(true)
    })

    it('adds custom user items and marks them isCustom: true', async () => {
      const customItem: PackingItem = {
        ...createSampleItem('custom-1', 'trip-1', 'custom-sketchbook'),
        name: 'Travel Watercolor Sketchbook',
        isCustom: true,
      }

      await itemsRepo.addCustomItem(customItem)
      const retrieved = await itemsRepo.getItemById('custom-1')
      expect(retrieved?.isCustom).toBe(true)
      expect(retrieved?.name).toBe('Travel Watercolor Sketchbook')
    })

    it('dismisses an item by removing from items and appending snapshot to trip.dismissedItems', async () => {
      await tripsRepo.saveTripWithItems(createSampleTrip('trip-1'), [
        createSampleItem('item-1', 'trip-1', 'doc-passport'),
      ])

      const dismissedRecord = await itemsRepo.dismissItem('trip-1', 'item-1')
      expect(dismissedRecord.itemSlug).toBe('doc-passport')
      expect(dismissedRecord.originalItemSnapshot.id).toBe('item-1')

      // Removed from items table
      const itemInTable = await itemsRepo.getItemById('item-1')
      expect(itemInTable).toBeNull()

      // Stored in trip.dismissedItems
      const trip = await tripsRepo.getTripById('trip-1')
      expect(trip?.dismissedItems).toHaveLength(1)
      expect(trip?.dismissedItems[0].itemSlug).toBe('doc-passport')
    })

    it('restores a dismissed item losslessly back to items table', async () => {
      await tripsRepo.saveTripWithItems(createSampleTrip('trip-1'), [
        createSampleItem('item-1', 'trip-1', 'doc-passport'),
      ])

      // Dismiss item
      await itemsRepo.dismissItem('trip-1', 'item-1')

      // Restore item
      const restored = await itemsRepo.restoreDismissedItem('trip-1', 'doc-passport')
      expect(restored.id).toBe('item-1')
      expect(restored.itemSlug).toBe('doc-passport')

      // Back in items table
      const itemInTable = await itemsRepo.getItemById('item-1')
      expect(itemInTable).toBeDefined()

      // Removed from trip.dismissedItems
      const trip = await tripsRepo.getTripById('trip-1')
      expect(trip?.dismissedItems).toHaveLength(0)
    })

    it('reconciles trip items replacing active checklist items cleanly', async () => {
      await itemsRepo.saveItems([
        createSampleItem('item-1', 'trip-1', 'wear-socks'),
        createSampleItem('item-2', 'trip-1', 'wear-tshirt'),
      ])

      const reconciled = [
        createSampleItem('item-1', 'trip-1', 'wear-socks'),
        createSampleItem('item-3', 'trip-1', 'wear-jacket'),
      ]

      await itemsRepo.reconcileTripItems('trip-1', reconciled)

      const items = await itemsRepo.getItemsForTrip('trip-1')
      expect(items).toHaveLength(2)
      const slugs = items.map((i) => i.itemSlug)
      expect(slugs).toContain('wear-socks')
      expect(slugs).toContain('wear-jacket')
      expect(slugs).not.toContain('wear-tshirt')
    })
  })

  describe('DexieTemplatesRepository', () => {
    it('saves, retrieves, and deletes packing templates', async () => {
      const template: PackingTemplate = {
        id: 'template-weekend',
        name: 'Weekend Getaway',
        description: 'Light 2-day template',
        isSystem: true,
        items: [],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      }

      await templatesRepo.saveTemplate(template)
      let retrieved = await templatesRepo.getTemplateById('template-weekend')
      expect(retrieved?.name).toBe('Weekend Getaway')

      const all = await templatesRepo.getAllTemplates()
      expect(all).toHaveLength(1)

      await templatesRepo.deleteTemplate('template-weekend')
      retrieved = await templatesRepo.getTemplateById('template-weekend')
      expect(retrieved).toBeNull()
    })
  })
})
