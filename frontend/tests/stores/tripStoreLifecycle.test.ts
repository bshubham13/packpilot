import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useTripStore, _resetTripStoreTracking } from '../../src/stores/tripStore'
import { useChecklistStore } from '../../src/stores/checklistStore'
import { createStorageContext, setStorageContext, getStorageContext } from '../../src/db/factory'
import type { TripConfig, ResolvedLocation, NormalizedTripContext } from '../../src/types'
import * as contextResolverModule from '../../src/services/contextResolver'

describe('TripStore Lifecycle & Update Coordination (Slice 2B)', () => {
  const sampleConfig: TripConfig = {
    name: 'Alpine Hiking Tour',
    destination: 'Interlaken, Switzerland',
    startDate: '2026-08-01',
    endDate: '2026-08-07', // 7 days
    transportModes: ['train'],
    activities: ['sightseeing'],
    climate: 'mixed',
    accommodationType: 'hotel',
    travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 0 },
    personalPreferences: [],
  }

  const interlakenLocation: ResolvedLocation = {
    city: { id: 'interlaken_ch', name: 'Interlaken', country: 'Switzerland', countryCode: 'CH' },
    coordinates: { latitude: 46.6863, longitude: 7.8632, isCentroid: true },
  }

  const kyotoLocation: ResolvedLocation = {
    city: { id: 'kyoto_jp', name: 'Kyoto', country: 'Japan', countryCode: 'JP' },
    coordinates: { latitude: 35.0116, longitude: 135.7681, isCentroid: true },
  }

  beforeEach(async () => {
    _resetTripStoreTracking()
    const storage = await createStorageContext('memory')
    setStorageContext(storage)

    useTripStore.setState({
      trips: [],
      activeTrip: null,
      isLoading: false,
      isInitialized: true,
      error: null,
      storageType: 'memory',
      isStorageAvailable: false,
      resolutionStatus: {},
      resolutionError: {},
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

    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    _resetTripStoreTracking()
  })

  // 1. Background resolution after successful trip persistence
  it('starts background resolution only after initial trip and fallback checklist persistence succeed', async () => {
    const storage = getStorageContext()
    const trip = await useTripStore.getState().createTrip(sampleConfig)

    // Initial trip and fallback checklist exist immediately
    expect(trip.id).toBeDefined()
    expect(trip.normalizedContext).toBeUndefined()
    expect(useTripStore.getState().resolutionStatus[trip.id]).toBe('resolving')

    // Initial fallback items are stored
    const initialItems = await storage.items.getItemsForTrip(trip.id)
    expect(initialItems.length).toBeGreaterThan(0)

    // Await background resolution completion
    await vi.waitFor(
      () => {
        expect(useTripStore.getState().resolutionStatus[trip.id]).toBe('resolved')
      },
      { timeout: 3000 }
    )

    // Store state now contains resolved context
    const stateTrip = useTripStore.getState().trips.find((t) => t.id === trip.id)
    expect(stateTrip?.normalizedContext).toBeDefined()
    expect(stateTrip?.normalizedContext?.tripId).toBe(trip.id)

    // Authoritative persisted record in storage was updated atomically
    const persistedTrip = await storage.trips.getTripById(trip.id)
    expect(persistedTrip?.normalizedContext).toBeDefined()
  })

  // 2. No resolution after failed initial persistence
  it('does not start background resolution if initial trip persistence fails', async () => {
    const storage = getStorageContext()
    const resolveSpy = vi.spyOn(contextResolverModule, 'resolveTripContext')

    // Force initial persistence to fail
    vi.spyOn(storage.trips, 'saveTripWithItems').mockRejectedValueOnce(
      new Error('Disk write failed')
    )

    await expect(useTripStore.getState().createTrip(sampleConfig)).rejects.toThrow(
      'Disk write failed'
    )

    // Ensure background resolution was never initiated
    expect(resolveSpy).not.toHaveBeenCalled()
    expect(Object.keys(useTripStore.getState().resolutionStatus)).toHaveLength(0)
  })

  // 3. Independent resolution of multiple trips
  it('resolves multiple trips independently without blocking or state cross-contamination', async () => {
    const tripA = await useTripStore.getState().createTrip({
      ...sampleConfig,
      name: 'Trip A (Interlaken)',
      destination: 'Interlaken',
      destinationLocation: interlakenLocation,
    })

    const tripB = await useTripStore.getState().createTrip({
      ...sampleConfig,
      name: 'Trip B (Kyoto)',
      destination: 'Kyoto',
      destinationLocation: kyotoLocation,
    })

    expect(useTripStore.getState().resolutionStatus[tripA.id]).toBe('resolving')
    expect(useTripStore.getState().resolutionStatus[tripB.id]).toBe('resolving')

    await vi.waitFor(
      () => {
        expect(useTripStore.getState().resolutionStatus[tripA.id]).toBe('resolved')
        expect(useTripStore.getState().resolutionStatus[tripB.id]).toBe('resolved')
      },
      { timeout: 3000 }
    )

    const updatedA = useTripStore.getState().trips.find((t) => t.id === tripA.id)
    const updatedB = useTripStore.getState().trips.find((t) => t.id === tripB.id)

    expect(updatedA?.normalizedContext?.journey.destination.city.name).toBe('Interlaken')
    expect(updatedB?.normalizedContext?.journey.destination.city.name).toBe('Kyoto')
  })

  // 4. Rapid concurrent updates serialized per trip
  it('serializes rapid concurrent updateTrip operations on the same trip preventing overwrites', async () => {
    const trip = await useTripStore.getState().createTrip(sampleConfig)

    // Dispatch two updates concurrently without awaiting the first
    const update1 = useTripStore.getState().updateTrip(trip.id, { name: 'Update 1 Name' })
    const update2 = useTripStore.getState().updateTrip(trip.id, { name: 'Final Update 2 Name' })

    const [res1, res2] = await Promise.all([update1, update2])

    expect(res1?.name).toBe('Update 1 Name')
    expect(res2?.name).toBe('Final Update 2 Name')

    // Latest write wins predictably because of per-trip serialization queue
    const storage = getStorageContext()
    const persisted = await storage.trips.getTripById(trip.id)
    expect(persisted?.name).toBe('Final Update 2 Name')
    expect(useTripStore.getState().activeTrip?.name).toBe('Final Update 2 Name')
  })

  // 5. Stale Tokyo response after Kyoto update
  it('drops stale Tokyo resolver response if user updated to Kyoto in the meantime', async () => {
    const storage = getStorageContext()
    const trip = await useTripStore.getState().createTrip({
      ...sampleConfig,
      destination: 'Tokyo',
    })

    let resolveTokyoDeferred!: () => void
    const tokyoPromise = new Promise<void>((resolve) => {
      resolveTokyoDeferred = resolve
    })

    let resolveKyotoDeferred!: () => void
    const kyotoPromise = new Promise<void>((resolve) => {
      resolveKyotoDeferred = resolve
    })

    vi.spyOn(contextResolverModule, 'resolveTripContext').mockImplementation(
      async (config: TripConfig) => {
        if (config.destination === 'Tokyo') {
          await tokyoPromise
          return {
            contextVersion: '2.0.0',
            contextState: 'current',
            tripId: trip.id,
            name: 'Tokyo Trip',
            startDate: config.startDate,
            endDate: config.endDate,
            durationDays: 7,
            travellers: config.travellers,
            hasLaundryAccess: false,
            activities: config.activities,
            personalPreferences: [],
            baggageConfig: config.baggageConfig!,
            journey: {
              destination: { city: { id: 'tokyo', name: 'Tokyo', country: 'Japan', countryCode: 'JP' } },
              classification: 'international',
              straightLineDistanceKm: 9000,
              isHeuristicDistance: false,
              overnightSelection: 'no',
              isOvernightTransit: false,
              isOvernightResolved: true,
              primaryTransport: 'flight',
              destinationMobility: { isDrivingAtDestination: false },
              secondaryTransportModes: [],
              provenance: { distanceMethod: 'haversine', retrievalMethod: 'network', availability: 'available' },
            },
            environment: {
              daily: [],
              summary: {},
              hasFullForecastCoverage: false,
              hasPartialForecastCoverage: false,
              contextProvenance: { provider: 'none', retrievalMethod: 'offline_fallback', source: 'none', availability: 'available', confidence: 'unavailable' },
              attribution: 'Open-Meteo',
            },
            contextGeneratedAt: new Date().toISOString(),
          } as NormalizedTripContext
        } else {
          await kyotoPromise
          return {
            contextVersion: '2.0.0',
            contextState: 'current',
            tripId: trip.id,
            name: 'Kyoto Trip',
            startDate: config.startDate,
            endDate: config.endDate,
            durationDays: 7,
            travellers: config.travellers,
            hasLaundryAccess: false,
            activities: config.activities,
            personalPreferences: [],
            baggageConfig: config.baggageConfig!,
            journey: {
              destination: { city: { id: 'kyoto', name: 'Kyoto', country: 'Japan', countryCode: 'JP' } },
              classification: 'international',
              straightLineDistanceKm: 9200,
              isHeuristicDistance: false,
              overnightSelection: 'no',
              isOvernightTransit: false,
              isOvernightResolved: true,
              primaryTransport: 'flight',
              destinationMobility: { isDrivingAtDestination: false },
              secondaryTransportModes: [],
              provenance: { distanceMethod: 'haversine', retrievalMethod: 'network', availability: 'available' },
            },
            environment: {
              daily: [],
              summary: {},
              hasFullForecastCoverage: false,
              hasPartialForecastCoverage: false,
              contextProvenance: { provider: 'none', retrievalMethod: 'offline_fallback', source: 'none', availability: 'available', confidence: 'unavailable' },
              attribution: 'Open-Meteo',
            },
            contextGeneratedAt: new Date().toISOString(),
          } as NormalizedTripContext
        }
      }
    )

    // User updates destination to Kyoto
    await useTripStore.getState().updateTrip(trip.id, { destination: 'Kyoto' })

    // Simulate Tokyo resolving AFTER Kyoto was initiated
    resolveTokyoDeferred()
    // Then Kyoto resolves
    resolveKyotoDeferred()

    await vi.waitFor(() => {
      expect(useTripStore.getState().resolutionStatus[trip.id]).toBe('resolved')
    })

    // Persisted destination context must be Kyoto, Tokyo was cleanly dropped
    const finalTrip = await storage.trips.getTripById(trip.id)
    expect(finalTrip?.normalizedContext?.journey.destination.city.name).toBe('Kyoto')
  })

  // 6. Local-only update without network calls
  it('performs local checklist regeneration without making network calls when only activities change', async () => {
    const trip = await useTripStore.getState().createTrip(sampleConfig)

    await vi.waitFor(() => {
      expect(useTripStore.getState().resolutionStatus[trip.id]).toBe('resolved')
    })

    const resolveSpy = vi.spyOn(contextResolverModule, 'resolveTripContext')

    // Update activities locally (Class 2)
    const updated = await useTripStore.getState().updateTrip(trip.id, {
      activities: ['trekking', 'beach'],
    })

    // Zero network/resolver calls made
    expect(resolveSpy).not.toHaveBeenCalled()
    expect(updated?.activities).toEqual(['trekking', 'beach'])

    // Checklist was regenerated locally to include trekking gear
    const storage = getStorageContext()
    const items = await storage.items.getItemsForTrip(trip.id)
    expect(items.some((i) => i.itemSlug === 'wear-trekking-boots' || i.itemSlug === 'gear-trekking-poles')).toBe(true)
  })

  // 7. Deletion during resolution
  it('does not resurrect a deleted trip if background resolution settles after deletion', async () => {
    let deferredResolve!: () => void
    const gate = new Promise<void>((resolve) => {
      deferredResolve = resolve
    })

    vi.spyOn(contextResolverModule, 'resolveTripContext').mockImplementation(async (config: TripConfig) => {
      await gate
      return {
        contextVersion: '2.0.0',
        contextState: 'current',
        tripId: config.destination,
        name: 'Late Trip',
        startDate: config.startDate,
        endDate: config.endDate,
        durationDays: 7,
        travellers: config.travellers,
        hasLaundryAccess: false,
        activities: config.activities,
        personalPreferences: [],
        baggageConfig: config.baggageConfig!,
        journey: {
          destination: { city: { id: 'late', name: 'Late', country: 'Late', countryCode: 'LT' } },
          classification: 'domestic',
          straightLineDistanceKm: 100,
          isHeuristicDistance: false,
          overnightSelection: 'no',
          isOvernightTransit: false,
          isOvernightResolved: true,
          primaryTransport: 'train',
          destinationMobility: { isDrivingAtDestination: false },
          secondaryTransportModes: [],
          provenance: { distanceMethod: 'haversine', retrievalMethod: 'network', availability: 'available' },
        },
        environment: {
          daily: [],
          summary: {},
          hasFullForecastCoverage: false,
          hasPartialForecastCoverage: false,
          contextProvenance: { provider: 'none', retrievalMethod: 'offline_fallback', source: 'none', availability: 'available', confidence: 'unavailable' },
          attribution: 'Open-Meteo',
        },
        contextGeneratedAt: new Date().toISOString(),
      } as NormalizedTripContext
    })

    const trip = await useTripStore.getState().createTrip(sampleConfig)

    // User deletes trip while resolution is in flight
    await useTripStore.getState().deleteTrip(trip.id)
    expect(useTripStore.getState().trips.find((t) => t.id === trip.id)).toBeUndefined()

    // Background resolution now settles late
    deferredResolve()

    // Give microtasks time to execute
    await new Promise((r) => setTimeout(r, 50))

    // Trip is NOT resurrected in storage or state
    const storage = getStorageContext()
    const persisted = await storage.trips.getTripById(trip.id)
    expect(persisted).toBeNull()
    expect(useTripStore.getState().trips.find((t) => t.id === trip.id)).toBeUndefined()
    expect(useTripStore.getState().resolutionStatus[trip.id]).toBeUndefined()
  })

  // 8. Duplication during resolution
  it('duplicates trip with independent resolution token without sharing in-flight mutation state', async () => {
    const trip = await useTripStore.getState().createTrip(sampleConfig)

    // Duplicate while initial resolution may still be pending or resolving
    const duplicate = await useTripStore.getState().duplicateTrip(trip.id, 'Duplicated Trip')

    expect(duplicate.id).not.toBe(trip.id)
    expect(duplicate.name).toBe('Duplicated Trip')

    // Both trips exist in store independently
    expect(useTripStore.getState().trips).toHaveLength(2)
  })

  // 9. Offline fallback produces valid resolved status
  it('handles offline network failures gracefully falling back to deterministic context', async () => {
    // Simulate offline network failure
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline (fetch failed)'))

    const trip = await useTripStore.getState().createTrip({
      ...sampleConfig,
      destination: 'Uncached Remote Outpost',
      destinationLocation: undefined,
    })

    await vi.waitFor(
      () => {
        expect(useTripStore.getState().resolutionStatus[trip.id]).toBe('resolved')
      },
      { timeout: 3000 }
    )

    const stateTrip = useTripStore.getState().trips.find((t) => t.id === trip.id)
    expect(stateTrip?.normalizedContext).toBeDefined()
    expect(stateTrip?.normalizedContext?.environment.contextProvenance.retrievalMethod).toBe('offline_fallback')
  })

  // 10. Reconciliation preservation of user modifications
  it('preserves user packed quantities, quantity adjustments, and custom items across background resolution', async () => {
    const trip = await useTripStore.getState().createTrip(sampleConfig)

    // Load items in checklist
    await useChecklistStore.getState().loadItems(trip.id)
    const firstItem = useChecklistStore.getState().items[0]

    // Pack the item
    await useChecklistStore.getState().togglePacked(firstItem.id)

    // Override quantity on second item
    const secondItem = useChecklistStore.getState().items[1]
    await useChecklistStore.getState().updateItemQuantity(secondItem.id, 99)

    // Add a custom item
    const customItem = await useChecklistStore.getState().addCustomItem({
      name: 'Custom Mountaineering Carabiners',
      category: 'miscellaneous',
      quantity: 5,
    })

    // Now trigger refreshTripContext (reconciles with new context)
    await useTripStore.getState().refreshTripContext(trip.id)

    // Inspect checklist items after resolution reconciliation
    const itemsAfter = useChecklistStore.getState().items

    const packedPreserved = itemsAfter.find((i) => i.id === firstItem.id)
    expect(packedPreserved?.packedQuantity).toBeGreaterThan(0)

    const quantityPreserved = itemsAfter.find((i) => i.id === secondItem.id)
    expect(quantityPreserved?.effectiveQuantity).toBe(99)
    expect(quantityPreserved?.userAdjustedQuantity).toBe(99)

    const customPreserved = itemsAfter.find((i) => i.id === customItem.id)
    expect(customPreserved).toBeDefined()
    expect(customPreserved?.name).toBe('Custom Mountaineering Carabiners')
  })

  // 11. Active checklist isolation
  it('does not overwrite another trip active checklist when an inactive trip resolves', async () => {
    const tripA = await useTripStore.getState().createTrip({ ...sampleConfig, name: 'Trip A' })
    const tripB = await useTripStore.getState().createTrip({ ...sampleConfig, name: 'Trip B' })

    // User is actively viewing checklist for Trip A
    await useChecklistStore.getState().loadItems(tripA.id)
    expect(useChecklistStore.getState().tripId).toBe(tripA.id)
    const tripAItemsCount = useChecklistStore.getState().items.length

    // Refresh context for Trip B in background
    await useTripStore.getState().refreshTripContext(tripB.id)

    // Checklist store must still be pointing to Trip A and have Trip A items
    expect(useChecklistStore.getState().tripId).toBe(tripA.id)
    expect(useChecklistStore.getState().items.length).toBe(tripAItemsCount)
    expect(useChecklistStore.getState().items.every((i) => i.tripId === tripA.id)).toBe(true)
  })

  // 12. Refresh and retry behavior
  it('provides a store-level refreshTripContext action that successfully refreshes context on demand', async () => {
    const trip = await useTripStore.getState().createTrip(sampleConfig)

    await vi.waitFor(() => {
      expect(useTripStore.getState().resolutionStatus[trip.id]).toBe('resolved')
    })

    const refreshedTrip = await useTripStore.getState().refreshTripContext(trip.id)

    expect(refreshedTrip).toBeDefined()
    expect(refreshedTrip?.id).toBe(trip.id)
    expect(refreshedTrip?.normalizedContext).toBeDefined()
    expect(useTripStore.getState().resolutionStatus[trip.id]).toBe('resolved')
  })

  // 13. Concurrency hardening: Checklist mutation vs background reconciliation (F-1)
  it('prevents concurrent checklist mutations and background reconciliation from overwriting each other', async () => {
    let deferredResolve!: () => void
    const gate = new Promise<void>((resolve) => {
      deferredResolve = resolve
    })

    vi.spyOn(contextResolverModule, 'resolveTripContext').mockImplementation(async (config: TripConfig) => {
      await gate
      return {
        contextVersion: '2.0.0',
        contextState: 'current',
        tripId: config.destination,
        name: config.name,
        startDate: config.startDate,
        endDate: config.endDate,
        durationDays: 7,
        travellers: config.travellers,
        hasLaundryAccess: false,
        activities: config.activities,
        personalPreferences: [],
        baggageConfig: config.baggageConfig!,
        journey: {
          destination: { city: { id: 'interlaken', name: 'Interlaken', country: 'CH', countryCode: 'CH' } },
          classification: 'domestic',
          straightLineDistanceKm: 100,
          isHeuristicDistance: false,
          overnightSelection: 'no',
          isOvernightTransit: false,
          isOvernightResolved: true,
          primaryTransport: 'train',
          destinationMobility: { isDrivingAtDestination: false },
          secondaryTransportModes: [],
          provenance: { distanceMethod: 'haversine', retrievalMethod: 'network', availability: 'available' },
        },
        environment: {
          daily: [],
          summary: {},
          hasFullForecastCoverage: false,
          hasPartialForecastCoverage: false,
          contextProvenance: { provider: 'none', retrievalMethod: 'offline_fallback', source: 'none', availability: 'available', confidence: 'unavailable' },
          attribution: 'Open-Meteo',
        },
        contextGeneratedAt: new Date().toISOString(),
      } as NormalizedTripContext
    })

    const trip = await useTripStore.getState().createTrip(sampleConfig)
    await useChecklistStore.getState().loadItems(trip.id)
    const item = useChecklistStore.getState().items[0]

    // In-flight background resolution is waiting at gate
    expect(useTripStore.getState().resolutionStatus[trip.id]).toBe('resolving')

    // User performs concurrent mutation: toggle packed and update quantity on item
    const togglePromise = useChecklistStore.getState().togglePacked(item.id)
    const quantityPromise = useChecklistStore.getState().updateItemQuantity(item.id, 10)

    // Release background resolution gate
    deferredResolve()

    // Await all concurrent operations to settle
    await Promise.all([togglePromise, quantityPromise])
    await vi.waitFor(() => {
      expect(useTripStore.getState().resolutionStatus[trip.id]).toBe('resolved')
    })

    // Verify that user mutations were preserved in both storage and checklist store
    const storage = getStorageContext()
    const itemsInStorage = await storage.items.getItemsForTrip(trip.id)
    const storedItem = itemsInStorage.find((i) => i.id === item.id)
    expect(storedItem?.packedQuantity).toBeGreaterThan(0)
    expect(storedItem?.userAdjustedQuantity).toBe(10)

    const storeItem = useChecklistStore.getState().items.find((i) => i.id === item.id)
    expect(storeItem?.packedQuantity).toBeGreaterThan(0)
    expect(storeItem?.userAdjustedQuantity).toBe(10)
  })

  // 14. Concurrency hardening: Delete during in-flight update (F-2A)
  it('safely serializes deleteTrip when an updateTrip operation is already in-flight', async () => {
    const trip = await useTripStore.getState().createTrip(sampleConfig)

    const storage = getStorageContext()
    const originalUpdate = storage.trips.updateTrip.bind(storage.trips)

    let updateGateResolve!: () => void
    const updateGate = new Promise<void>((resolve) => {
      updateGateResolve = resolve
    })

    // Delay updateTrip inside storage
    vi.spyOn(storage.trips, 'updateTrip').mockImplementation(async (id, updates) => {
      await updateGate
      return originalUpdate(id, updates)
    })

    // Dispatch updateTrip
    const updatePromise = useTripStore.getState().updateTrip(trip.id, { name: 'Slow In-Flight Update' })

    // Immediately dispatch deleteTrip while updateTrip is waiting in storage
    const deletePromise = useTripStore.getState().deleteTrip(trip.id)

    // Release updateTrip
    updateGateResolve()

    await Promise.all([updatePromise, deletePromise])

    // Trip is completely deleted from storage and store without errors
    expect(await storage.trips.getTripById(trip.id)).toBeNull()
    expect(useTripStore.getState().trips.find((t) => t.id === trip.id)).toBeUndefined()
    expect(useTripStore.getState().error).toBeNull()
  })

  // 15. Concurrency hardening: Updates queued after deleteTrip (F-2B)
  it('ensures updates queued after deleteTrip cannot recreate the trip or generate errors', async () => {
    const trip = await useTripStore.getState().createTrip(sampleConfig)

    // Dispatch delete followed immediately by an update
    const deletePromise = useTripStore.getState().deleteTrip(trip.id)
    const updatePromise = useTripStore.getState().updateTrip(trip.id, { name: 'Attempted Post-Delete Update' })

    const [, updateResult] = await Promise.all([deletePromise, updatePromise])

    expect(updateResult).toBeNull()
    expect(useTripStore.getState().error).toBeNull()

    const storage = getStorageContext()
    expect(await storage.trips.getTripById(trip.id)).toBeNull()
    expect(useTripStore.getState().trips.find((t) => t.id === trip.id)).toBeUndefined()
  })

  // 16. Concurrency hardening: Queue recovery after rejection (F-4)
  it('recovers queue execution when one queued operation rejects so subsequent operations succeed', async () => {
    const trip = await useTripStore.getState().createTrip(sampleConfig)

    const storage = getStorageContext()
    // Force the first updateTrip storage write to reject
    vi.spyOn(storage.trips, 'updateTrip').mockRejectedValueOnce(new Error('Simulated disk IO write error'))

    // First operation fails
    const failedOp = useTripStore.getState().updateTrip(trip.id, { name: 'Failing Update' })
    // Second operation queued for the same trip should recover and succeed
    const successfulOp = useTripStore.getState().updateTrip(trip.id, { name: 'Successful Recovered Update' })

    const [res1, res2] = await Promise.all([failedOp, successfulOp])

    expect(res1).toBeNull() // failed op handled gracefully
    expect(res2?.name).toBe('Successful Recovered Update')

    const persisted = await storage.trips.getTripById(trip.id)
    expect(persisted?.name).toBe('Successful Recovered Update')
    expect(useTripStore.getState().activeTrip?.name).toBe('Successful Recovered Update')
  })
})
