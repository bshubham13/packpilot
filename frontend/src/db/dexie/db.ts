/**
 * PackPilot — Pure Dexie.js IndexedDB Schema & Database Instance
 * Enforces schema versioning, composite indexes, and atomic transactions.
 */

import Dexie, { type Table } from 'dexie'
import type { Trip, PackingItem, PackingTemplate } from '../../types'

export class PackPilotDatabase extends Dexie {
  trips!: Table<Trip, string>
  items!: Table<PackingItem, string>
  templates!: Table<PackingTemplate, string>

  constructor(dbName = 'PackPilotDB') {
    super(dbName)

    // Schema Version 1: Core tables and query indexes
    this.version(1).stores({
      trips: 'id, destination, startDate, endDate, createdAt',
      items: 'id, tripId, category, priority, isPacked, [tripId+category], itemSlug',
      templates: 'id, isSystem, createdAt',
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
