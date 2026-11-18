/**
 * PackPilot — Pure Zustand Trip Store
 * Manages trip lifecycle, active trip selection, and atomic persistence.
 */

import { create } from 'zustand'
import type { Trip, TripConfig } from '../types'
import { DEFAULT_BAGGAGE_CONFIG, getTotalTravellers } from '../types'
import type { StorageType } from '../db/interfaces'
import { getStorageContext, createStorageContext } from '../db/factory'
import { calculateDurationDays } from '../utils/dates'
import { generateRecommendations } from '../engine'
import { generateUUID } from '../utils/uuid'
import { useChecklistStore } from './checklistStore'

export interface TripState {
  trips: Trip[]
  activeTrip: Trip | null
  isLoading: boolean
  error: string | null
  storageType: StorageType
  isStorageAvailable: boolean

  // Actions
  initialize: (forcedType?: StorageType) => Promise<void>
  loadTrips: () => Promise<void>
  selectTrip: (id: string | null) => Promise<Trip | null>
  createTrip: (config: TripConfig) => Promise<Trip>
  updateTrip: (id: string, updates: Partial<TripConfig>) => Promise<Trip | null>
  deleteTrip: (id: string) => Promise<void>
  duplicateTrip: (id: string, newName?: string) => Promise<Trip>
  clearError: () => void
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: [],
  activeTrip: null,
  isLoading: false,
  error: null,
  storageType: 'memory',
  isStorageAvailable: false,

  initialize: async (forcedType?: StorageType) => {
    set({ isLoading: true, error: null })
    try {
      const storage = await createStorageContext(forcedType)
      const trips = await storage.trips.getAllTrips()
      set({
        trips,
        storageType: storage.storageType,
        isStorageAvailable: storage.isStorageAvailable,
        isLoading: false,
      })
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Storage initialization failed'
      set({
        error: errorMsg,
        isLoading: false,
        storageType: 'memory',
        isStorageAvailable: false,
      })
    }
  },

  loadTrips: async () => {
    set({ isLoading: true, error: null })
    try {
      const storage = getStorageContext()
      const trips = await storage.trips.getAllTrips()
      set({ trips, isLoading: false })
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load trips'
      set({ error: errorMsg, isLoading: false })
    }
  },

  selectTrip: async (id: string | null) => {
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

      // Generate initial recommendations using pure engine
      const { items } = generateRecommendations(newTrip, { tripId })

      // Atomically persist trip record and its generated child items
      await storage.trips.saveTripWithItems(newTrip, items)

      set((state) => ({
        trips: [newTrip, ...state.trips],
        activeTrip: newTrip,
        isLoading: false,
      }))

      return newTrip
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create trip'
      set({ error: errorMsg, isLoading: false })
      throw err
    }
  },

  updateTrip: async (id: string, updates: Partial<TripConfig>) => {
    set({ isLoading: true, error: null })
    try {
      const storage = getStorageContext()
      const current = get().trips.find((t) => t.id === id) || (await storage.trips.getTripById(id))
      if (!current) {
        throw new Error(`Trip not found: ${id}`)
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
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : `Failed to update trip: ${id}`
      set({ error: errorMsg, isLoading: false })
      return null
    }
  },

  deleteTrip: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const storage = getStorageContext()
      // Deletes trip and cascades to child items to prevent orphaned records
      await storage.trips.deleteTrip(id)

      // When deleting the active or currently loaded trip in checklist, clear its checklist state
      useChecklistStore.getState().clearChecklistIfTripMatches(id)

      set((state) => ({
        trips: state.trips.filter((t) => t.id !== id),
        activeTrip: state.activeTrip?.id === id ? null : state.activeTrip,
        isLoading: false,
      }))
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : `Failed to delete trip: ${id}`
      set({ error: errorMsg, isLoading: false })
      throw err
    }
  },

  duplicateTrip: async (id: string, newName?: string) => {
    set({ isLoading: true, error: null })
    try {
      const storage = getStorageContext()
      const duplicatedTrip = await storage.trips.duplicateTrip(id, undefined, newName)

      set((state) => ({
        trips: [duplicatedTrip, ...state.trips],
        activeTrip: duplicatedTrip,
        isLoading: false,
      }))

      return duplicatedTrip
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : `Failed to duplicate trip: ${id}`
      set({ error: errorMsg, isLoading: false })
      throw err
    }
  },

  clearError: () => set({ error: null }),
}))
