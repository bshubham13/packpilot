/**
 * PackPilot — Dexie Backup Repository Implementation
 * Handles atomic backup snapshots and multi-collection database restoration.
 */

import type {
  IBackupRepository,
  BackupDataSnapshot,
  BackupRestoreResult,
} from '../interfaces'
import type { Trip, PackingItem, PackingTemplate } from '../../types'
import { PackPilotDatabase, getDexieDatabase } from './db'

export class DexieBackupRepository implements IBackupRepository {
  private db: PackPilotDatabase

  constructor(db?: PackPilotDatabase) {
    this.db = db || getDexieDatabase()
  }

  async createSnapshot(): Promise<BackupDataSnapshot> {
    return await this.db.transaction('r', [this.db.trips, this.db.items, this.db.templates], async () => {
      const [trips, items, templates] = await Promise.all([
        this.db.trips.orderBy('createdAt').reverse().toArray(),
        this.db.items.toArray(),
        this.db.templates.toArray(),
      ])
      return { trips, items, templates }
    })
  }

  async atomicRestore(
    data: BackupDataSnapshot,
    mode: 'replace' | 'merge',
    conflictStrategy: 'skip' | 'overwrite' = 'skip'
  ): Promise<BackupRestoreResult> {
    return await this.db.transaction('rw', [this.db.trips, this.db.items, this.db.templates], async () => {
      if (mode === 'replace') {
        await this.db.trips.clear()
        await this.db.items.clear()
        await this.db.templates.clear()

        if (data.trips.length > 0) {
          await this.db.trips.bulkPut(data.trips)
        }
        if (data.items.length > 0) {
          await this.db.items.bulkPut(data.items)
        }
        if (data.templates.length > 0) {
          await this.db.templates.bulkPut(data.templates)
        }

        return {
          imported: {
            trips: data.trips.length,
            items: data.items.length,
            templates: data.templates.length,
          },
          skipped: { trips: 0, items: 0, templates: 0 },
          conflicts: { trips: 0, items: 0, templates: 0 },
        }
      }

      // Merge mode
      const existingTripKeys = new Set((await this.db.trips.toCollection().primaryKeys()) as string[])
      const existingItems = await this.db.items.toArray()
      const existingItemTripMap = new Map<string, string>(existingItems.map((item) => [item.id, item.tripId]))
      const existingTemplateKeys = new Set((await this.db.templates.toCollection().primaryKeys()) as string[])

      const tripsToPut: Trip[] = []
      let tripConflicts = 0
      let tripSkipped = 0

      for (const trip of data.trips) {
        if (existingTripKeys.has(trip.id)) {
          tripConflicts++
          if (conflictStrategy === 'overwrite') {
            tripsToPut.push(trip)
          } else {
            tripSkipped++
          }
        } else {
          tripsToPut.push(trip)
        }
      }

      const itemsToPut: PackingItem[] = []
      let itemConflicts = 0
      let itemSkipped = 0

      for (const item of data.items) {
        const existingTripId = existingItemTripMap.get(item.id)
        if (existingTripId !== undefined) {
          itemConflicts++
          if (conflictStrategy === 'overwrite') {
            // Guard against cross-trip re-parenting: only overwrite if item belongs to the same trip
            if (existingTripId === item.tripId) {
              itemsToPut.push(item)
            } else {
              // Cross-trip collision: preserve original item in original trip
              itemSkipped++
            }
          } else {
            itemSkipped++
          }
        } else {
          itemsToPut.push(item)
        }
      }

      const templatesToPut: PackingTemplate[] = []
      let templateConflicts = 0
      let templateSkipped = 0

      for (const tmpl of data.templates) {
        if (existingTemplateKeys.has(tmpl.id)) {
          templateConflicts++
          if (conflictStrategy === 'overwrite') {
            templatesToPut.push(tmpl)
          } else {
            templateSkipped++
          }
        } else {
          templatesToPut.push(tmpl)
        }
      }

      if (tripsToPut.length > 0) {
        await this.db.trips.bulkPut(tripsToPut)
      }
      if (itemsToPut.length > 0) {
        await this.db.items.bulkPut(itemsToPut)
      }
      if (templatesToPut.length > 0) {
        await this.db.templates.bulkPut(templatesToPut)
      }

      return {
        imported: {
          trips: tripsToPut.length,
          items: itemsToPut.length,
          templates: templatesToPut.length,
        },
        skipped: {
          trips: tripSkipped,
          items: itemSkipped,
          templates: templateSkipped,
        },
        conflicts: {
          trips: tripConflicts,
          items: itemConflicts,
          templates: templateConflicts,
        },
      }
    })
  }
}
