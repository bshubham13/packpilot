import { describe, it, expect, beforeEach } from 'vitest'
import { useTemplateStore } from '../../src/stores/templateStore'
import { createStorageContext, setStorageContext, getStorageContext } from '../../src/db/factory'
import { getSharedMemoryState } from '../../src/db/memory/memoryStorage'
import { PREDEFINED_TEMPLATES } from '../../src/data/predefinedTemplates'
import type { Trip, PackingItem } from '../../src/types'
import { DEFAULT_BAGGAGE_CONFIG } from '../../src/types'

function createSampleTrip(id = 'trip-template-test', name = 'Alpine Summer'): Trip {
  return {
    id,
    name,
    destination: 'Chamonix, France',
    origin: 'Geneva, Switzerland',
    startDate: '2026-07-15',
    endDate: '2026-07-22',
    durationDays: 7,
    totalTravellerCount: 2,
    transportModes: ['train', 'car'],
    activities: ['trekking', 'adventure'],
    climate: 'mixed',
    accommodationType: 'hotel',
    travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 0 },
    personalPreferences: [],
    baggageConfig: DEFAULT_BAGGAGE_CONFIG,
    dismissedItems: [],
    engineVersion: '1.4.0',
    createdAt: '2026-07-01T08:00:00Z',
    updatedAt: '2026-07-01T08:00:00Z',
  }
}

function createSampleItems(tripId = 'trip-template-test'): PackingItem[] {
  return [
    {
      id: 'item-1',
      tripId,
      name: 'Trail Running Shoes',
      itemSlug: 'wear-trail-shoes',
      category: 'clothing',
      priority: 'critical',
      quantityStrategy: 'fixed',
      generatedQuantity: 1,
      effectiveQuantity: 1,
      packedQuantity: 1,
      isPacked: true,
      weightGrams: 700,
      isShared: false,
      isCustom: false,
      reasons: ['Trail hiking'],
      createdAt: '2026-07-01T08:00:00Z',
      updatedAt: '2026-07-01T08:00:00Z',
    },
    {
      id: 'item-2',
      tripId,
      name: 'Custom Trekking Map',
      itemSlug: 'custom-trekking-map',
      category: 'gear',
      priority: 'recommended',
      quantityStrategy: 'fixed',
      generatedQuantity: 1,
      effectiveQuantity: 2, // userAdjusted
      userAdjustedQuantity: 2,
      packedQuantity: 0,
      isPacked: false,
      weightGrams: 80,
      isShared: true,
      isCustom: true,
      reasons: ['User custom item'],
      createdAt: '2026-07-01T08:00:00Z',
      updatedAt: '2026-07-01T08:00:00Z',
    },
    {
      id: 'item-3-zero-qty',
      tripId,
      name: 'Unused Item',
      itemSlug: 'wear-unused',
      category: 'clothing',
      priority: 'optional',
      quantityStrategy: 'fixed',
      generatedQuantity: 0,
      effectiveQuantity: 0,
      packedQuantity: 0,
      isPacked: false,
      isShared: false,
      isCustom: false,
      reasons: [],
      createdAt: '2026-07-01T08:00:00Z',
      updatedAt: '2026-07-01T08:00:00Z',
    },
  ]
}

describe('Template Store (Milestone 9A: Slice 9A)', () => {
  beforeEach(async () => {
    // Clear shared memory state and create fresh memory storage context
    getSharedMemoryState().clear()
    const storage = await createStorageContext('memory')
    setStorageContext(storage)

    useTemplateStore.setState({
      templates: [],
      isLoading: false,
      isInitialized: false,
      error: null,
    })
  })

  // 1. First-time system template seeding
  it('seeds all 4 predefined system templates on initial load', async () => {
    const store = useTemplateStore.getState()
    const loaded = await store.loadTemplates()

    expect(loaded).toHaveLength(PREDEFINED_TEMPLATES.length)
    expect(useTemplateStore.getState().isInitialized).toBe(true)
    expect(useTemplateStore.getState().isLoading).toBe(false)
    expect(useTemplateStore.getState().error).toBeNull()

    // Verify all 4 predefined IDs are present
    const loadedIds = loaded.map((t) => t.id)
    expect(loadedIds).toContain('template-predefined-beach')
    expect(loadedIds).toContain('template-predefined-business')
    expect(loadedIds).toContain('template-predefined-trekking')
    expect(loadedIds).toContain('template-predefined-family')

    // Verify all are marked as system templates
    for (const tmpl of loaded) {
      expect(tmpl.isSystem).toBe(true)
      expect(tmpl.items.length).toBeGreaterThan(0)
    }

    // Verify persisted directly in storage repository
    const storage = getStorageContext()
    const persisted = await storage.templates.getAllTemplates()
    expect(persisted).toHaveLength(4)
  })

  // 2. Repeated initialization without overwriting data
  it('does not re-seed or overwrite templates on subsequent loadTemplates() calls', async () => {
    const store = useTemplateStore.getState()
    await store.loadTemplates()

    const storage = getStorageContext()

    // Add a custom template directly into storage
    const customTmpl = {
      id: 'template-custom-existing',
      name: 'My Road Trip',
      description: 'Custom road trip packing',
      isSystem: false,
      items: [],
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    }
    await storage.templates.saveTemplate(customTmpl)

    // Call loadTemplates again
    const secondLoad = await store.loadTemplates()

    // Total should be 4 predefined + 1 custom
    expect(secondLoad).toHaveLength(5)
    expect(secondLoad.some((t) => t.id === 'template-custom-existing')).toBe(true)

    // Predefined templates remain intact
    const beach = secondLoad.find((t) => t.id === 'template-predefined-beach')
    expect(beach?.name).toBe('Beach Vacation')
  })

  // 3. Custom template creation and persistence from a trip
  it('creates and persists a custom template from an active trip checklist', async () => {
    const storage = getStorageContext()
    const trip = createSampleTrip('trip-123', 'Swiss Summer')
    const items = createSampleItems('trip-123')

    // Persist trip and items in storage
    await storage.trips.saveTripWithItems(trip, items)

    const store = useTemplateStore.getState()
    await store.loadTemplates()

    // Create custom template from trip
    const created = await store.createTemplateFromTrip(
      'trip-123',
      'My Swiss Summer Template',
      'Saved from my favourite Swiss holiday',
      items
    )

    expect(created.id).toMatch(/^template-/)
    expect(created.name).toBe('My Swiss Summer Template')
    expect(created.description).toBe('Saved from my favourite Swiss holiday')
    expect(created.isSystem).toBe(false)
    expect(created.defaultTransport).toEqual(['train', 'car'])
    expect(created.defaultActivities).toEqual(['trekking', 'adventure'])
    expect(created.defaultClimate).toBe('mixed')
    expect(created.defaultAccommodation).toBe('hotel')

    // Item with 0 effectiveQuantity must be excluded
    expect(created.items).toHaveLength(2)

    // Verify item transformation
    const trailShoes = created.items.find((i) => i.itemSlug === 'wear-trail-shoes')
    expect(trailShoes).toBeDefined()
    expect(trailShoes?.name).toBe('Trail Running Shoes')
    expect(trailShoes?.category).toBe('clothing')
    expect(trailShoes?.priority).toBe('critical')
    expect(trailShoes?.defaultQuantity).toBe(1)
    expect(trailShoes?.weightGrams).toBe(700)
    expect(trailShoes?.isShared).toBe(false)

    // Verify custom item mapping
    const customMap = created.items.find((i) => i.itemSlug === 'custom-trekking-map')
    expect(customMap).toBeDefined()
    expect(customMap?.defaultQuantity).toBe(2) // Took effectiveQuantity (2)
    expect(customMap?.isShared).toBe(true)

    // Store state must contain the new template
    expect(useTemplateStore.getState().templates).toContainEqual(created)

    // Verify persisted in storage
    const persisted = await storage.templates.getTemplateById(created.id)
    expect(persisted).toBeDefined()
    expect(persisted?.name).toBe('My Swiss Summer Template')
  })

  // 4. Custom template creation using object options format and storage lookup
  it('creates custom template using object options and loads items from storage if not passed', async () => {
    const storage = getStorageContext()
    const trip = createSampleTrip('trip-auto', 'Island Hopping')
    const items = createSampleItems('trip-auto')
    await storage.trips.saveTripWithItems(trip, items)

    const store = useTemplateStore.getState()
    const created = await store.createTemplateFromTrip({
      tripId: 'trip-auto',
      name: 'Island Template',
    })

    expect(created.name).toBe('Island Template')
    expect(created.description).toBe('')
    expect(created.items).toHaveLength(2) // 2 active items loaded from storage
  })

  // 5. Custom template update
  it('updates custom template metadata and items and persists to storage', async () => {
    const store = useTemplateStore.getState()
    await store.loadTemplates()

    const created = await store.createTemplateFromTrip({
      tripId: 'trip-dummy',
      name: 'Original Name',
      description: 'Original Description',
      items: createSampleItems('trip-dummy'),
    })

    const updated = await store.updateTemplate(created.id, {
      name: 'Updated Name',
      description: 'Updated Description',
    })

    expect(updated.name).toBe('Updated Name')
    expect(updated.description).toBe('Updated Description')
    expect(updated.isSystem).toBe(false)
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.updatedAt).getTime()
    )

    // Store state reflection
    const foundInStore = useTemplateStore.getState().getTemplateById(created.id)
    expect(foundInStore?.name).toBe('Updated Name')

    // Storage reflection
    const storage = getStorageContext()
    const inStorage = await storage.templates.getTemplateById(created.id)
    expect(inStorage?.name).toBe('Updated Name')
    expect(inStorage?.description).toBe('Updated Description')
  })

  // 6. Custom template deletion
  it('deletes custom template from store and storage', async () => {
    const store = useTemplateStore.getState()
    await store.loadTemplates()

    const created = await store.createTemplateFromTrip({
      tripId: 'trip-temp',
      name: 'Temporary Template',
      items: [],
    })

    expect(useTemplateStore.getState().getTemplateById(created.id)).toBeDefined()

    await store.deleteTemplate(created.id)

    expect(useTemplateStore.getState().getTemplateById(created.id)).toBeUndefined()

    const storage = getStorageContext()
    const inStorage = await storage.templates.getTemplateById(created.id)
    expect(inStorage).toBeNull()
  })

  // 7. System template edit & delete protection
  it('strictly protects predefined system templates from edit and deletion', async () => {
    const store = useTemplateStore.getState()
    await store.loadTemplates()

    const systemTemplateId = 'template-predefined-beach'

    // Attempt to update system template must throw
    await expect(
      store.updateTemplate(systemTemplateId, { name: 'Renamed Beach' })
    ).rejects.toThrow('Predefined system templates cannot be modified')

    // Verify system template was NOT modified
    const templateAfterUpdate = store.getTemplateById(systemTemplateId)
    expect(templateAfterUpdate?.name).toBe('Beach Vacation')

    // Attempt to delete system template must throw
    await expect(store.deleteTemplate(systemTemplateId)).rejects.toThrow(
      'Predefined system templates cannot be deleted'
    )

    // Verify system template is still present
    const templateAfterDelete = store.getTemplateById(systemTemplateId)
    expect(templateAfterDelete).toBeDefined()
    expect(templateAfterDelete?.id).toBe(systemTemplateId)
  })

  // 8. Validation and error handling
  it('validates required fields on create and update', async () => {
    const store = useTemplateStore.getState()
    await store.loadTemplates()

    // Missing trip ID
    await expect(
      store.createTemplateFromTrip('', 'Template')
    ).rejects.toThrow('Trip ID is required')

    // Empty template name
    await expect(
      store.createTemplateFromTrip('trip-1', '   ')
    ).rejects.toThrow('Template name is required')

    // Non-existent template update
    await expect(
      store.updateTemplate('non-existent-id', { name: 'New' })
    ).rejects.toThrow('Template not found')

    // Empty name on update
    const custom = await store.createTemplateFromTrip('trip-1', 'Valid', '', [])
    await expect(
      store.updateTemplate(custom.id, { name: '   ' })
    ).rejects.toThrow('Template name cannot be empty')
  })

  // 9. Dexie storage compatibility (IndexedDB mode)
  it('operates identically when running against IndexedDB Dexie storage', async () => {
    const dexieStorage = await createStorageContext('indexeddb')
    setStorageContext(dexieStorage)

    useTemplateStore.setState({
      templates: [],
      isLoading: false,
      isInitialized: false,
      error: null,
    })

    const store = useTemplateStore.getState()
    const loaded = await store.loadTemplates()
    expect(loaded).toHaveLength(4)

    // System templates seeded in Dexie table
    const dexieAll = await dexieStorage.templates.getAllTemplates()
    expect(dexieAll).toHaveLength(4)

    // Create custom template in Dexie
    const custom = await store.createTemplateFromTrip('trip-dexie', 'Dexie Template', 'Testing dexie', [])
    expect(custom.id).toMatch(/^template-/)

    const fetchedFromDexie = await dexieStorage.templates.getTemplateById(custom.id)
    expect(fetchedFromDexie?.name).toBe('Dexie Template')
  })

  // 10. Milestone 9D: Template name and description length validations
  it('enforces character length boundaries on name (1-60) and description (<= 200)', async () => {
    const store = useTemplateStore.getState()
    await store.loadTemplates()

    // 10a. Name > 60 chars on create
    const longName = 'A'.repeat(61)
    await expect(
      store.createTemplateFromTrip('trip-1', longName, 'Valid description')
    ).rejects.toThrow('Template name cannot exceed 60 characters')

    // 10b. Description > 200 chars on create
    const longDesc = 'D'.repeat(201)
    await expect(
      store.createTemplateFromTrip('trip-1', 'Valid Name', longDesc)
    ).rejects.toThrow('Template description cannot exceed 200 characters')

    // Create a valid template to test update boundaries
    const custom = await store.createTemplateFromTrip('trip-1', 'Initial Name', 'Initial Desc', [])

    // 10c. Name > 60 chars on update
    await expect(
      store.updateTemplate(custom.id, { name: 'B'.repeat(61) })
    ).rejects.toThrow('Template name cannot exceed 60 characters')

    // 10d. Description > 200 chars on update
    await expect(
      store.updateTemplate(custom.id, { description: 'E'.repeat(201) })
    ).rejects.toThrow('Template description cannot exceed 200 characters')

    // 10e. Valid maximum boundary succeeds (60 chars name, 200 chars desc)
    const maxName = 'N'.repeat(60)
    const maxDesc = 'X'.repeat(200)
    const updated = await store.updateTemplate(custom.id, {
      name: maxName,
      description: maxDesc,
    })
    expect(updated.name).toBe(maxName)
    expect(updated.description).toBe(maxDesc)
  })

  // 11. Milestone 9D: Empty items update rejection
  it('rejects updating items to an empty array', async () => {
    const store = useTemplateStore.getState()
    await store.loadTemplates()

    const custom = await store.createTemplateFromTrip({
      tripId: 'trip-dummy',
      name: 'Custom Template With Items',
      items: createSampleItems('trip-dummy'),
    })
    expect(custom.items.length).toBeGreaterThan(0)

    // Attempting to update with an empty items array must throw
    await expect(
      store.updateTemplate(custom.id, { items: [] })
    ).rejects.toThrow('Template must contain at least one item')

    // Verify template items in store and storage were NOT cleared
    const preserved = store.getTemplateById(custom.id)
    expect(preserved?.items.length).toBeGreaterThan(0)
  })

  // 12. Milestone 9D: Granular item-level configuration validation
  it('validates each item configuration strictly when updating items', async () => {
    const store = useTemplateStore.getState()
    await store.loadTemplates()

    const custom = await store.createTemplateFromTrip({
      tripId: 'trip-dummy',
      name: 'Custom Item Validations',
      items: createSampleItems('trip-dummy'),
    })

    const validItem = {
      name: 'Valid Jacket',
      itemSlug: 'wear-valid-jacket',
      category: 'clothing' as const,
      priority: 'recommended' as const,
      quantityStrategy: 'fixed' as const,
      defaultQuantity: 1,
      weightGrams: 450,
      isShared: false,
      reasons: ['Warmth'],
    }

    // Invalid: missing name
    await expect(
      store.updateTemplate(custom.id, {
        items: [{ ...validItem, name: '   ' }],
      })
    ).rejects.toThrow('name is required')

    // Invalid: missing itemSlug
    await expect(
      store.updateTemplate(custom.id, {
        items: [{ ...validItem, itemSlug: '' }],
      })
    ).rejects.toThrow('itemSlug is required')

    // Invalid: unsupported category
    await expect(
      store.updateTemplate(custom.id, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: [{ ...validItem, category: 'weapons' as any }],
      })
    ).rejects.toThrow("category 'weapons' is invalid")

    // Invalid: unsupported priority
    await expect(
      store.updateTemplate(custom.id, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: [{ ...validItem, priority: 'urgent' as any }],
      })
    ).rejects.toThrow("priority 'urgent' is invalid")

    // Invalid: defaultQuantity <= 0 or not an integer
    await expect(
      store.updateTemplate(custom.id, {
        items: [{ ...validItem, defaultQuantity: 0 }],
      })
    ).rejects.toThrow('defaultQuantity must be a positive integer (>= 1)')

    await expect(
      store.updateTemplate(custom.id, {
        items: [{ ...validItem, defaultQuantity: 1.5 }],
      })
    ).rejects.toThrow('defaultQuantity must be a positive integer (>= 1)')

    // Invalid: unsupported quantityStrategy
    await expect(
      store.updateTemplate(custom.id, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: [{ ...validItem, quantityStrategy: 'exponential' as any }],
      })
    ).rejects.toThrow("quantityStrategy 'exponential' is invalid")

    // Invalid: negative weightGrams
    await expect(
      store.updateTemplate(custom.id, {
        items: [{ ...validItem, weightGrams: -10 }],
      })
    ).rejects.toThrow('weightGrams must be a non-negative finite number')

    // Invalid: reasons not string array
    await expect(
      store.updateTemplate(custom.id, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: [{ ...validItem, reasons: [123] as any }],
      })
    ).rejects.toThrow('reasons must be an array of strings')

    // Valid: updating with fully conforming items succeeds
    const updated = await store.updateTemplate(custom.id, {
      items: [
        validItem,
        {
          name: 'Passport',
          itemSlug: 'doc-passport',
          category: 'documents',
          priority: 'critical',
          quantityStrategy: 'per_person',
          defaultQuantity: 2,
          isShared: false,
          reasons: ['Travel ID'],
        },
      ],
    })

    expect(updated.items).toHaveLength(2)
    expect(updated.items[0].name).toBe('Valid Jacket')
    expect(updated.items[1].name).toBe('Passport')
    expect(updated.items[1].quantityStrategy).toBe('per_person')
  })

  // 13. Milestone 9D: Failed storage operations do not mutate Zustand store
  it('does not mutate Zustand state when storage save fails during update', async () => {
    const store = useTemplateStore.getState()
    await store.loadTemplates()

    const custom = await store.createTemplateFromTrip({
      tripId: 'trip-dummy',
      name: 'Resilient Template',
      description: 'Initial description',
      items: createSampleItems('trip-dummy'),
    })

    const storage = getStorageContext()
    const originalSave = storage.templates.saveTemplate.bind(storage.templates)

    // Simulate storage failure
    storage.templates.saveTemplate = async () => {
      throw new Error('Database disk error')
    }

    try {
      await expect(
        store.updateTemplate(custom.id, {
          name: 'Should Not Persist',
          description: 'Should not be in store',
        })
      ).rejects.toThrow('Database disk error')

      // Verify Zustand state was NOT mutated
      const stateItem = store.getTemplateById(custom.id)
      expect(stateItem?.name).toBe('Resilient Template')
      expect(stateItem?.description).toBe('Initial description')
      expect(useTemplateStore.getState().error).toBe('Database disk error')
    } finally {
      storage.templates.saveTemplate = originalSave
    }
  })

  // 14. Milestone 9D: Template deletion does not affect trip checklist items
  it('deleting a custom template removes only the template without modifying trip checklist items', async () => {
    const storage = getStorageContext()
    const trip = createSampleTrip('trip-preserve', 'Trip With Items')
    const items = createSampleItems('trip-preserve')
    await storage.trips.saveTripWithItems(trip, items)

    const store = useTemplateStore.getState()
    await store.loadTemplates()

    // Create custom template from the trip
    const custom = await store.createTemplateFromTrip('trip-preserve', 'Template To Delete', '', items)
    expect(store.getTemplateById(custom.id)).toBeDefined()

    // Delete the template
    await store.deleteTemplate(custom.id)

    // Template is gone from store and storage
    expect(store.getTemplateById(custom.id)).toBeUndefined()
    expect(await storage.templates.getTemplateById(custom.id)).toBeNull()

    // Existing trip and checklist items MUST remain completely untouched
    const tripAfter = await storage.trips.getTripById('trip-preserve')
    expect(tripAfter).toBeDefined()
    expect(tripAfter?.name).toBe('Trip With Items')

    const itemsAfter = await storage.items.getItemsForTrip('trip-preserve')
    expect(itemsAfter).toHaveLength(3)
    expect(itemsAfter.find((i) => i.itemSlug === 'wear-trail-shoes')).toBeDefined()
  })
})
