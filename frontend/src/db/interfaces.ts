/**
 * PackPilot — Pure Storage Repository Contracts
 * Decouples business logic and state stores from Dexie.js and in-memory fallback.
 */

import type { Trip, PackingItem, PackingTemplate, DismissedItemRecord } from '../types'

export interface ITripsRepository {
  getAllTrips(): Promise<Trip[]>
  getTripById(id: string): Promise<Trip | null>
  saveTripWithItems(trip: Trip, items: PackingItem[]): Promise<void>
  updateTrip(id: string, updates: Partial<Trip>): Promise<void>
  deleteTrip(id: string): Promise<void>
  duplicateTrip(id: string, newId?: string, newName?: string): Promise<Trip>
}

export interface IItemsRepository {
  getItemsForTrip(tripId: string): Promise<PackingItem[]>
  getItemById(itemId: string): Promise<PackingItem | null>
  saveItem(item: PackingItem): Promise<void>
  saveItems(items: PackingItem[]): Promise<void>
  updatePackedQuantity(itemId: string, packedQuantity: number): Promise<void>
  updateItemQuantity(itemId: string, userQuantity: number): Promise<void>
  addCustomItem(item: PackingItem): Promise<void>
  deleteItem(itemId: string): Promise<void>
  dismissItem(tripId: string, itemId: string): Promise<DismissedItemRecord>
  restoreDismissedItem(tripId: string, itemSlug: string): Promise<PackingItem>
  reconcileTripItems(tripId: string, updatedItems: PackingItem[]): Promise<void>
  deleteItemsForTrip(tripId: string): Promise<void>
}

export interface ITemplatesRepository {
  getAllTemplates(): Promise<PackingTemplate[]>
  getTemplateById(id: string): Promise<PackingTemplate | null>
  saveTemplate(template: PackingTemplate): Promise<void>
  deleteTemplate(id: string): Promise<void>
}

export interface CacheRecord<T = unknown> {
  key: string
  data: T
  expiresAt: number // Unix epoch timestamp (ms)
}

export interface ICacheRepository {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, data: T, ttlMs: number): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
}

export type StorageType = 'indexeddb' | 'memory'

export interface StorageContext {
  trips: ITripsRepository
  items: IItemsRepository
  templates: ITemplatesRepository
  cache: ICacheRepository
  isStorageAvailable: boolean
  storageType: StorageType
}
