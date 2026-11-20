/**
 * PackPilot — Dexie Items Repository Implementation
 * Handles checklist item operations, partial packing updates, dismissals, and restoration.
 */

import type { IItemsRepository } from '../interfaces'
import type { PackingItem, DismissedItemRecord } from '../../types'
import { PackPilotDatabase, getDexieDatabase } from './db'

export class DexieItemsRepository implements IItemsRepository {
  private db: PackPilotDatabase

  constructor(db?: PackPilotDatabase) {
    this.db = db || getDexieDatabase()
  }

  async getItemsForTrip(tripId: string): Promise<PackingItem[]> {
    return this.db.items.where('tripId').equals(tripId).toArray()
  }

  async getAllItems(): Promise<PackingItem[]> {
    return this.db.items.toArray()
  }

  async getItemById(itemId: string): Promise<PackingItem | null> {
    const item = await this.db.items.get(itemId)
    return item || null
  }

  async saveItem(item: PackingItem): Promise<void> {
    await this.db.items.put(item)
  }

  async saveItems(items: PackingItem[]): Promise<void> {
    if (items && items.length > 0) {
      await this.db.items.bulkPut(items)
    }
  }

  async updatePackedQuantity(itemId: string, packedQuantity: number): Promise<void> {
    const item = await this.db.items.get(itemId)
    if (!item) {
      throw new Error(`Item not found: ${itemId}`)
    }

    const safePacked = Math.max(0, Math.min(packedQuantity, item.effectiveQuantity))
    const isPacked = item.effectiveQuantity > 0 && safePacked >= item.effectiveQuantity

    await this.db.items.update(itemId, {
      packedQuantity: safePacked,
      isPacked,
      updatedAt: new Date().toISOString(),
    })
  }

  async updateItemQuantity(itemId: string, userQuantity: number): Promise<void> {
    const item = await this.db.items.get(itemId)
    if (!item) {
      throw new Error(`Item not found: ${itemId}`)
    }

    const safeQty = Math.max(1, Math.round(userQuantity || 1))
    const clampedPacked = Math.min(item.packedQuantity, safeQty)
    const isPacked = safeQty > 0 && clampedPacked >= safeQty

    await this.db.items.update(itemId, {
      userAdjustedQuantity: safeQty,
      effectiveQuantity: safeQty,
      packedQuantity: clampedPacked,
      isPacked,
      updatedAt: new Date().toISOString(),
    })
  }

  async addCustomItem(item: PackingItem): Promise<void> {
    await this.db.items.put({
      ...item,
      isCustom: true,
      updatedAt: new Date().toISOString(),
    })
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.db.items.delete(itemId)
  }

  async dismissItem(tripId: string, itemId: string): Promise<DismissedItemRecord> {
    return this.db.transaction('rw', [this.db.trips, this.db.items], async () => {
      const item = await this.db.items.get(itemId)
      if (!item) {
        throw new Error(`Item not found for dismissal: ${itemId}`)
      }

      const trip = await this.db.trips.get(tripId)
      if (!trip) {
        throw new Error(`Trip not found for dismissal: ${tripId}`)
      }

      const dismissedRecord: DismissedItemRecord = {
        itemSlug: item.itemSlug,
        name: item.name,
        category: item.category,
        priority: item.priority,
        reasons: item.reasons,
        dismissedAt: new Date().toISOString(),
        originalItemSnapshot: { ...item },
      }

      // Remove from items table
      await this.db.items.delete(itemId)

      // Add to trip.dismissedItems array
      const existingDismissed = trip.dismissedItems || []
      const filteredDismissed = existingDismissed.filter((d) => d.itemSlug !== item.itemSlug)
      filteredDismissed.push(dismissedRecord)

      await this.db.trips.update(tripId, {
        dismissedItems: filteredDismissed,
        updatedAt: new Date().toISOString(),
      })

      return dismissedRecord
    })
  }

  async restoreDismissedItem(tripId: string, itemSlug: string): Promise<PackingItem> {
    return this.db.transaction('rw', [this.db.trips, this.db.items], async () => {
      const trip = await this.db.trips.get(tripId)
      if (!trip) {
        throw new Error(`Trip not found for restoration: ${tripId}`)
      }

      const dismissedList = trip.dismissedItems || []
      const record = dismissedList.find((d) => d.itemSlug === itemSlug)
      if (!record) {
        throw new Error(`Dismissed record not found for slug: ${itemSlug}`)
      }

      const restoredItem = { ...record.originalItemSnapshot }

      // Put item back into items table
      await this.db.items.put(restoredItem)

      // Remove from trip.dismissedItems array
      const remainingDismissed = dismissedList.filter((d) => d.itemSlug !== itemSlug)
      await this.db.trips.update(tripId, {
        dismissedItems: remainingDismissed,
        updatedAt: new Date().toISOString(),
      })

      return restoredItem
    })
  }

  async reconcileTripItems(tripId: string, updatedItems: PackingItem[]): Promise<void> {
    await this.db.transaction('rw', [this.db.items], async () => {
      // Replaces all current active items for this trip with the reconciled set
      await this.db.items.where('tripId').equals(tripId).delete()
      if (updatedItems && updatedItems.length > 0) {
        await this.db.items.bulkPut(updatedItems)
      }
    })
  }

  async deleteItemsForTrip(tripId: string): Promise<void> {
    await this.db.items.where('tripId').equals(tripId).delete()
  }
}
