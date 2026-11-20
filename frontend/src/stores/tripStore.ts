/**
 * PackPilot — Pure Zustand Trip Store
 * Manages trip lifecycle, active trip selection, and atomic persistence.
 */

import { create } from 'zustand'
import type { Trip, TripConfig, NormalizedTripContext } from '../types'
import { DEFAULT_BAGGAGE_CONFIG, getTotalTravellers } from '../types'
import type { StorageType } from '../db/interfaces'
import { getStorageContext, createStorageContext } from '../db/factory'
import { calculateDurationDays } from '../utils/dates'
import { generateRecommendations } from '../engine'
import { generateUUID } from '../utils/uuid'
import { useChecklistStore } from './checklistStore'
import { resolveTripContext, type ResolveContextOptions } from '../services/contextResolver'
import { enqueueTripOperation, clearTripQueue } from './mutationQueue'

export type TripResolutionStatus = 'idle' | 'resolving' | 'resolved' | 'failed'

export interface TripState {
  trips: Trip[]
  activeTrip: Trip | null
  isLoading: boolean
  isInitialized: boolean
  error: string | null
  storageType: StorageType
  isStorageAvailable: boolean
  resolutionStatus: Record<string, TripResolutionStatus>
  resolutionError: Record<string, string | null>

  // Actions
  initialize: (forcedType?: StorageType) => Promise<void>
  loadTrips: () => Promise<void>
  selectTrip: (id: string | null) => Promise<Trip | null>
  createTrip: (config: TripConfig) => Promise<Trip>
  updateTrip: (id: string, updates: Partial<TripConfig>) => Promise<Trip | null>
  deleteTrip: (id: string) => Promise<void>
  duplicateTrip: (id: string, newName?: string) => Promise<Trip>
  refreshTripContext: (tripId: string) => Promise<Trip | null>
  clearError: () => void
}

let activeInitPromise: Promise<void> | null = null

// Globally monotonic resolution token counter across the application session
let globalResolutionCounter = 0

// Per-trip active resolution version token to discard stale context resolutions
const tripResolutionTokens = new Map<string, number>()

/**
 * Generates a globally unique, monotonically increasing resolution token for a trip.
 * Guarantees that token values are never recycled or reset, preventing cross-trip
 * or temporal token collisions between pre- and post-restore resolutions.
 */
function nextResolutionToken(tripId: string): number {
  const token = ++globalResolutionCounter
  tripResolutionTokens.set(tripId, token)
  return token
}

export function _resetTripStoreTracking(): void {
  clearTripQueue()
  tripResolutionTokens.clear()
  globalResolutionCounter = 0
}

/**
 * Invalidates all active and pending background context resolutions across all trips.
 * Advances the active token for every currently tracked trip to a new globally unique
 * value so that any in-flight resolver (weather/geo) observes a token mismatch and
 * silently discards its result without persisting or updating Zustand stores.
 *
 * Does NOT clear the map, ensuring that any subsequent resolution token generated
 * for these trips or new trips will be strictly greater and never collide with
 * in-flight pre-invalidation resolvers.
 */
export function invalidateAllTripResolutionTokens(): void {
  for (const tripId of tripResolutionTokens.keys()) {
    tripResolutionTokens.set(tripId, ++globalResolutionCounter)
  }
}

function hasNetworkContextChange(current: Trip, updates: Partial<TripConfig>): boolean {
  if (updates.destination !== undefined && updates.destination.trim() !== current.destination.trim()) {
    return true
  }
  if (updates.origin !== undefined && (updates.origin?.trim() || '') !== (current.origin?.trim() || '')) {
    return true
  }
  if (updates.startDate !== undefined && updates.startDate !== current.startDate) {
    return true
  }
  if (updates.endDate !== undefined && updates.endDate !== current.endDate) {
    return true
  }
  if (
    updates.destinationLocation !== undefined &&
    JSON.stringify(updates.destinationLocation) !== JSON.stringify(current.destinationLocation)
  ) {
    return true
  }
  if (
    updates.originLocation !== undefined &&
    JSON.stringify(updates.originLocation) !== JSON.stringify(current.originLocation)
  ) {
    return true
  }
  return false
}

function hasLocalRegenChange(current: Trip, updates: Partial<TripConfig>): boolean {
  if (
    updates.transportModes !== undefined &&
    JSON.stringify(updates.transportModes) !== JSON.stringify(current.transportModes)
  ) {
    return true
  }
  if (updates.primaryTransport !== undefined && updates.primaryTransport !== current.primaryTransport) {
    return true
  }
  if (updates.overnightSelection !== undefined && updates.overnightSelection !== current.overnightSelection) {
    return true
  }
  if (
    updates.destinationMobility !== undefined &&
    JSON.stringify(updates.destinationMobility) !== JSON.stringify(current.destinationMobility)
  ) {
    return true
  }
  if (
    updates.travellers !== undefined &&
    JSON.stringify(updates.travellers) !== JSON.stringify(current.travellers)
  ) {
    return true
  }
  if (
    updates.activities !== undefined &&
    JSON.stringify(updates.activities) !== JSON.stringify(current.activities)
  ) {
    return true
  }
  if (updates.climate !== undefined && updates.climate !== current.climate) {
    return true
  }
  if (updates.accommodationType !== undefined && updates.accommodationType !== current.accommodationType) {
    return true
  }
  if (updates.hasLaundryAccess !== undefined && updates.hasLaundryAccess !== current.hasLaundryAccess) {
    return true
  }
  if (
    updates.personalPreferences !== undefined &&
    JSON.stringify(updates.personalPreferences) !== JSON.stringify(current.personalPreferences)
  ) {
    return true
  }
  return false
}

async function resolveAndReconcile(
  tripId: string,
  token: number,
  options?: ResolveContextOptions
): Promise<Trip | null> {
  try {
    const storage = getStorageContext()
    const trip = await storage.trips.getTripById(tripId)
    if (!trip) {
      return null
    }

    // Call ContextResolver asynchronously (does not lock queue)
    const resolvedContext = await resolveTripContext(trip, {
      ...options,
      tripId,
    })

    // Drop stale response immediately if token changed
    if (tripResolutionTokens.get(tripId) !== token) {
      return null
    }

    // Serialize persistence step in the trip's queue
    return await enqueueTripOperation(tripId, async () => {
      // Re-verify token inside serialized queue
      if (tripResolutionTokens.get(tripId) !== token) {
        return null
      }

      // Re-verify trip was not deleted while resolving
      const currentTrip = await storage.trips.getTripById(tripId)
      if (!currentTrip) {
        return null
      }

      // Read existing items and dismissed records for reconciliation
      const existingItems = await storage.items.getItemsForTrip(tripId)

      // Reconcile items using pure engine pipeline
      const { items: reconciledItems } = generateRecommendations(currentTrip, {
        existingItems,
        dismissedRecords: currentTrip.dismissedItems ?? [],
        tripId,
        normalizedContext: resolvedContext,
      })

      // Re-verify token before database write
      if (tripResolutionTokens.get(tripId) !== token) {
        return null
      }

      // Atomically persist ONLY normalizedContext alongside reconciled items
      await storage.trips.atomicUpdateTripAndItems(
        tripId,
        { normalizedContext: resolvedContext },
        reconciledItems
      )

      const updatedTrip = await storage.trips.getTripById(tripId)
      const finalTrip = updatedTrip ?? { ...currentTrip, normalizedContext: resolvedContext }

      useTripStore.setState((state) => {
        if (tripResolutionTokens.get(tripId) !== token) {
          return state
        }
        return {
          trips: state.trips.map((t) => (t.id === tripId ? finalTrip : t)),
          activeTrip: state.activeTrip?.id === tripId ? finalTrip : state.activeTrip,
          resolutionStatus: {
            ...state.resolutionStatus,
            [tripId]: 'resolved',
          },
          resolutionError: {
            ...state.resolutionError,
            [tripId]: null,
          },
        }
      })

      // Update active checklistStore ONLY if viewing this trip
      if (useChecklistStore.getState().tripId === tripId) {
        useChecklistStore.setState({ items: reconciledItems })
      }

      return finalTrip
    })
  } catch (err: unknown) {
    if (tripResolutionTokens.get(tripId) === token) {
      const errorMsg = err instanceof Error ? err.message : 'Context resolution failed'
      useTripStore.setState((state) => ({
        resolutionStatus: {
          ...state.resolutionStatus,
          [tripId]: 'failed',
        },
        resolutionError: {
          ...state.resolutionError,
          [tripId]: errorMsg,
        },
      }))
    }
    return null
  }
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: [],
  activeTrip: null,
  isLoading: true,
  isInitialized: false,
  error: null,
  storageType: 'memory',
  isStorageAvailable: false,
  resolutionStatus: {},
  resolutionError: {},

  initialize: async (forcedType?: StorageType) => {
    // Prevent redundant initialization if already initialized
    if (get().isInitialized && !forcedType) {
      return
    }

    // Deduplicate in-flight initialization (e.g. React StrictMode concurrent mount)
    if (activeInitPromise && !forcedType) {
      return activeInitPromise
    }

    set({ isLoading: true, error: null })

    activeInitPromise = (async () => {
      try {
        const storage = await createStorageContext(forcedType)
        const trips = await storage.trips.getAllTrips()
        const initialStatus: Record<string, TripResolutionStatus> = {}
        for (const t of trips) {
          initialStatus[t.id] = t.normalizedContext ? 'resolved' : 'idle'
        }

        set({
          trips,
          resolutionStatus: initialStatus,
          resolutionError: {},
          storageType: storage.storageType,
          isStorageAvailable: storage.isStorageAvailable,
          isInitialized: true,
          isLoading: false,
        })
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Storage initialization failed'
        set({
          error: errorMsg,
          isInitialized: true,
          isLoading: false,
          storageType: 'memory',
          isStorageAvailable: false,
          resolutionStatus: {},
          resolutionError: {},
        })
      } finally {
        activeInitPromise = null
      }
    })()

    return activeInitPromise
  },

  loadTrips: async () => {
    if (activeInitPromise) {
      await activeInitPromise
    }
    set({ isLoading: true, error: null })
    try {
      const storage = getStorageContext()
      const trips = await storage.trips.getAllTrips()
      const statusUpdates: Record<string, TripResolutionStatus> = { ...get().resolutionStatus }
      for (const t of trips) {
        if (!statusUpdates[t.id]) {
          statusUpdates[t.id] = t.normalizedContext ? 'resolved' : 'idle'
        }
      }
      set({ trips, resolutionStatus: statusUpdates, isLoading: false })
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load trips'
      set({ error: errorMsg, isLoading: false })
    }
  },

  selectTrip: async (id: string | null) => {
    if (activeInitPromise) {
      await activeInitPromise
    }
    if (!id) {
      set({ activeTrip: null })
      return null
    }

    // Check currently loaded trips first
    const inMemory = get().trips.find((t) => t.id === id)
    if (inMemory) {
      set({ activeTrip: inMemory })
      return inMemory
    }

    set({ isLoading: true, error: null })
    try {
      const storage = getStorageContext()
      const trip = await storage.trips.getTripById(id)
      set({ activeTrip: trip, isLoading: false })
      return trip
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : `Failed to load trip: ${id}`
      set({ error: errorMsg, isLoading: false })
      return null
    }
  },

  createTrip: async (config: TripConfig) => {
    if (activeInitPromise) {
      await activeInitPromise
    }
    set({ isLoading: true, error: null })
    try {
      const storage = getStorageContext()
      const tripId = generateUUID()
      const now = new Date().toISOString()
      const durationDays = calculateDurationDays(config.startDate, config.endDate)
      const totalTravellerCount = getTotalTravellers(config.travellers)

      const newTrip: Trip = {
        ...config,
        id: tripId,
        name: config.name.trim() || 'Untitled Trip',
        destination: config.destination.trim() || 'Unknown Destination',
        durationDays,
        totalTravellerCount,
        climate: config.climate || 'mixed',
        accommodationType: config.accommodationType,
        hasLaundryAccess: config.hasLaundryAccess,
        personalPreferences: config.personalPreferences || [],
        baggageConfig: {
          ...DEFAULT_BAGGAGE_CONFIG,
          ...config.baggageConfig,
        },
        dismissedItems: [],
        engineVersion: '1.0.0',
        createdAt: now,
        updatedAt: now,
      }

      // Generate initial recommendations using pure engine (offline/fallback)
      const { items } = generateRecommendations(newTrip, { tripId })

      // Atomically persist initial trip record and its generated child items
      await storage.trips.saveTripWithItems(newTrip, items)

      // Start resolution token tracking with globally monotonic generator
      const token = nextResolutionToken(tripId)

      set((state) => ({
        trips: [newTrip, ...state.trips],
        activeTrip: newTrip,
        isLoading: false,
        resolutionStatus: {
          ...state.resolutionStatus,
          [tripId]: 'resolving',
        },
        resolutionError: {
          ...state.resolutionError,
          [tripId]: null,
        },
      }))

      // Start background context resolution without awaiting it
      void resolveAndReconcile(tripId, token)

      return newTrip
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create trip'
      set({ error: errorMsg, isLoading: false })
      throw err
    }
  },

  updateTrip: async (id: string, updates: Partial<TripConfig>): Promise<Trip | null> => {
    return enqueueTripOperation(id, async () => {
      set({ isLoading: true, error: null })
      try {
        const storage = getStorageContext()
        const current = await storage.trips.getTripById(id)
        if (!current) {
          // If the trip was deleted while queued, return null safely without throwing misleading error
          set({ isLoading: false })
          return null
        }

        let durationDays = current.durationDays
        if (updates.startDate || updates.endDate) {
          const start = updates.startDate || current.startDate
          const end = updates.endDate || current.endDate
          durationDays = calculateDurationDays(start, end)
        }

        let totalTravellerCount = current.totalTravellerCount
        if (updates.travellers) {
          totalTravellerCount = getTotalTravellers(updates.travellers)
        }

        let baggageConfig = current.baggageConfig
        if (updates.baggageConfig) {
          baggageConfig = {
            ...current.baggageConfig,
            ...updates.baggageConfig,
          }
        }

        const networkChange = hasNetworkContextChange(current, updates)
        const localRegenChange = hasLocalRegenChange(current, updates)

        if (networkChange) {
          // Class 3: Network context resolution required (destination, origin, dates)
          const updatedFields: Partial<Trip> = {
            ...updates,
            durationDays,
            totalTravellerCount,
            baggageConfig,
            normalizedContext: undefined,
            updatedAt: new Date().toISOString(),
          }

          await storage.trips.updateTrip(id, updatedFields)

          const updatedTrip: Trip = {
            ...current,
            ...updatedFields,
          }

          const token = nextResolutionToken(id)

          set((state) => ({
            trips: state.trips.map((t) => (t.id === id ? updatedTrip : t)),
            activeTrip: state.activeTrip?.id === id ? updatedTrip : state.activeTrip,
            isLoading: false,
            resolutionStatus: {
              ...state.resolutionStatus,
              [id]: 'resolving',
            },
            resolutionError: {
              ...state.resolutionError,
              [id]: null,
            },
          }))

          void resolveAndReconcile(id, token)

          return updatedTrip
        } else if (localRegenChange) {
          // Class 2: Local regeneration without network calls
          let adaptedContext: NormalizedTripContext | undefined = current.normalizedContext
          if (adaptedContext) {
            adaptedContext = {
              ...adaptedContext,
              travellers: updates.travellers ?? current.travellers,
              hasLaundryAccess: Boolean(
                updates.hasLaundryAccess !== undefined
                  ? updates.hasLaundryAccess
                  : current.hasLaundryAccess
              ),
              activities: updates.activities ?? current.activities,
              accommodationType:
                updates.accommodationType !== undefined
                  ? updates.accommodationType
                  : current.accommodationType,
              personalPreferences: updates.personalPreferences ?? current.personalPreferences,
              baggageConfig,
              journey: {
                ...adaptedContext.journey,
                destinationMobility:
                  updates.destinationMobility ?? adaptedContext.journey.destinationMobility,
                overnightSelection:
                  updates.overnightSelection ?? adaptedContext.journey.overnightSelection,
                primaryTransport:
                  updates.transportModes?.[0] ??
                  (updates.primaryTransport ?? adaptedContext.journey.primaryTransport),
                secondaryTransportModes: updates.transportModes
                  ? updates.transportModes.slice(1)
                  : adaptedContext.journey.secondaryTransportModes,
              },
            }
          }

          const updatedFields: Partial<Trip> = {
            ...updates,
            durationDays,
            totalTravellerCount,
            baggageConfig,
            normalizedContext: adaptedContext,
            updatedAt: new Date().toISOString(),
          }

          const existingItems = await storage.items.getItemsForTrip(id)
          const mergedTrip: Trip = {
            ...current,
            ...updatedFields,
          }

          const { items: reconciledItems } = generateRecommendations(mergedTrip, {
            existingItems,
            dismissedRecords: current.dismissedItems ?? [],
            tripId: id,
            normalizedContext: adaptedContext,
          })

          await storage.trips.atomicUpdateTripAndItems(id, updatedFields, reconciledItems)

          set((state) => ({
            trips: state.trips.map((t) => (t.id === id ? mergedTrip : t)),
            activeTrip: state.activeTrip?.id === id ? mergedTrip : state.activeTrip,
            isLoading: false,
          }))

          if (useChecklistStore.getState().tripId === id) {
            useChecklistStore.setState({ items: reconciledItems })
          }

          return mergedTrip
        } else {
          // Class 1: Metadata-only updates (name, baggageConfig, specialRequirements)
          const updatedFields: Partial<Trip> = {
            ...updates,
            durationDays,
            totalTravellerCount,
            baggageConfig,
            updatedAt: new Date().toISOString(),
          }

          await storage.trips.updateTrip(id, updatedFields)

          const updatedTrip: Trip = {
            ...current,
            ...updatedFields,
          }

          set((state) => ({
            trips: state.trips.map((t) => (t.id === id ? updatedTrip : t)),
            activeTrip: state.activeTrip?.id === id ? updatedTrip : state.activeTrip,
            isLoading: false,
          }))

          return updatedTrip
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : `Failed to update trip: ${id}`
        set({ error: errorMsg, isLoading: false })
        return null
      }
    })
  },

  deleteTrip: async (id: string) => {
    // 1. Invalidate resolution token immediately to cancel background resolution
    nextResolutionToken(id)

    // 2. Serialize deletion through the per-trip queue so prior operations finish cleanly
    return enqueueTripOperation(id, async () => {
      set({ isLoading: true, error: null })
      try {
        const storage = getStorageContext()
        // Deletes trip and cascades to child items to prevent orphaned records
        await storage.trips.deleteTrip(id)

        // When deleting the active or currently loaded trip in checklist, clear its checklist state
        useChecklistStore.getState().clearChecklistIfTripMatches(id)

        set((state) => {
          const remainingStatus = { ...state.resolutionStatus }
          delete remainingStatus[id]
          const remainingErrors = { ...state.resolutionError }
          delete remainingErrors[id]

          return {
            trips: state.trips.filter((t) => t.id !== id),
            activeTrip: state.activeTrip?.id === id ? null : state.activeTrip,
            resolutionStatus: remainingStatus,
            resolutionError: remainingErrors,
            isLoading: false,
          }
        })

        // Clean up token tracking after deletion settles
        tripResolutionTokens.delete(id)
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : `Failed to delete trip: ${id}`
        set({ error: errorMsg, isLoading: false })
        throw err
      }
    })
  },

  duplicateTrip: async (id: string, newName?: string) => {
    set({ isLoading: true, error: null })
    try {
      const storage = getStorageContext()
      const duplicatedTrip = await storage.trips.duplicateTrip(id, undefined, newName)

      // Initialize distinct token for the duplicate trip with globally monotonic generator
      nextResolutionToken(duplicatedTrip.id)

      set((state) => ({
        trips: [duplicatedTrip, ...state.trips],
        activeTrip: duplicatedTrip,
        resolutionStatus: {
          ...state.resolutionStatus,
          [duplicatedTrip.id]: duplicatedTrip.normalizedContext ? 'resolved' : 'idle',
        },
        isLoading: false,
      }))

      return duplicatedTrip
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : `Failed to duplicate trip: ${id}`
      set({ error: errorMsg, isLoading: false })
      throw err
    }
  },

  refreshTripContext: async (tripId: string): Promise<Trip | null> => {
    const storage = getStorageContext()
    const trip = await storage.trips.getTripById(tripId)
    if (!trip) {
      throw new Error(`Trip not found: ${tripId}`)
    }

    const token = nextResolutionToken(tripId)

    set((state) => ({
      resolutionStatus: {
        ...state.resolutionStatus,
        [tripId]: 'resolving',
      },
      resolutionError: {
        ...state.resolutionError,
        [tripId]: null,
      },
    }))

    return await resolveAndReconcile(tripId, token)
  },

  clearError: () => set({ error: null }),
}))
