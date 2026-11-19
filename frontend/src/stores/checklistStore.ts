/**
 * PackPilot — Pure Zustand Checklist Store
 * Manages item packing state, partial packing progress, dismissals, and reconciliation.
 */

import { create } from 'zustand'
import type {
  Trip,
  PackingItem,
  DismissedItemRecord,
  PackingCategory,
  ItemPriority,
  TripConfig,
  BagAssignment,
} from '../types'
import { getStorageContext } from '../db/factory'
import { generateRecommendations } from '../engine'
import { generateUUID } from '../utils/uuid'
import { enqueueTripOperation } from './mutationQueue'

export type FilterStatus = 'all' | 'unpacked' | 'packed' | 'critical'

export interface ChecklistState {
  tripId: string | null
  items: PackingItem[]
  dismissedRecords: DismissedItemRecord[]
  activeCategory: PackingCategory | 'all'
  filterStatus: FilterStatus
  searchQuery: string
  isLoading: boolean
  error: string | null

  // Actions
  loadItems: (tripId: string) => Promise<void>
  togglePacked: (itemId: string) => Promise<void>
  setPackedQuantity: (itemId: string, packedQuantity: number) => Promise<void>
  updateItemQuantity: (itemId: string, userQuantity: number) => Promise<void>
  setBagAssignment: (itemId: string, assignment: BagAssignment | undefined) => Promise<void>
  updateItem: (
    itemId: string,
    updates: {
      name?: string
      category?: PackingCategory
      priority?: ItemPriority
      quantity?: number
      weightGrams?: number
      bagAssignment?: BagAssignment
      notes?: string
    }
  ) => Promise<PackingItem | undefined>
  addCustomItem: (itemData: {
    name: string
    category: PackingCategory
    quantity?: number
    priority?: ItemPriority
    weightGrams?: number
    bagAssignment?: BagAssignment
    isShared?: boolean
    notes?: string
  }) => Promise<PackingItem>
  deleteItem: (itemId: string) => Promise<void>
  dismissItem: (itemId: string) => Promise<DismissedItemRecord>
  restoreDismissedItem: (itemSlug: string) => Promise<PackingItem>
  regenerateChecklist: (tripConfig: TripConfig) => Promise<void>
  setActiveCategory: (category: PackingCategory | 'all') => void
  setFilterStatus: (status: FilterStatus) => void
  setSearchQuery: (query: string) => void
  clearFilters: () => void
  clearError: () => void
  clearChecklistIfTripMatches: (tripId: string) => void
  resetChecklist: () => void
}

let latestLoadRequestId = 0

export const useChecklistStore = create<ChecklistState>((set, get) => ({
  tripId: null,
  items: [],
  dismissedRecords: [],
  activeCategory: 'all',
  filterStatus: 'all',
  searchQuery: '',
  isLoading: false,
  error: null,

  loadItems: async (tripId: string) => {
    const currentRequestId = ++latestLoadRequestId
    set({ isLoading: true, error: null, tripId })
    try {
      const storage = getStorageContext()
      const [items, trip] = await Promise.all([
        storage.items.getItemsForTrip(tripId),
        storage.trips.getTripById(tripId),
      ])

      // Drop response if user navigated away or a newer load request was initiated
      if (get().tripId !== tripId || currentRequestId !== latestLoadRequestId) {
        return
      }

      set({
        items,
        dismissedRecords: trip?.dismissedItems || [],
        isLoading: false,
      })
    } catch (err: unknown) {
      // Ignore errors from stale / superseded requests
      if (get().tripId !== tripId || currentRequestId !== latestLoadRequestId) {
        return
      }
      const errorMsg = err instanceof Error ? err.message : `Failed to load items for trip: ${tripId}`
      set({ error: errorMsg, isLoading: false })
    }
  },

  togglePacked: async (itemId: string) => {
    const item = get().items.find((i) => i.id === itemId)
    const tripId = get().tripId || item?.tripId
    const op = async () => {
      const currentItem = get().items.find((i) => i.id === itemId)
      if (!currentItem) return

      // If fully packed, toggle to 0; otherwise toggle to effectiveQuantity
      const newPackedQty = currentItem.isPacked ? 0 : currentItem.effectiveQuantity
      const isPacked = newPackedQty >= currentItem.effectiveQuantity && currentItem.effectiveQuantity > 0

      // Optimistic in-memory update
      set((state) => ({
        items: state.items.map((i) =>
          i.id === itemId
            ? { ...i, packedQuantity: newPackedQty, isPacked, updatedAt: new Date().toISOString() }
            : i
        ),
      }))

      try {
        const storage = getStorageContext()
        await storage.items.updatePackedQuantity(itemId, newPackedQty)
      } catch (err: unknown) {
        // Rollback on failure
        set((state) => ({
          items: state.items.map((i) => (i.id === itemId ? currentItem : i)),
          error: err instanceof Error ? err.message : 'Failed to update packed state',
        }))
      }
    }
    return tripId ? enqueueTripOperation(tripId, op) : op()
  },

  setPackedQuantity: async (itemId: string, packedQuantity: number) => {
    const item = get().items.find((i) => i.id === itemId)
    const tripId = get().tripId || item?.tripId
    const op = async () => {
      const currentItem = get().items.find((i) => i.id === itemId)
      if (!currentItem) return

      const clampedPacked = Math.max(0, Math.min(packedQuantity, currentItem.effectiveQuantity))
      const isPacked = currentItem.effectiveQuantity > 0 && clampedPacked >= currentItem.effectiveQuantity

      // Optimistic in-memory update
      set((state) => ({
        items: state.items.map((i) =>
          i.id === itemId
            ? { ...i, packedQuantity: clampedPacked, isPacked, updatedAt: new Date().toISOString() }
            : i
        ),
      }))

      try {
        const storage = getStorageContext()
        await storage.items.updatePackedQuantity(itemId, clampedPacked)
      } catch (err: unknown) {
        set((state) => ({
          items: state.items.map((i) => (i.id === itemId ? currentItem : i)),
          error: err instanceof Error ? err.message : 'Failed to update packed quantity',
        }))
      }
    }
    return tripId ? enqueueTripOperation(tripId, op) : op()
  },

  updateItemQuantity: async (itemId: string, userQuantity: number) => {
    const item = get().items.find((i) => i.id === itemId)
    const tripId = get().tripId || item?.tripId
    const op = async () => {
      const currentItem = get().items.find((i) => i.id === itemId)
      if (!currentItem) return

      const safeQty = Math.max(1, Math.round(userQuantity || 1))
      const clampedPacked = Math.min(currentItem.packedQuantity, safeQty)
      const isPacked = safeQty > 0 && clampedPacked >= safeQty

      // Optimistic in-memory update
      set((state) => ({
        items: state.items.map((i) =>
          i.id === itemId
            ? {
                ...i,
                userAdjustedQuantity: safeQty,
                effectiveQuantity: safeQty,
                packedQuantity: clampedPacked,
                isPacked,
                updatedAt: new Date().toISOString(),
              }
            : i
        ),
      }))

      try {
        const storage = getStorageContext()
        await storage.items.updateItemQuantity(itemId, safeQty)
      } catch (err: unknown) {
        set((state) => ({
          items: state.items.map((i) => (i.id === itemId ? currentItem : i)),
          error: err instanceof Error ? err.message : 'Failed to update quantity',
        }))
      }
    }
    return tripId ? enqueueTripOperation(tripId, op) : op()
  },

  setBagAssignment: async (itemId: string, assignment: BagAssignment | undefined) => {
    const item = get().items.find((i) => i.id === itemId)
    const tripId = get().tripId || item?.tripId
    const op = async () => {
      const currentItem = get().items.find((i) => i.id === itemId)
      if (!currentItem) return

      const updatedItem: PackingItem = {
        ...currentItem,
        bagAssignment: assignment,
        updatedAt: new Date().toISOString(),
      }

      // Optimistic in-memory update
      set((state) => ({
        items: state.items.map((i) => (i.id === itemId ? updatedItem : i)),
      }))

      try {
        const storage = getStorageContext()
        await storage.items.saveItem(updatedItem)
      } catch (err: unknown) {
        // Rollback on failure
        set((state) => ({
          items: state.items.map((i) => (i.id === itemId ? currentItem : i)),
          error: err instanceof Error ? err.message : 'Failed to update bag assignment',
        }))
      }
    }
    return tripId ? enqueueTripOperation(tripId, op) : op()
  },

  updateItem: async (itemId, updates) => {
    const item = get().items.find((i) => i.id === itemId)
    const tripId = get().tripId || item?.tripId
    const op = async () => {
      const currentItem = get().items.find((i) => i.id === itemId)
      if (!currentItem) return undefined

      let safeEffectiveQty = currentItem.effectiveQuantity
      let userAdjustedQuantity = currentItem.userAdjustedQuantity

      if (updates.quantity !== undefined) {
        safeEffectiveQty = Math.max(1, Math.round(updates.quantity || 1))
        userAdjustedQuantity = safeEffectiveQty
      }

      const clampedPacked = Math.min(currentItem.packedQuantity, safeEffectiveQty)
      const isPacked = safeEffectiveQty > 0 && clampedPacked >= safeEffectiveQty

      const updatedItem: PackingItem = {
        ...currentItem,
        name: updates.name !== undefined ? updates.name.trim() || currentItem.name : currentItem.name,
        category: updates.category || currentItem.category,
        priority: updates.priority || currentItem.priority,
        userAdjustedQuantity,
        effectiveQuantity: safeEffectiveQty,
        packedQuantity: clampedPacked,
        isPacked,
        weightGrams: updates.weightGrams !== undefined ? updates.weightGrams : currentItem.weightGrams,
        bagAssignment: 'bagAssignment' in updates ? updates.bagAssignment : currentItem.bagAssignment,
        notes: updates.notes !== undefined ? updates.notes : currentItem.notes,
        updatedAt: new Date().toISOString(),
      }

      // Optimistic in-memory update
      set((state) => ({
        items: state.items.map((i) => (i.id === itemId ? updatedItem : i)),
      }))

      try {
        const storage = getStorageContext()
        await storage.items.saveItem(updatedItem)
        return updatedItem
      } catch (err: unknown) {
        set((state) => ({
          items: state.items.map((i) => (i.id === itemId ? currentItem : i)),
          error: err instanceof Error ? err.message : 'Failed to update item',
        }))
        throw err
      }
    }
    return tripId ? enqueueTripOperation(tripId, op) : op()
  },

  addCustomItem: async (itemData) => {
    const tripId = get().tripId
    if (!tripId) {
      throw new Error('Cannot add custom item: no active trip loaded')
    }

    return enqueueTripOperation(tripId, async () => {
      const itemId = generateUUID()
      const now = new Date().toISOString()
      const qty = Math.max(1, Math.round(itemData.quantity || 1))

      const newItem: PackingItem = {
        id: itemId,
        tripId,
        name: itemData.name.trim() || 'Custom Item',
        itemSlug: `custom-${itemId.slice(0, 8)}`,
        category: itemData.category,
        priority: itemData.priority || 'optional',
        quantityStrategy: 'user_defined',
        generatedQuantity: qty,
        userAdjustedQuantity: qty,
        effectiveQuantity: qty,
        packedQuantity: 0,
        isPacked: false,
        weightGrams: itemData.weightGrams,
        bagAssignment: itemData.bagAssignment,
        isShared: Boolean(itemData.isShared),
        isCustom: true,
        reasons: ['User-added custom travel item'],
        notes: itemData.notes,
        createdAt: now,
        updatedAt: now,
      }

      set((state) => ({
        items: [...state.items, newItem],
      }))

      try {
        const storage = getStorageContext()
        await storage.items.addCustomItem(newItem)
        return newItem
      } catch (err: unknown) {
        set((state) => ({
          items: state.items.filter((i) => i.id !== itemId),
          error: err instanceof Error ? err.message : 'Failed to save custom item',
        }))
        throw err
      }
    })
  },

  deleteItem: async (itemId: string) => {
    const item = get().items.find((i) => i.id === itemId)
    const tripId = get().tripId || item?.tripId
    const op = async () => {
      const previousItems = get().items
      set((state) => ({
        items: state.items.filter((i) => i.id !== itemId),
      }))

      try {
        const storage = getStorageContext()
        await storage.items.deleteItem(itemId)
      } catch (err: unknown) {
        set({
          items: previousItems,
          error: err instanceof Error ? err.message : 'Failed to delete item',
        })
        throw err
      }
    }
    return tripId ? enqueueTripOperation(tripId, op) : op()
  },

  dismissItem: async (itemId: string) => {
    const tripId = get().tripId
    if (!tripId) {
      throw new Error('Cannot dismiss item: no active trip loaded')
    }

    return enqueueTripOperation(tripId, async () => {
      const previousItems = get().items
      const targetItem = previousItems.find((i) => i.id === itemId)
      if (!targetItem) {
        throw new Error(`Item not found for dismissal: ${itemId}`)
      }

      const storage = getStorageContext()
      try {
        const dismissedRecord = await storage.items.dismissItem(tripId, itemId)

        set((state) => ({
          items: state.items.filter((i) => i.id !== itemId),
          dismissedRecords: [
            ...state.dismissedRecords.filter((d) => d.itemSlug !== dismissedRecord.itemSlug),
            dismissedRecord,
          ],
        }))

        return dismissedRecord
      } catch (err: unknown) {
        set({
          items: previousItems,
          error: err instanceof Error ? err.message : 'Failed to dismiss item',
        })
        throw err
      }
    })
  },

  restoreDismissedItem: async (itemSlug: string) => {
    const tripId = get().tripId
    if (!tripId) {
      throw new Error('Cannot restore item: no active trip loaded')
    }

    return enqueueTripOperation(tripId, async () => {
      const storage = getStorageContext()
      try {
        const restoredItem = await storage.items.restoreDismissedItem(tripId, itemSlug)

        set((state) => ({
          items: [...state.items, restoredItem],
          dismissedRecords: state.dismissedRecords.filter((d) => d.itemSlug !== itemSlug),
        }))

        return restoredItem
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to restore item'
        set({ error: errorMsg })
        throw err
      }
    })
  },

  regenerateChecklist: async (tripConfig: TripConfig) => {
    const tripId = get().tripId
    if (!tripId) {
      throw new Error('Cannot regenerate checklist: no active trip loaded')
    }

    return enqueueTripOperation(tripId, async () => {
      set({ isLoading: true, error: null })
      try {
        const { items: existingItems, dismissedRecords } = get()
        const storage = getStorageContext()

        // Authoritative persisted/current Trip lookup to reuse normalizedContext without network calls
        const persistedTrip = await storage.trips.getTripById(tripId)
        const normalizedContext =
          persistedTrip?.normalizedContext ??
          (tripConfig as Partial<Trip>)?.normalizedContext

        // Pure engine pipeline executes rules, deduplication, quantity calculation, and reconciliation
        const result = generateRecommendations(tripConfig, {
          existingItems,
          dismissedRecords,
          tripId,
          normalizedContext,
        })

        await storage.items.reconcileTripItems(tripId, result.items)

        set({
          items: result.items,
          isLoading: false,
        })
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to regenerate checklist'
        set({ error: errorMsg, isLoading: false })
        throw err
      }
    })
  },

  setActiveCategory: (category) => set({ activeCategory: category }),
  setFilterStatus: (status) => set({ filterStatus: status }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  clearFilters: () => set({ activeCategory: 'all', filterStatus: 'all', searchQuery: '' }),
  clearError: () => set({ error: null }),
  clearChecklistIfTripMatches: (tripId: string) => {
    if (get().tripId === tripId) {
      latestLoadRequestId++
      set({
        tripId: null,
        items: [],
        dismissedRecords: [],
        activeCategory: 'all',
        filterStatus: 'all',
        searchQuery: '',
        isLoading: false,
        error: null,
      })
    }
  },
  resetChecklist: () => {
    latestLoadRequestId++
    set({
      tripId: null,
      items: [],
      dismissedRecords: [],
      activeCategory: 'all',
      filterStatus: 'all',
      searchQuery: '',
      isLoading: false,
      error: null,
    })
  },
}))
