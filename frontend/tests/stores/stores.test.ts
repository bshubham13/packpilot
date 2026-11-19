import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTripStore } from '../../src/stores/tripStore'
import { useChecklistStore } from '../../src/stores/checklistStore'
import { createStorageContext, setStorageContext, getStorageContext } from '../../src/db/factory'
import type { TripConfig, NormalizedTripContext } from '../../src/types'

describe('Zustand Stores (useTripStore & useChecklistStore)', () => {
  beforeEach(async () => {
    // Initialize in-memory storage context for deterministic store tests
    const storage = await createStorageContext('memory')
    setStorageContext(storage)

    useTripStore.setState({
      trips: [],
      activeTrip: null,
      isLoading: false,
      error: null,
      storageType: 'memory',
      isStorageAvailable: false,
    })

    useChecklistStore.setState({
      tripId: null,
      items: [],
      dismissedRecords: [],
      activeCategory: 'all',
      filterStatus: 'all',
      searchQuery: '',
      isLoading: false,
      error: null,
    })
  })

  const sampleConfig: TripConfig = {
    name: 'Norwegian Fjords Cruise',
    destination: 'Bergen, Norway',
    startDate: '2026-07-01',
    endDate: '2026-07-07', // 7 days
    transportModes: ['flight'],
    activities: ['sightseeing'],
    climate: 'mixed',
    accommodationType: 'hotel',
    travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 0 },
    personalPreferences: ['medications'],
  }

  describe('useTripStore', () => {
    it('creates a new trip, calculates duration, generates items atomically, and updates state', async () => {
      const tripStore = useTripStore.getState()
      const newTrip = await tripStore.createTrip(sampleConfig)

      expect(newTrip.id).toBeDefined()
      expect(newTrip.durationDays).toBe(7)
      expect(newTrip.totalTravellerCount).toBe(2)
      expect(useTripStore.getState().trips).toHaveLength(1)
      expect(useTripStore.getState().activeTrip?.id).toBe(newTrip.id)

      // Verify that child items were generated and saved atomically
      const checklistStore = useChecklistStore.getState()
      await checklistStore.loadItems(newTrip.id)
      expect(useChecklistStore.getState().items.length).toBeGreaterThan(10)
    })

    it('updates trip parameters and recalculates duration when dates change', async () => {
      const trip = await useTripStore.getState().createTrip(sampleConfig)

      // Change end date to 2026-07-10 (10 days duration)
      const updated = await useTripStore.getState().updateTrip(trip.id, {
        endDate: '2026-07-10',
        name: 'Extended Norwegian Cruise',
      })

      expect(updated?.name).toBe('Extended Norwegian Cruise')
      expect(updated?.durationDays).toBe(10)
      expect(useTripStore.getState().activeTrip?.name).toBe('Extended Norwegian Cruise')
    })

    it('deletes trip and cascades to child items removing activeTrip if selected', async () => {
      const trip = await useTripStore.getState().createTrip(sampleConfig)
      expect(useTripStore.getState().trips).toHaveLength(1)

      await useTripStore.getState().deleteTrip(trip.id)
      expect(useTripStore.getState().trips).toHaveLength(0)
      expect(useTripStore.getState().activeTrip).toBeNull()

      // Checklist for that trip is empty
      await useChecklistStore.getState().loadItems(trip.id)
      expect(useChecklistStore.getState().items).toHaveLength(0)
    })

    it('deletes active trip and automatically clears active checklist store state', async () => {
      const trip = await useTripStore.getState().createTrip(sampleConfig)
      await useChecklistStore.getState().loadItems(trip.id)
      expect(useChecklistStore.getState().tripId).toBe(trip.id)
      expect(useChecklistStore.getState().items.length).toBeGreaterThan(0)

      // Set transient filter
      useChecklistStore.getState().setActiveCategory('clothing')

      // Delete the active trip
      await useTripStore.getState().deleteTrip(trip.id)

      // Verify checklist state is completely reset
      const checklist = useChecklistStore.getState()
      expect(checklist.tripId).toBeNull()
      expect(checklist.items).toHaveLength(0)
      expect(checklist.dismissedRecords).toHaveLength(0)
      expect(checklist.activeCategory).toBe('all')
    })

    it('deleting an inactive trip does NOT clear active checklist state', async () => {
      const trip1 = await useTripStore.getState().createTrip({ ...sampleConfig, name: 'Trip 1' })
      const trip2 = await useTripStore.getState().createTrip({ ...sampleConfig, name: 'Trip 2' })

      // Load trip1 in checklist
      await useChecklistStore.getState().loadItems(trip1.id)
      expect(useChecklistStore.getState().tripId).toBe(trip1.id)
      const trip1ItemsCount = useChecklistStore.getState().items.length

      // Delete trip2 (unrelated inactive trip)
      await useTripStore.getState().deleteTrip(trip2.id)

      // Checklist for trip1 must remain completely unaffected
      const checklist = useChecklistStore.getState()
      expect(checklist.tripId).toBe(trip1.id)
      expect(checklist.items).toHaveLength(trip1ItemsCount)
    })

    it('duplicates a trip with cloned items and sets activeTrip to duplicate', async () => {
      const trip = await useTripStore.getState().createTrip(sampleConfig)
      const duplicated = await useTripStore.getState().duplicateTrip(trip.id, 'Duplicate Fjords')

      expect(duplicated.name).toBe('Duplicate Fjords')
      expect(useTripStore.getState().trips).toHaveLength(2)
      expect(useTripStore.getState().activeTrip?.id).toBe(duplicated.id)

      // Duplicated trip has its own independent items
      await useChecklistStore.getState().loadItems(duplicated.id)
      expect(useChecklistStore.getState().items.length).toBeGreaterThan(10)
    })
  })

  describe('useChecklistStore', () => {
    it('toggles item packed status between 0 and effectiveQuantity with optimistic update', async () => {
      const trip = await useTripStore.getState().createTrip(sampleConfig)
      await useChecklistStore.getState().loadItems(trip.id)

      const firstItem = useChecklistStore.getState().items[0]
      expect(firstItem.isPacked).toBe(false)
      expect(firstItem.packedQuantity).toBe(0)

      // Toggle to packed
      await useChecklistStore.getState().togglePacked(firstItem.id)
      let item = useChecklistStore.getState().items.find((i) => i.id === firstItem.id)
      expect(item?.isPacked).toBe(true)
      expect(item?.packedQuantity).toBe(firstItem.effectiveQuantity)

      // Toggle back to unpacked
      await useChecklistStore.getState().togglePacked(firstItem.id)
      item = useChecklistStore.getState().items.find((i) => i.id === firstItem.id)
      expect(item?.isPacked).toBe(false)
      expect(item?.packedQuantity).toBe(0)
    })

    it('sets packed quantity and clamps between 0 and effectiveQuantity', async () => {
      const trip = await useTripStore.getState().createTrip(sampleConfig)
      await useChecklistStore.getState().loadItems(trip.id)

      // Find an item with effectiveQuantity >= 2
      const multiQtyItem = useChecklistStore
        .getState()
        .items.find((i) => i.effectiveQuantity >= 2) || useChecklistStore.getState().items[0]

      // Set partial quantity
      await useChecklistStore.getState().setPackedQuantity(multiQtyItem.id, 1)
      let item = useChecklistStore.getState().items.find((i) => i.id === multiQtyItem.id)
      expect(item?.packedQuantity).toBe(1)

      // Clamps to effectiveQuantity if overpacked
      await useChecklistStore.getState().setPackedQuantity(multiQtyItem.id, 999)
      item = useChecklistStore.getState().items.find((i) => i.id === multiQtyItem.id)
      expect(item?.packedQuantity).toBe(multiQtyItem.effectiveQuantity)
      expect(item?.isPacked).toBe(true)
    })

    it('updates item quantity and clamps packed count if required quantity drops', async () => {
      const trip = await useTripStore.getState().createTrip(sampleConfig)
      await useChecklistStore.getState().loadItems(trip.id)

      const target = useChecklistStore.getState().items[0]
      // Set user quantity to 8 and pack 6
      await useChecklistStore.getState().updateItemQuantity(target.id, 8)
      await useChecklistStore.getState().setPackedQuantity(target.id, 6)

      let item = useChecklistStore.getState().items.find((i) => i.id === target.id)
      expect(item?.effectiveQuantity).toBe(8)
      expect(item?.packedQuantity).toBe(6)

      // Reduce user quantity to 4 -> packed clamped to 4
      await useChecklistStore.getState().updateItemQuantity(target.id, 4)
      item = useChecklistStore.getState().items.find((i) => i.id === target.id)
      expect(item?.effectiveQuantity).toBe(4)
      expect(item?.packedQuantity).toBe(4)
      expect(item?.isPacked).toBe(true)
    })

    it('adds a custom item with isCustom: true', async () => {
      const trip = await useTripStore.getState().createTrip(sampleConfig)
      await useChecklistStore.getState().loadItems(trip.id)

      const customItem = await useChecklistStore.getState().addCustomItem({
        name: 'Fly Fishing Rod',
        category: 'gear',
        quantity: 1,
        priority: 'optional',
        weightGrams: 850,
      })

      expect(customItem.isCustom).toBe(true)
      expect(customItem.name).toBe('Fly Fishing Rod')

      const found = useChecklistStore.getState().items.find((i) => i.id === customItem.id)
      expect(found).toBeDefined()
      expect(found?.isCustom).toBe(true)
    })

    it('dismisses a critical item and updates dismissedRecords in store', async () => {
      const trip = await useTripStore.getState().createTrip(sampleConfig)
      await useChecklistStore.getState().loadItems(trip.id)

      const passport = useChecklistStore.getState().items.find((i) => i.itemSlug === 'doc-passport')
      expect(passport).toBeDefined()

      const dismissedRecord = await useChecklistStore.getState().dismissItem(passport!.id)
      expect(dismissedRecord.itemSlug).toBe('doc-passport')

      // Removed from items array
      expect(useChecklistStore.getState().items.some((i) => i.id === passport!.id)).toBe(false)
      // Stored in dismissedRecords
      expect(
        useChecklistStore.getState().dismissedRecords.some((d) => d.itemSlug === 'doc-passport')
      ).toBe(true)
    })

    it('restores a dismissed item back to the checklist', async () => {
      const trip = await useTripStore.getState().createTrip(sampleConfig)
      await useChecklistStore.getState().loadItems(trip.id)

      const passport = useChecklistStore.getState().items.find((i) => i.itemSlug === 'doc-passport')
      await useChecklistStore.getState().dismissItem(passport!.id)

      // Restore
      const restored = await useChecklistStore.getState().restoreDismissedItem('doc-passport')
      expect(restored.itemSlug).toBe('doc-passport')

      // Back in items
      expect(useChecklistStore.getState().items.some((i) => i.itemSlug === 'doc-passport')).toBe(true)
      // Removed from dismissedRecords
      expect(
        useChecklistStore.getState().dismissedRecords.some((d) => d.itemSlug === 'doc-passport')
      ).toBe(false)
    })

    it('regenerates checklist preserving custom items and packed states', async () => {
      const trip = await useTripStore.getState().createTrip(sampleConfig)
      await useChecklistStore.getState().loadItems(trip.id)

      // Add a custom item
      await useChecklistStore.getState().addCustomItem({
        name: 'Specialty Espresso Beans',
        category: 'miscellaneous',
        quantity: 1,
      })

      // Pack first item
      const first = useChecklistStore.getState().items[0]
      await useChecklistStore.getState().togglePacked(first.id)

      // Regenerate checklist with duration changed
      const extendedConfig = { ...sampleConfig, endDate: '2026-07-10' }
      await useChecklistStore.getState().regenerateChecklist(extendedConfig)

      // Custom item preserved
      const custom = useChecklistStore
        .getState()
        .items.find((i) => i.name === 'Specialty Espresso Beans')
      expect(custom).toBeDefined()

      // Packed state preserved
      const packedItem = useChecklistStore.getState().items.find((i) => i.id === first.id)
      expect(packedItem?.packedQuantity).toBeGreaterThan(0)
    })

    it('regenerates checklist reusing persisted normalizedContext without making network calls', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      const storage = getStorageContext()

      const trip = await useTripStore.getState().createTrip(sampleConfig)

      // Attach a normalizedContext with destination driving mobility to the persisted trip
      const mockContext: NormalizedTripContext = {
        contextVersion: '2.0.0',
        contextState: 'current',
        tripId: trip.id,
        name: trip.name,
        startDate: trip.startDate,
        endDate: trip.endDate,
        durationDays: 7,
        travellers: trip.travellers,
        hasLaundryAccess: false,
        activities: trip.activities,
        baggageConfig: trip.baggageConfig,
        personalPreferences: trip.personalPreferences,
        journey: {
          destination: { city: { id: 'bergen', name: 'Bergen', country: 'Norway', countryCode: 'NO' } },
          classification: 'intercity',
          straightLineDistanceKm: 1200,
          isHeuristicDistance: true,
          overnightSelection: 'no',
          isOvernightTransit: false,
          isOvernightResolved: true,
          primaryTransport: 'flight',
          destinationMobility: { isDrivingAtDestination: true },
          secondaryTransportModes: [],
          provenance: { distanceMethod: 'haversine', retrievalMethod: 'cache', availability: 'available' },
        },
        environment: {
          daily: [],
          summary: {},
          hasFullForecastCoverage: false,
          hasPartialForecastCoverage: false,
          contextProvenance: { provider: 'none', retrievalMethod: 'offline_fallback', source: 'none', availability: 'unresolved_location', confidence: 'unavailable' },
          attribution: 'Weather data by Open-Meteo.com',
        },
        contextGeneratedAt: '2026-07-01T00:00:00Z',
      }

      await storage.trips.updateTrip(trip.id, { normalizedContext: mockContext })

      await useChecklistStore.getState().loadItems(trip.id)
      expect(useChecklistStore.getState().items.some((i) => i.itemSlug === 'doc-driver-licence')).toBe(false)

      // Reset fetch spy counter before manual regeneration
      fetchSpy.mockClear()

      // Manual regeneration
      await useChecklistStore.getState().regenerateChecklist(sampleConfig)

      // Zero network calls made
      expect(fetchSpy).not.toHaveBeenCalled()

      // Reused persisted normalizedContext to evaluate journeyRules: driver licence now recommended!
      const items = useChecklistStore.getState().items
      const driverLicence = items.find((i) => i.itemSlug === 'doc-driver-licence')
      expect(driverLicence).toBeDefined()
      expect(driverLicence?.priority).toBe('critical')
    })

    it('manages UI filter and search state cleanly', () => {
      useChecklistStore.getState().setActiveCategory('clothing')
      expect(useChecklistStore.getState().activeCategory).toBe('clothing')

      useChecklistStore.getState().setFilterStatus('critical')
      expect(useChecklistStore.getState().filterStatus).toBe('critical')

      useChecklistStore.getState().setSearchQuery('socks')
      expect(useChecklistStore.getState().searchQuery).toBe('socks')

      useChecklistStore.getState().clearFilters()
      expect(useChecklistStore.getState().activeCategory).toBe('all')
      expect(useChecklistStore.getState().filterStatus).toBe('all')
      expect(useChecklistStore.getState().searchQuery).toBe('')
    })

    it('rapid switching between trips with out-of-order async completion prevents race conditions', async () => {
      const trip1 = await useTripStore.getState().createTrip({ ...sampleConfig, name: 'Trip 1' })
      const trip2 = await useTripStore.getState().createTrip({ ...sampleConfig, name: 'Trip 2' })

      const storage = getStorageContext()
      const originalGetItems = storage.items.getItemsForTrip.bind(storage.items)

      let trip1Resolve: (() => void) | null = null
      const trip1Gate = new Promise<void>((resolve) => {
        trip1Resolve = resolve
      })

      const spy = vi.spyOn(storage.items, 'getItemsForTrip').mockImplementation(async (id: string) => {
        if (id === trip1.id) {
          await trip1Gate
          return originalGetItems(id)
        }
        return originalGetItems(id)
      })

      // User triggers load for trip1 (delayed)
      const loadTrip1Promise = useChecklistStore.getState().loadItems(trip1.id)

      // User immediately clicks trip2 before trip1 resolves
      const loadTrip2Promise = useChecklistStore.getState().loadItems(trip2.id)

      // Trip 2 completes first
      await loadTrip2Promise
      expect(useChecklistStore.getState().tripId).toBe(trip2.id)
      const trip2Items = useChecklistStore.getState().items
      expect(trip2Items[0].tripId).toBe(trip2.id)

      // Trip 1 finally resolves late
      trip1Resolve!()
      await loadTrip1Promise

      // Store MUST stay on trip2 and items must NOT be overwritten by trip1!
      expect(useChecklistStore.getState().tripId).toBe(trip2.id)
      expect(useChecklistStore.getState().items[0].tripId).toBe(trip2.id)
      expect(useChecklistStore.getState().items).toEqual(trip2Items)

      spy.mockRestore()
    })

    it('superseded request error does not overwrite active trip loading or error state', async () => {
      const trip1 = await useTripStore.getState().createTrip({ ...sampleConfig, name: 'Trip 1' })
      const trip2 = await useTripStore.getState().createTrip({ ...sampleConfig, name: 'Trip 2' })

      const storage = getStorageContext()
      let trip1Reject: ((err: Error) => void) | null = null
      const trip1Gate = new Promise<never>((_, reject) => {
        trip1Reject = reject
      })

      const spy = vi.spyOn(storage.items, 'getItemsForTrip').mockImplementation(async (id: string) => {
        if (id === trip1.id) {
          return trip1Gate
        }
        return []
      })

      // Start trip1
      const p1 = useChecklistStore.getState().loadItems(trip1.id)
      // Switch immediately to trip2
      const p2 = useChecklistStore.getState().loadItems(trip2.id)
      await p2

      // Trip 1 fails with network error
      trip1Reject!(new Error('Network disconnected'))
      await p1

      // Verify trip2 error is still null and tripId remains trip2
      expect(useChecklistStore.getState().tripId).toBe(trip2.id)
      expect(useChecklistStore.getState().error).toBeNull()

      spy.mockRestore()
    })

    describe('Bag Assignment & Persistence (Slice 6.4C-C2)', () => {
      it('assigns item to cabin, checked, and returns to unassigned', async () => {
        const trip = await useTripStore.getState().createTrip(sampleConfig)
        await useChecklistStore.getState().loadItems(trip.id)
        const item = useChecklistStore.getState().items[0]
        expect(item.bagAssignment).toBeUndefined()

        // 1. Assign to cabin
        await useChecklistStore.getState().setBagAssignment(item.id, 'cabin')
        expect(useChecklistStore.getState().items.find((i) => i.id === item.id)?.bagAssignment).toBe('cabin')

        // 2. Assign to checked
        await useChecklistStore.getState().setBagAssignment(item.id, 'checked')
        expect(useChecklistStore.getState().items.find((i) => i.id === item.id)?.bagAssignment).toBe('checked')

        // 3. Return to unassigned
        await useChecklistStore.getState().setBagAssignment(item.id, undefined)
        expect(useChecklistStore.getState().items.find((i) => i.id === item.id)?.bagAssignment).toBeUndefined()
      })

      it('safely handles non-existent item ID in setBagAssignment', async () => {
        const trip = await useTripStore.getState().createTrip(sampleConfig)
        await useChecklistStore.getState().loadItems(trip.id)
        const initialItems = [...useChecklistStore.getState().items]

        // Should return without throwing or modifying items
        await expect(useChecklistStore.getState().setBagAssignment('non-existent-id', 'cabin')).resolves.not.toThrow()
        expect(useChecklistStore.getState().items).toEqual(initialItems)
      })

      it('persists bag assignments in memory storage across reload', async () => {
        const trip = await useTripStore.getState().createTrip(sampleConfig)
        await useChecklistStore.getState().loadItems(trip.id)
        const [item1, item2] = useChecklistStore.getState().items

        await useChecklistStore.getState().setBagAssignment(item1.id, 'cabin')
        await useChecklistStore.getState().setBagAssignment(item2.id, 'checked')

        // Clear in-memory store state to simulate reload
        useChecklistStore.setState({ items: [], tripId: null })

        // Reload from storage
        await useChecklistStore.getState().loadItems(trip.id)
        const reloadedItems = useChecklistStore.getState().items
        expect(reloadedItems.find((i) => i.id === item1.id)?.bagAssignment).toBe('cabin')
        expect(reloadedItems.find((i) => i.id === item2.id)?.bagAssignment).toBe('checked')
      })

      it('persists bag assignments in Dexie IndexedDB storage across reload', async () => {
        const dbName = `DexieStoreTest_${Date.now()}_${Math.random()}`
        const dexieStorage = await createStorageContext('indexeddb', dbName)
        setStorageContext(dexieStorage)

        const trip = await useTripStore.getState().createTrip(sampleConfig)
        await useChecklistStore.getState().loadItems(trip.id)
        const item = useChecklistStore.getState().items[0]

        await useChecklistStore.getState().setBagAssignment(item.id, 'cabin')

        // Reload fresh from Dexie
        useChecklistStore.setState({ items: [], tripId: null })
        await useChecklistStore.getState().loadItems(trip.id)
        expect(useChecklistStore.getState().items.find((i) => i.id === item.id)?.bagAssignment).toBe('cabin')

        // Cleanup database
        const db = (dexieStorage.trips as { db?: { delete: () => Promise<void> } }).db
        if (db) await db.delete()
      })

      it('rolls back optimistic bag assignment when storage persistence fails', async () => {
        const trip = await useTripStore.getState().createTrip(sampleConfig)
        await useChecklistStore.getState().loadItems(trip.id)
        const item = useChecklistStore.getState().items[0]
        expect(item.bagAssignment).toBeUndefined()

        const storage = getStorageContext()
        const spy = vi.spyOn(storage.items, 'saveItem').mockRejectedValueOnce(new Error('Disk write failure'))

        await useChecklistStore.getState().setBagAssignment(item.id, 'checked')

        // Rollback occurred
        expect(useChecklistStore.getState().items.find((i) => i.id === item.id)?.bagAssignment).toBeUndefined()
        expect(useChecklistStore.getState().error).toBe('Disk write failure')

        spy.mockRestore()
      })

      it('extends updateItem to update bag assignment while preserving other fields', async () => {
        const trip = await useTripStore.getState().createTrip(sampleConfig)
        await useChecklistStore.getState().loadItems(trip.id)
        const item = useChecklistStore.getState().items[0]

        // Update bag assignment via updateItem
        const updated = await useChecklistStore.getState().updateItem(item.id, {
          bagAssignment: 'cabin',
        })
        expect(updated?.bagAssignment).toBe('cabin')
        expect(updated?.name).toBe(item.name)
        expect(updated?.category).toBe(item.category)
        expect(updated?.priority).toBe(item.priority)
        expect(useChecklistStore.getState().items.find((i) => i.id === item.id)?.bagAssignment).toBe('cabin')
      })

      it('preserves existing bag assignment when updateItem modifies other fields', async () => {
        const trip = await useTripStore.getState().createTrip(sampleConfig)
        await useChecklistStore.getState().loadItems(trip.id)
        const item = useChecklistStore.getState().items[0]

        // First set bag assignment to checked
        await useChecklistStore.getState().setBagAssignment(item.id, 'checked')
        expect(useChecklistStore.getState().items.find((i) => i.id === item.id)?.bagAssignment).toBe('checked')

        // Update quantity and notes without providing bagAssignment
        await useChecklistStore.getState().updateItem(item.id, {
          quantity: 4,
          notes: 'Special care needed',
        })

        const itemAfter = useChecklistStore.getState().items.find((i) => i.id === item.id)
        expect(itemAfter?.effectiveQuantity).toBe(4)
        expect(itemAfter?.notes).toBe('Special care needed')
        expect(itemAfter?.bagAssignment).toBe('checked')
      })

      it('allows updateItem to explicitly reset bagAssignment to undefined', async () => {
        const trip = await useTripStore.getState().createTrip(sampleConfig)
        await useChecklistStore.getState().loadItems(trip.id)
        const item = useChecklistStore.getState().items[0]

        await useChecklistStore.getState().setBagAssignment(item.id, 'cabin')
        expect(useChecklistStore.getState().items.find((i) => i.id === item.id)?.bagAssignment).toBe('cabin')

        await useChecklistStore.getState().updateItem(item.id, {
          bagAssignment: undefined,
        })
        expect(useChecklistStore.getState().items.find((i) => i.id === item.id)?.bagAssignment).toBeUndefined()
      })
    })
  })
})
