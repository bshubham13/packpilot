/**
 * PackPilot — In-Memory Items Repository Implementation
 * Fallback for checklist items when IndexedDB is unavailable.
 */

import type { IItemsRepository } from '../interfaces'
import type { PackingItem, DismissedItemRecord } from '../../types'
import { MemoryStorageState, getSharedMemoryState } from './memoryStorage'

export class MemoryItemsRepository implements IItemsRepository {
  private state: MemoryStorageState

  constructor(state?: MemoryStorageState) {
    this.state = state || getSharedMemoryState()
  }

  async getItemsForTrip(tripId: string): Promise<PackingItem[]> {
    const result: PackingItem[] = []
    for (const item of this.state.items.values()) {
      if (item.tripId === tripId) {
        result.push({ ...item })
      }
    }
    return result
  }

  async getAllItems(): Promise<PackingItem[]> {
    return Array.from(this.state.items.values()).map((item) => ({ ...item }))
  }

  async getItemById(itemId: string): Promise<PackingItem | null> {
    const item = this.state.items.get(itemId)
    return item ? { ...item } : null
  }

  async saveItem(item: PackingItem): Promise<void> {
    this.state.items.set(item.id, { ...item })
  }

  async saveItems(items: PackingItem[]): Promise<void> {
    for (const item of items) {
      this.state.items.set(item.id, { ...item })
    }
  }

  async updatePackedQuantity(itemId: string, packedQuantity: number): Promise<void> {
    const item = this.state.items.get(itemId)
    if (!item) {
      throw new Error(`Item not found: ${itemId}`)
    }

    const safePacked = Math.max(0, Math.min(packedQuantity, item.effectiveQuantity))
    const isPacked = item.effectiveQuantity > 0 && safePacked >= item.effectiveQuantity

    this.state.items.set(itemId, {
      ...item,
      packedQuantity: safePacked,
      isPacked,
      updatedAt: new Date().toISOString(),
    })
  }

  async updateItemQuantity(itemId: string, userQuantity: number): Promise<void> {
    const item = this.state.items.get(itemId)
    if (!item) {
      throw new Error(`Item not found: ${itemId}`)
    }

    const safeQty = Math.max(1, Math.round(userQuantity || 1))
    const clampedPacked = Math.min(item.packedQuantity, safeQty)
    const isPacked = safeQty > 0 && clampedPacked >= safeQty

    this.state.items.set(itemId, {
      ...item,
      userAdjustedQuantity: safeQty,
      effectiveQuantity: safeQty,
      packedQuantity: clampedPacked,
      isPacked,
      updatedAt: new Date().toISOString(),
    })
  }

  async addCustomItem(item: PackingItem): Promise<void> {
    this.state.items.set(item.id, {
      ...item,
      isCustom: true,
      updatedAt: new Date().toISOString(),
    })
  }

  async deleteItem(itemId: string): Promise<void> {
    this.state.items.delete(itemId)
  }

  async dismissItem(tripId: string, itemId: string): Promise<DismissedItemRecord> {
    const item = this.state.items.get(itemId)
    if (!item) {
      throw new Error(`Item not found for dismissal: ${itemId}`)
    }

    const trip = this.state.trips.get(tripId)
    if (!trip) {
      throw new Error(`Trip not found for dismissal: ${tripId}`)
    }

    const dismissedRecord: DismissedItemRecord = {
      itemSlug: item.itemSlug,
      name: item.name,
      category: item.category,
      priority: item.priority,
      reasons: [...item.reasons],
      dismissedAt: new Date().toISOString(),
      originalItemSnapshot: { ...item },
    }

    // Remove from in-memory items
    this.state.items.delete(itemId)

    // Add to trip.dismissedItems
    const existingDismissed = trip.dismissedItems || []
    const filteredDismissed = existingDismissed.filter((d) => d.itemSlug !== item.itemSlug)
    filteredDismissed.push(dismissedRecord)

    this.state.trips.set(tripId, {
      ...trip,
      dismissedItems: filteredDismissed,
      updatedAt: new Date().toISOString(),
    })

    return dismissedRecord
  }

  async restoreDismissedItem(tripId: string, itemSlug: string): Promise<PackingItem> {
    const trip = this.state.trips.get(tripId)
    if (!trip) {
      throw new Error(`Trip not found for restoration: ${tripId}`)
    }

    const dismissedList = trip.dismissedItems || []
    const record = dismissedList.find((d) => d.itemSlug === itemSlug)
    if (!record) {
      throw new Error(`Dismissed record not found for slug: ${itemSlug}`)
    }

    const restoredItem = { ...record.originalItemSnapshot }

    // Put item back into items map
    this.state.items.set(restoredItem.id, restoredItem)

    // Remove from trip.dismissedItems array
    const remainingDismissed = dismissedList.filter((d) => d.itemSlug !== itemSlug)
    this.state.trips.set(tripId, {
      ...trip,
      dismissedItems: remainingDismissed,
      updatedAt: new Date().toISOString(),
    })

    return restoredItem
  }

  async reconcileTripItems(tripId: string, updatedItems: PackingItem[]): Promise<void> {
    // Delete all current active items for this trip
    for (const [id, item] of this.state.items.entries()) {
      if (item.tripId === tripId) {
        this.state.items.delete(id)
      }
    }
    // Set reconciled items
    if (updatedItems) {
      for (const item of updatedItems) {
        this.state.items.set(item.id, { ...item })
      }
    }
  }

  async deleteItemsForTrip(tripId: string): Promise<void> {
    for (const [id, item] of this.state.items.entries()) {
      if (item.tripId === tripId) {
        this.state.items.delete(id)
      }
    }
  }
}
