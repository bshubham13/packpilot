/**
 * PackPilot — Dexie Trips Repository Implementation
 * Handles trip persistence and guarantees relationship integrity with packing items.
 */

import type { ITripsRepository } from '../interfaces'
import type { Trip, PackingItem, DismissedItemRecord } from '../../types'
import { PackPilotDatabase, getDexieDatabase } from './db'
import { generateUUID } from '../../utils/uuid'

export class DexieTripsRepository implements ITripsRepository {
  private db: PackPilotDatabase

  constructor(db?: PackPilotDatabase) {
    this.db = db || getDexieDatabase()
  }

  async getAllTrips(): Promise<Trip[]> {
    return this.db.trips.orderBy('createdAt').reverse().toArray()
  }

  async getTripById(id: string): Promise<Trip | null> {
    const trip = await this.db.trips.get(id)
    return trip || null
  }

  async saveTripWithItems(trip: Trip, items: PackingItem[]): Promise<void> {
    await this.db.transaction('rw', [this.db.trips, this.db.items], async () => {
      await this.db.trips.put(trip)
      if (items && items.length > 0) {
        await this.db.items.bulkPut(items)
      }
    })
  }

  async updateTrip(id: string, updates: Partial<Trip>): Promise<void> {
    const existing = await this.db.trips.get(id)
    if (!existing) {
      throw new Error(`Trip not found: ${id}`)
    }
    const updated: Trip = {
      ...existing,
      ...updates,
      id, // Preserve primary key
      updatedAt: new Date().toISOString(),
    }
    await this.db.trips.put(updated)
  }

  async atomicUpdateTripAndItems(
    tripId: string,
    tripUpdates: Partial<Trip>,
    reconciledItems: PackingItem[]
  ): Promise<void> {
    await this.db.transaction('rw', [this.db.trips, this.db.items], async () => {
      const existing = await this.db.trips.get(tripId)
      if (!existing) {
        throw new Error(`Trip not found: ${tripId}`)
      }
      const updated: Trip = {
        ...existing,
        ...tripUpdates,
        id: tripId, // Preserve primary key
        updatedAt: new Date().toISOString(),
      }
      await this.db.trips.put(updated)
      await this.db.items.where('tripId').equals(tripId).delete()
      if (reconciledItems && reconciledItems.length > 0) {
        await this.db.items.bulkPut(reconciledItems)
      }
    })
  }

  async deleteTrip(id: string): Promise<void> {
    // Atomic cascade: delete trip and all its child items in a single transaction (no orphaned items)
    await this.db.transaction('rw', [this.db.trips, this.db.items], async () => {
      await this.db.items.where('tripId').equals(id).delete()
      await this.db.trips.delete(id)
    })
  }

  async duplicateTrip(id: string, newId?: string, newName?: string): Promise<Trip> {
    const sourceTrip = await this.db.trips.get(id)
    if (!sourceTrip) {
      throw new Error(`Trip not found for duplication: ${id}`)
    }

    const duplicatedId = newId || generateUUID()
    const duplicatedName = newName || `${sourceTrip.name} (Copy)`
    const now = new Date().toISOString()

    // Deep-clone dismissed items and generate independent IDs with new duplicated tripId
    const duplicatedDismissedItems: DismissedItemRecord[] = (sourceTrip.dismissedItems || []).map(
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
      ...sourceTrip,
      id: duplicatedId,
      name: duplicatedName,
      dismissedItems: duplicatedDismissedItems,
      createdAt: now,
      updatedAt: now,
    }

    // Duplicate child items atomically
    const sourceItems = await this.db.items.where('tripId').equals(id).toArray()
    const duplicatedItems: PackingItem[] = sourceItems.map((item) => ({
      ...item,
      id: generateUUID(),
      tripId: duplicatedId,
      createdAt: now,
      updatedAt: now,
    }))

    await this.db.transaction('rw', [this.db.trips, this.db.items], async () => {
      await this.db.trips.put(duplicatedTrip)
      if (duplicatedItems.length > 0) {
        await this.db.items.bulkPut(duplicatedItems)
      }
    })

    return duplicatedTrip
  }
}
