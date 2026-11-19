/**
 * PackPilot — Pure Dexie.js IndexedDB Schema & Database Instance
 * Enforces schema versioning, composite indexes, and atomic transactions.
 */

import Dexie, { type Table } from 'dexie'
import type { Trip, PackingItem, PackingTemplate } from '../../types'
import type { CacheRecord } from '../interfaces'

export class PackPilotDatabase extends Dexie {
  trips!: Table<Trip, string>
  items!: Table<PackingItem, string>
  templates!: Table<PackingTemplate, string>
  geo_cache!: Table<CacheRecord, string>
  weather_cache!: Table<CacheRecord, string>

  constructor(dbName = 'PackPilotDB') {
    super(dbName)

    // Schema Version 1: Core tables and query indexes
    this.version(1).stores({
      trips: 'id, destination, startDate, endDate, createdAt',
      items: 'id, tripId, category, priority, isPacked, [tripId+category], itemSlug',
      templates: 'id, isSystem, createdAt',
    })

    // Schema Version 2: Additive local cache tables (preserves all Version 1 tables and indexes)
    this.version(2).stores({
      trips: 'id, destination, startDate, endDate, createdAt',
      items: 'id, tripId, category, priority, isPacked, [tripId+category], itemSlug',
      templates: 'id, isSystem, createdAt',
      geo_cache: 'key, expiresAt',
      weather_cache: 'key, expiresAt',
    })
  }
}

let dbInstance: PackPilotDatabase | null = null

export function getDexieDatabase(dbName?: string): PackPilotDatabase {
  if (!dbInstance || (dbName && dbInstance.name !== dbName)) {
    dbInstance = new PackPilotDatabase(dbName)
  }
  return dbInstance
}

export function closeAndResetDexieDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close()
    } catch {
      // Safe ignore on close failure
    }
    dbInstance = null
  }
}
