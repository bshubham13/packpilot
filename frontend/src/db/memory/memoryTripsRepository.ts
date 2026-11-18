/**
 * PackPilot — In-Memory Trips Repository Implementation
 * Fallback for environments where IndexedDB is blocked or unavailable.
 */

import type { ITripsRepository } from '../interfaces'
import type { Trip, PackingItem, DismissedItemRecord } from '../../types'
import { MemoryStorageState, getSharedMemoryState } from './memoryStorage'
import { generateUUID } from '../../utils/uuid'

export class MemoryTripsRepository implements ITripsRepository {
  private state: MemoryStorageState

  constructor(state?: MemoryStorageState) {
    this.state = state || getSharedMemoryState()
  }

  async getAllTrips(): Promise<Trip[]> {
    const list = Array.from(this.state.trips.values())
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getTripById(id: string): Promise<Trip | null> {
    return this.state.trips.get(id) || null
  }

  async saveTripWithItems(trip: Trip, items: PackingItem[]): Promise<void> {
    this.state.trips.set(trip.id, { ...trip })
    if (items) {
      for (const item of items) {
        this.state.items.set(item.id, { ...item })
      }
    }
  }

  async updateTrip(id: string, updates: Partial<Trip>): Promise<void> {
    const existing = this.state.trips.get(id)
    if (!existing) {
      throw new Error(`Trip not found: ${id}`)
    }
    this.state.trips.set(id, {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    })
  }

  async deleteTrip(id: string): Promise<void> {
    this.state.trips.delete(id)
    // Cascade delete associated items to prevent orphaned records
    for (const [itemId, item] of this.state.items.entries()) {
      if (item.tripId === id) {
        this.state.items.delete(itemId)
      }
    }
  }

  async duplicateTrip(id: string, newId?: string, newName?: string): Promise<Trip> {
    const source = this.state.trips.get(id)
    if (!source) {
      throw new Error(`Trip not found for duplication: ${id}`)
    }

    const duplicatedId = newId || generateUUID()
    const duplicatedName = newName || `${source.name} (Copy)`
    const now = new Date().toISOString()

    // Deep-clone dismissed items and generate independent IDs with new duplicated tripId
    const duplicatedDismissedItems: DismissedItemRecord[] = (source.dismissedItems || []).map(
      (record) => ({
        ...record,
        reasons: [...record.reasons],
        originalItemSnapshot: {
          ...record.originalItemSnapshot,
          id: generateUUID(),
          tripId: duplicatedId,
          reasons: [...(record.originalItemSnapshot.reasons || [])],
          quantityParams: record.originalItemSnapshot.quantityParams
            ? { ...record.originalItemSnapshot.quantityParams }
            : undefined,
        },
      })
    )

    const duplicatedTrip: Trip = {
      ...source,
      id: duplicatedId,
      name: duplicatedName,
      dismissedItems: duplicatedDismissedItems,
      createdAt: now,
      updatedAt: now,
    }

    this.state.trips.set(duplicatedId, duplicatedTrip)

    // Duplicate child items
    for (const item of this.state.items.values()) {
      if (item.tripId === id) {
        const newItemId = generateUUID()
        this.state.items.set(newItemId, {
          ...item,
          id: newItemId,
          tripId: duplicatedId,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    return duplicatedTrip
  }
}
