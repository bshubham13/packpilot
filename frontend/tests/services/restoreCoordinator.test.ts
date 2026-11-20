import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createStorageContext, setStorageContext } from '../../src/db/factory'
import { getSharedMemoryState } from '../../src/db/memory/memoryStorage'
import { coordinateRestore } from '../../src/services/restoreCoordinator'
import {
  enqueueTripOperation,
  clearTripQueue,
  isMutationBarrierActive,
  _resetMutationQueueForTests,
} from '../../src/stores/mutationQueue'
import { useTripStore, _resetTripStoreTracking } from '../../src/stores/tripStore'
import { useChecklistStore } from '../../src/stores/checklistStore'
import type { Trip, PackingItem } from '../../src/types'
import { DEFAULT_BAGGAGE_CONFIG } from '../../src/types'
import {
  PACKPILOT_APP_ID,
  CURRENT_BACKUP_SCHEMA_VERSION,
  type PackPilotBackupPayload,
} from '../../src/types/backup'

function createSampleTrip(id = 'trip-1', name = 'Swiss Alps'): Trip {
  return {
    id,
    name,
    destination: 'Zermatt, Switzerland',
    origin: 'Geneva, Switzerland',
    startDate: '2026-08-01',
    endDate: '2026-08-07',
    durationDays: 7,
    totalTravellerCount: 2,
    transportModes: ['train'],
    activities: ['trekking'],
    climate: 'mixed',
    accommodationType: 'hotel',
    travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 0 },
    personalPreferences: [],
    baggageConfig: DEFAULT_BAGGAGE_CONFIG,
    dismissedItems: [],
    engineVersion: '1.4.0',
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-08-01T08:00:00Z',
  }
}

function createSampleItem(id = 'item-1', tripId = 'trip-1', name = 'Hiking Socks'): PackingItem {
  return {
    id,
    tripId,
    name,
    itemSlug: 'wear-hiking-socks',
    category: 'clothing',
    priority: 'recommended',
    quantityStrategy: 'fixed',
    generatedQuantity: 3,
    effectiveQuantity: 3,
    packedQuantity: 1,
    isPacked: false,
    isShared: false,
    isCustom: false,
    reasons: ['Hiking'],
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-08-01T08:00:00Z',
  }
}

describe('Restore Lifecycle Coordinator & Concurrency Safeguards', () => {
  let storage: Awaited<ReturnType<typeof createStorageContext>>

  beforeEach(async () => {
    getSharedMemoryState().clear()
    _resetMutationQueueForTests()
    _resetTripStoreTracking()

    storage = await createStorageContext('memory')
    setStorageContext(storage)

    useTripStore.setState({
      trips: [],
      activeTrip: null,
      isLoading: false,
      error: null,
    })

    useChecklistStore.setState({
      tripId: null,
      items: [],
      dismissedRecords: [],
      error: null,
      isLoading: false,
    })
  })

  // 1. Happy-path full replace store sync
  it('synchronizes tripStore and checklistStore after successful replace restore', async () => {
    const oldTrip = createSampleTrip('old-trip-1', 'Old Paris Trip')
    const oldItem = createSampleItem('old-item-1', 'old-trip-1', 'Old Passport')
    await storage.trips.saveTripWithItems(oldTrip, [oldItem])
    await useTripStore.getState().loadTrips()
    await useTripStore.getState().selectTrip(oldTrip.id)
    await useChecklistStore.getState().loadItems(oldTrip.id)

    expect(useTripStore.getState().trips).toHaveLength(1)
    expect(useTripStore.getState().activeTrip?.id).toBe('old-trip-1')
    expect(useChecklistStore.getState().items).toHaveLength(1)

    const newTrip = createSampleTrip('new-trip-1', 'New Tokyo Safari')
    const newItem = createSampleItem('new-item-1', 'new-trip-1', 'Tokyo Map')
    const backup: PackPilotBackupPayload = {
      app: PACKPILOT_APP_ID,
      version: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-08-01T00:00:00Z',
      trips: [newTrip],
      items: [newItem],
      templates: [],
    }

    const result = await coordinateRestore(backup, { mode: 'replace' })

    expect(result.success).toBe(true)
    expect(result.storageCommitted).toBe(true)
    expect(result.imported.trips).toBe(1)
    expect(result.imported.items).toBe(1)

    const trips = useTripStore.getState().trips
    expect(trips).toHaveLength(1)
    expect(trips[0].id).toBe('new-trip-1')
    expect(trips[0].name).toBe('New Tokyo Safari')

    expect(useTripStore.getState().activeTrip).toBeNull()
    expect(useChecklistStore.getState().tripId).toBeNull()
    expect(useChecklistStore.getState().items).toHaveLength(0)
    expect(isMutationBarrierActive()).toBe(false)
  })

  // 2. Active trip retention and checklist reload
  it('reloads active trip checklist if active trip still exists after restore', async () => {
    const trip1 = createSampleTrip('trip-1', 'Original Trip 1')
    const item1 = createSampleItem('item-1', 'trip-1', 'Original Socks')
    await storage.trips.saveTripWithItems(trip1, [item1])
    await useTripStore.getState().loadTrips()
    await useTripStore.getState().selectTrip(trip1.id)
    await useChecklistStore.getState().loadItems(trip1.id)

    expect(useChecklistStore.getState().items[0].name).toBe('Original Socks')

    const updatedTrip1 = createSampleTrip('trip-1', 'Updated Trip 1 Name')
    const updatedItem1 = createSampleItem('item-1', 'trip-1', 'Restored Wool Socks')
    const backup: PackPilotBackupPayload = {
      app: PACKPILOT_APP_ID,
      version: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-08-01T00:00:00Z',
      trips: [updatedTrip1],
      items: [updatedItem1],
      templates: [],
    }

    const result = await coordinateRestore(backup, {
      mode: 'merge',
      conflictStrategy: 'overwrite',
    })

    expect(result.success).toBe(true)
    expect(result.storageCommitted).toBe(true)
    expect(useTripStore.getState().activeTrip?.name).toBe('Updated Trip 1 Name')
    expect(useChecklistStore.getState().tripId).toBe('trip-1')
    expect(useChecklistStore.getState().items[0].name).toBe('Restored Wool Socks')
  })

  // 3. Fix 1: At least 3 same-trip operations queued during restore execute in strict FIFO order without overlap
  it('Fix 1: enqueues three same-trip operations during restore and executes strictly in FIFO order without overlap', async () => {
    const trip1 = createSampleTrip('trip-1')
    await storage.trips.saveTripWithItems(trip1, [])
    await useTripStore.getState().loadTrips()

    const executionLog: Array<{ event: string; timestamp: number }> = []
    let restoreFinished = false

    const originalRestore = storage.backup.atomicRestore.bind(storage.backup)
    const queuedPromises: Array<Promise<void>> = []

    vi.spyOn(storage.backup, 'atomicRestore').mockImplementation(async (...args) => {
      // While restore is active in storage, enqueue 3 mutations for the same trip
      queuedPromises.push(
        enqueueTripOperation('trip-1', async () => {
          expect(restoreFinished).toBe(true)
          executionLog.push({ event: 'op1-start', timestamp: Date.now() })
          await new Promise((r) => setTimeout(r, 20))
          executionLog.push({ event: 'op1-end', timestamp: Date.now() })
        })
      )

      queuedPromises.push(
        enqueueTripOperation('trip-1', async () => {
          expect(restoreFinished).toBe(true)
          executionLog.push({ event: 'op2-start', timestamp: Date.now() })
          await new Promise((r) => setTimeout(r, 15))
          executionLog.push({ event: 'op2-end', timestamp: Date.now() })
        })
      )

      queuedPromises.push(
        enqueueTripOperation('trip-1', async () => {
          expect(restoreFinished).toBe(true)
          executionLog.push({ event: 'op3-start', timestamp: Date.now() })
          await new Promise((r) => setTimeout(r, 10))
          executionLog.push({ event: 'op3-end', timestamp: Date.now() })
        })
      )

      await new Promise((r) => setTimeout(r, 25))
      const res = await originalRestore(...args)
      restoreFinished = true
      return res
    })

    const backup: PackPilotBackupPayload = {
      app: PACKPILOT_APP_ID,
      version: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-08-01T00:00:00Z',
      trips: [createSampleTrip('trip-1', 'Restored Name')],
      items: [],
      templates: [],
    }

    const restoreResult = await coordinateRestore(backup, { mode: 'replace' })
    expect(restoreResult.success).toBe(true)

    // Wait for all 3 queued operations to finish
    await Promise.all(queuedPromises)

    const events = executionLog.map((e) => e.event)
    expect(events).toEqual([
      'op1-start',
      'op1-end',
      'op2-start',
      'op2-end',
      'op3-start',
      'op3-end',
    ])

    // Verify non-overlapping execution (op2 starts after op1 ends; op3 starts after op2 ends)
    const op1End = executionLog.find((e) => e.event === 'op1-end')!.timestamp
    const op2Start = executionLog.find((e) => e.event === 'op2-start')!.timestamp
    const op2End = executionLog.find((e) => e.event === 'op2-end')!.timestamp
    const op3Start = executionLog.find((e) => e.event === 'op3-start')!.timestamp

    expect(op2Start).toBeGreaterThanOrEqual(op1End)
    expect(op3Start).toBeGreaterThanOrEqual(op2End)
  })

  // 4. Fix 1: Rejection in a queued operation does not halt subsequent same-trip operations
  it('Fix 1: continues same-trip FIFO execution when an operation queued during barrier rejects', async () => {
    const trip1 = createSampleTrip('trip-1')
    await storage.trips.saveTripWithItems(trip1, [])

    const originalRestore = storage.backup.atomicRestore.bind(storage.backup)
    let op1Promise!: Promise<void>
    let op2Promise!: Promise<string>

    vi.spyOn(storage.backup, 'atomicRestore').mockImplementation(async (...args) => {
      op1Promise = enqueueTripOperation('trip-1', async () => {
        throw new Error('Op 1 Failed Intentionally')
      })
      // Attach early catch listener to prevent Node unhandled rejection before assertion
      op1Promise.catch(() => {})

      op2Promise = enqueueTripOperation('trip-1', async () => {
        return 'op 2 success'
      })

      return await originalRestore(...args)
    })

    const backup: PackPilotBackupPayload = {
      app: PACKPILOT_APP_ID,
      version: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-08-01T00:00:00Z',
      trips: [trip1],
      items: [],
      templates: [],
    }

    await coordinateRestore(backup, { mode: 'replace' })

    await expect(op1Promise).rejects.toThrow('Op 1 Failed Intentionally')
    const op2Result = await op2Promise
    expect(op2Result).toBe('op 2 success')
  })

  // 5. Fix 2: Globally monotonic resolution tokens prevent stale resolution overwrites
  it('Fix 2: prevents stale pre-restore resolution from overwriting restored data even when user immediately starts a new resolution', async () => {
    // 1. Initial state has trip-1
    const trip1 = createSampleTrip('trip-1', 'Initial Destination')
    await storage.trips.saveTripWithItems(trip1, [])
    await useTripStore.getState().loadTrips()

    // 2. Trigger an update that starts background resolution
    // Simulate a slow network response that resolves AFTER restore and after a second update
    let slowNetworkCallback!: (value: unknown) => void
    const slowWeatherPromise = new Promise((resolve) => {
      slowNetworkCallback = resolve
    })

    // Spy on weather / context resolving
    const resolverModule = await import('../../src/services/contextResolver')
    vi.spyOn(resolverModule, 'resolveTripContext').mockImplementation(async () => {
      await slowWeatherPromise
      return {
        resolvedAt: '2026-08-01T00:00:00Z',
        source: 'online' as const,
        weather: {
          destination: 'Tokyo, Japan',
          temperatureRange: { min: 20, max: 28 },
          conditions: ['rainy'],
          confidence: 'high' as const,
          dailyForecast: [],
        },
      }
    })

    // Start resolution 1 (token = 1)
    const updatePromise1 = useTripStore.getState().updateTrip('trip-1', {
      destination: 'Tokyo, Japan',
    })

    // 3. Backup restore runs while resolution 1 is in-flight
    const backup: PackPilotBackupPayload = {
      app: PACKPILOT_APP_ID,
      version: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-08-01T00:00:00Z',
      trips: [createSampleTrip('trip-1', 'Restored Safe Trip')],
      items: [],
      templates: [],
    }

    const restoreResult = await coordinateRestore(backup, { mode: 'replace' })
    expect(restoreResult.success).toBe(true)

    // 4. Immediately after restore, user updates trip-1 (starting resolution 2)
    const updatePromise2 = useTripStore.getState().updateTrip('trip-1', {
      name: 'User Edited Name Post-Restore',
    })

    // 5. Now the stale resolution 1 finally finishes
    slowNetworkCallback(true)
    await updatePromise1
    await updatePromise2

    // The stale pre-restore resolution must NOT overwrite restored data
    const finalTrip = useTripStore.getState().trips.find((t) => t.id === 'trip-1')
    expect(finalTrip?.name).toBe('User Edited Name Post-Restore')
    expect(finalTrip?.normalizedContext?.weather?.conditions).toBeUndefined()
  })

  // 6. Fix 3: Trip store synchronization failure handling
  it('Fix 3: accurately reports post-restore synchronization failure when tripStore.loadTrips fails', async () => {
    const trip1 = createSampleTrip('trip-1')
    await storage.trips.saveTripWithItems(trip1, [])
    await useTripStore.getState().loadTrips()

    // Mock getAllTrips to throw when loadTrips is called
    vi.spyOn(storage.trips, 'getAllTrips').mockRejectedValueOnce(
      new Error('IndexedDB Read Failure')
    )

    const backup: PackPilotBackupPayload = {
      app: PACKPILOT_APP_ID,
      version: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-08-01T00:00:00Z',
      trips: [createSampleTrip('trip-restored', 'Restored In DB')],
      items: [],
      templates: [],
    }

    const result = await coordinateRestore(backup, { mode: 'replace' })

    // Must report success: false, but storageCommitted: true
    expect(result.success).toBe(false)
    expect(result.storageCommitted).toBe(true)
    expect(result.syncError).toContain('IndexedDB Read Failure')
    expect(result.errors[0]).toContain('Please reload the application')

    // Barrier must still be safely released
    expect(isMutationBarrierActive()).toBe(false)

    // Storage actually contains the committed restored trip
    const storedTrip = await storage.trips.getTripById('trip-restored')
    expect(storedTrip?.name).toBe('Restored In DB')
  })

  // 7. Fix 3: Checklist store synchronization failure handling
  it('Fix 3: accurately reports post-restore synchronization failure when checklistStore.loadItems fails', async () => {
    const trip1 = createSampleTrip('trip-1')
    await storage.trips.saveTripWithItems(trip1, [])
    await useTripStore.getState().loadTrips()
    await useTripStore.getState().selectTrip('trip-1')
    useChecklistStore.setState({ tripId: 'trip-1' })

    // Mock getItemsForTrip to throw when checklistStore.loadItems runs
    vi.spyOn(storage.items, 'getItemsForTrip').mockRejectedValueOnce(
      new Error('Checklist Read Corrupted')
    )

    const backup: PackPilotBackupPayload = {
      app: PACKPILOT_APP_ID,
      version: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-08-01T00:00:00Z',
      trips: [createSampleTrip('trip-1', 'Active Trip Restored')],
      items: [],
      templates: [],
    }

    const result = await coordinateRestore(backup, { mode: 'replace' })

    expect(result.success).toBe(false)
    expect(result.storageCommitted).toBe(true)
    expect(result.syncError).toContain('Checklist Read Corrupted')
    expect(result.errors[0]).toContain('Please re-select the trip')
    expect(isMutationBarrierActive()).toBe(false)
  })

  // 8. Fix 4: clearTripQueue does not clear or break active production barrier
  it('Fix 4: protects active barrier from being broken by clearTripQueue', async () => {
    const trip1 = createSampleTrip('trip-1')
    await storage.trips.saveTripWithItems(trip1, [])

    const originalRestore = storage.backup.atomicRestore.bind(storage.backup)
    let mutationExecuted = false
    let mutationPromise!: Promise<void>

    vi.spyOn(storage.backup, 'atomicRestore').mockImplementation(async (...args) => {
      // Call clearTripQueue while barrier is active
      clearTripQueue()

      // The barrier must STILL be active
      expect(isMutationBarrierActive()).toBe(true)

      // Enqueue a mutation; it must NOT run concurrently with restore
      mutationPromise = enqueueTripOperation('trip-1', async () => {
        mutationExecuted = true
      })

      await new Promise((r) => setTimeout(r, 20))
      // Mutation has NOT executed yet
      expect(mutationExecuted).toBe(false)

      return await originalRestore(...args)
    })

    const backup: PackPilotBackupPayload = {
      app: PACKPILOT_APP_ID,
      version: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-08-01T00:00:00Z',
      trips: [createSampleTrip('trip-1')],
      items: [],
      templates: [],
    }

    await coordinateRestore(backup, { mode: 'replace' })
    if (mutationPromise) await mutationPromise

    // Mutation executes only after barrier is released
    expect(mutationExecuted).toBe(true)
    expect(isMutationBarrierActive()).toBe(false)
  })

  // 9. Concurrency: Multiple existing mutations across different trips before restore
  it('waits for multiple mutations across different trips to settle before restore begins', async () => {
    const trip1 = createSampleTrip('trip-1')
    const trip2 = createSampleTrip('trip-2')
    const trip3 = createSampleTrip('trip-3')
    await storage.trips.saveTripWithItems(trip1, [])
    await storage.trips.saveTripWithItems(trip2, [])
    await storage.trips.saveTripWithItems(trip3, [])

    const completed: string[] = []

    const op1 = enqueueTripOperation('trip-1', async () => {
      await new Promise((r) => setTimeout(r, 20))
      completed.push('trip-1-settled')
    })
    const op2 = enqueueTripOperation('trip-2', async () => {
      await new Promise((r) => setTimeout(r, 30))
      completed.push('trip-2-settled')
    })
    const op3 = enqueueTripOperation('trip-3', async () => {
      await new Promise((r) => setTimeout(r, 10))
      completed.push('trip-3-settled')
    })

    const backup: PackPilotBackupPayload = {
      app: PACKPILOT_APP_ID,
      version: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-08-01T00:00:00Z',
      trips: [createSampleTrip('restored-all')],
      items: [],
      templates: [],
    }

    const restorePromise = coordinateRestore(backup, { mode: 'replace' }).then((res) => {
      completed.push('restore-finished')
      return res
    })

    await Promise.all([op1, op2, op3, restorePromise])

    expect(completed).toContain('trip-1-settled')
    expect(completed).toContain('trip-2-settled')
    expect(completed).toContain('trip-3-settled')
    expect(completed[3]).toBe('restore-finished')
  })

  // 10. Concurrency: In-flight mutation rejection does not halt barrier
  it('proceeds with restore even if an existing in-flight mutation rejects', async () => {
    const failingOp = enqueueTripOperation('trip-1', async () => {
      await new Promise((r) => setTimeout(r, 10))
      throw new Error('Pre-existing mutation failed')
    })
    failingOp.catch(() => {})

    const backup: PackPilotBackupPayload = {
      app: PACKPILOT_APP_ID,
      version: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-08-01T00:00:00Z',
      trips: [createSampleTrip('clean-restored-trip')],
      items: [],
      templates: [],
    }

    const [restoreResult] = await Promise.allSettled([
      coordinateRestore(backup, { mode: 'replace' }),
      failingOp,
    ])

    expect(restoreResult.status).toBe('fulfilled')
    if (restoreResult.status === 'fulfilled') {
      expect(restoreResult.value.success).toBe(true)
    }
    expect(useTripStore.getState().trips[0].id).toBe('clean-restored-trip')
  })

  // 11. Concurrency: Two concurrent restore requests serialize cleanly
  it('serializes two concurrent restore requests without collision', async () => {
    const backup1: PackPilotBackupPayload = {
      app: PACKPILOT_APP_ID,
      version: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-08-01T00:00:00Z',
      trips: [createSampleTrip('trip-v1', 'Version 1')],
      items: [],
      templates: [],
    }

    const backup2: PackPilotBackupPayload = {
      app: PACKPILOT_APP_ID,
      version: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-08-01T00:00:00Z',
      trips: [createSampleTrip('trip-v2', 'Version 2')],
      items: [],
      templates: [],
    }

    // Fire both restores concurrently
    const [res1, res2] = await Promise.all([
      coordinateRestore(backup1, { mode: 'replace' }),
      coordinateRestore(backup2, { mode: 'replace' }),
    ])

    expect(res1.success).toBe(true)
    expect(res2.success).toBe(true)
    expect(isMutationBarrierActive()).toBe(false)

    // Second restore was serialized and finished last
    expect(useTripStore.getState().trips[0].name).toBe('Version 2')
  })

  // 12. Storage restore failure releases barrier and marks storageCommitted: false
  it('releases mutation barrier and marks storageCommitted false when atomic restore fails', async () => {
    vi.spyOn(storage.backup, 'atomicRestore').mockRejectedValueOnce(
      new Error('Catastrophic Disk Crash')
    )

    const backup: PackPilotBackupPayload = {
      app: PACKPILOT_APP_ID,
      version: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-08-01T00:00:00Z',
      trips: [createSampleTrip('trip-new')],
      items: [],
      templates: [],
    }

    const result = await coordinateRestore(backup, { mode: 'replace' })

    expect(result.success).toBe(false)
    expect(result.storageCommitted).toBe(false)
    expect(result.errors[0]).toContain('Catastrophic Disk Crash')
    expect(isMutationBarrierActive()).toBe(false)

    // Normal queue operations execute without blocking
    let subsequentExecuted = false
    await enqueueTripOperation('trip-1', async () => {
      subsequentExecuted = true
    })
    expect(subsequentExecuted).toBe(true)
  })
})
