import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryStorageState } from '../../src/db/memory/memoryStorage'
import { MemoryTripsRepository } from '../../src/db/memory/memoryTripsRepository'
import { MemoryItemsRepository } from '../../src/db/memory/memoryItemsRepository'
import { MemoryTemplatesRepository } from '../../src/db/memory/memoryTemplatesRepository'
import type { Trip, PackingItem, PackingTemplate } from '../../src/types'
import { DEFAULT_BAGGAGE_CONFIG } from '../../src/types'

describe('In-Memory Fallback Repositories', () => {
  let state: MemoryStorageState
  let tripsRepo: MemoryTripsRepository
  let itemsRepo: MemoryItemsRepository
  let templatesRepo: MemoryTemplatesRepository

  beforeEach(() => {
    state = new MemoryStorageState()
    tripsRepo = new MemoryTripsRepository(state)
    itemsRepo = new MemoryItemsRepository(state)
    templatesRepo = new MemoryTemplatesRepository(state)
  })

  function createSampleTrip(id = 'trip-1'): Trip {
    return {
      id,
      name: 'Tokyo Metro Trip',
      destination: 'Tokyo, Japan',
      startDate: '2026-09-01',
      endDate: '2026-09-08',
      durationDays: 7,
      totalTravellerCount: 1,
      transportModes: ['flight', 'train'],
      activities: ['sightseeing'],
      climate: 'warm',
      accommodationType: 'hotel',
      travellers: { adults: 1, teens: 0, children: 0, infants: 0, seniors: 0 },
      personalPreferences: [],
      baggageConfig: DEFAULT_BAGGAGE_CONFIG,
      dismissedItems: [],
      engineVersion: '1.0.0',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    }
  }

  function createSampleItem(id = 'item-1', tripId = 'trip-1', slug = 'doc-passport'): PackingItem {
    return {
      id,
      tripId,
      name: 'Passport',
      itemSlug: slug,
      category: 'documents',
      priority: 'critical',
      quantityStrategy: 'per_person',
      generatedQuantity: 1,
      effectiveQuantity: 1,
      packedQuantity: 0,
      isPacked: false,
      weightGrams: 45,
      isShared: false,
      isCustom: false,
      reasons: ['Border identity'],
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    }
  }

  it('performs CRUD on in-memory trips repository identically to Dexie contract', async () => {
    const trip = createSampleTrip('trip-1')
    await tripsRepo.saveTripWithItems(trip, [createSampleItem('item-1', 'trip-1')])

    const retrieved = await tripsRepo.getTripById('trip-1')
    expect(retrieved?.name).toBe('Tokyo Metro Trip')

    await tripsRepo.updateTrip('trip-1', { name: 'Tokyo Culinary Tour' })
    const updated = await tripsRepo.getTripById('trip-1')
    expect(updated?.name).toBe('Tokyo Culinary Tour')

    const allTrips = await tripsRepo.getAllTrips()
    expect(allTrips).toHaveLength(1)
  })

  it('cascades deletion of trips to child items in memory without leaving orphaned records', async () => {
    await tripsRepo.saveTripWithItems(createSampleTrip('trip-1'), [
      createSampleItem('item-1', 'trip-1'),
      createSampleItem('item-2', 'trip-1', 'toil-dental-kit'),
    ])

    expect(await itemsRepo.getItemsForTrip('trip-1')).toHaveLength(2)

    await tripsRepo.deleteTrip('trip-1')
    expect(await tripsRepo.getTripById('trip-1')).toBeNull()
    expect(await itemsRepo.getItemsForTrip('trip-1')).toHaveLength(0)
    expect(state.items.size).toBe(0) // No orphaned items in memory map
  })

  it('duplicates trips and items cleanly in memory', async () => {
    await tripsRepo.saveTripWithItems(createSampleTrip('trip-1'), [
      createSampleItem('item-1', 'trip-1'),
    ])

    const duplicated = await tripsRepo.duplicateTrip('trip-1', 'trip-2', 'Tokyo Copy')
    expect(duplicated.id).toBe('trip-2')
    expect(duplicated.name).toBe('Tokyo Copy')

    const clonedItems = await itemsRepo.getItemsForTrip('trip-2')
    expect(clonedItems).toHaveLength(1)
    expect(clonedItems[0].tripId).toBe('trip-2')
    expect(clonedItems[0].id).not.toBe('item-1')
  })

  it('dismisses and restores items losslessly in memory', async () => {
    await tripsRepo.saveTripWithItems(createSampleTrip('trip-1'), [
      createSampleItem('item-1', 'trip-1', 'doc-passport'),
    ])

    // Dismiss
    const dismissed = await itemsRepo.dismissItem('trip-1', 'item-1')
    expect(dismissed.itemSlug).toBe('doc-passport')
    expect(await itemsRepo.getItemById('item-1')).toBeNull()

    const trip = await tripsRepo.getTripById('trip-1')
    expect(trip?.dismissedItems).toHaveLength(1)

    // Restore
    const restored = await itemsRepo.restoreDismissedItem('trip-1', 'doc-passport')
    expect(restored.id).toBe('item-1')
    expect(await itemsRepo.getItemById('item-1')).toBeDefined()

    const tripAfter = await tripsRepo.getTripById('trip-1')
    expect(tripAfter?.dismissedItems).toHaveLength(0)
  })

  it('duplicates trip with dismissed items, generating independent IDs and isolating state', async () => {
    const trip = createSampleTrip('trip-1')
    await tripsRepo.saveTripWithItems(trip, [createSampleItem('item-1', 'trip-1', 'doc-passport')])

    // Dismiss on trip-1
    await itemsRepo.dismissItem('trip-1', 'item-1')
    expect((await tripsRepo.getTripById('trip-1'))?.dismissedItems).toHaveLength(1)

    // Duplicate trip-1 to trip-2
    const duplicated = await tripsRepo.duplicateTrip('trip-1', 'trip-2', 'Tokyo Copy')
    expect(duplicated.id).toBe('trip-2')
    expect(duplicated.dismissedItems).toHaveLength(1)

    const clonedRecord = duplicated.dismissedItems[0]
    expect(clonedRecord.itemSlug).toBe('doc-passport')
    expect(clonedRecord.originalItemSnapshot.tripId).toBe('trip-2')
    expect(clonedRecord.originalItemSnapshot.id).not.toBe('item-1')

    // Restore on duplicated trip-2
    const restored = await itemsRepo.restoreDismissedItem('trip-2', 'doc-passport')
    expect(restored.tripId).toBe('trip-2')
    expect(await itemsRepo.getItemsForTrip('trip-2')).toHaveLength(1)
    expect((await tripsRepo.getTripById('trip-2'))?.dismissedItems).toHaveLength(0)

    // Original trip-1 remains unchanged
    expect(await itemsRepo.getItemsForTrip('trip-1')).toHaveLength(0)
    const trip1Final = await tripsRepo.getTripById('trip-1')
    expect(trip1Final?.dismissedItems).toHaveLength(1)
    expect(trip1Final?.dismissedItems[0].originalItemSnapshot.tripId).toBe('trip-1')
  })

  it('saves and deletes templates in memory', async () => {
    const template: PackingTemplate = {
      id: 'template-light',
      name: 'Ultra-light Travel',
      description: 'Under 5kg',
      isSystem: false,
      items: [],
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    }

    await templatesRepo.saveTemplate(template)
    expect(await templatesRepo.getAllTemplates()).toHaveLength(1)

    await templatesRepo.deleteTemplate('template-light')
    expect(await templatesRepo.getTemplateById('template-light')).toBeNull()
  })
})
