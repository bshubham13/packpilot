/**
 * PackPilot — In-Memory Backup Repository Implementation
 * Fallback for backup snapshots and atomic restoration when IndexedDB is unavailable.
 */

import type {
  IBackupRepository,
  BackupDataSnapshot,
  BackupRestoreResult,
} from '../interfaces'
import { MemoryStorageState, getSharedMemoryState } from './memoryStorage'

function cloneEntity<T>(entity: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(entity)
  }
  return JSON.parse(JSON.stringify(entity))
}

export class MemoryBackupRepository implements IBackupRepository {
  private state: MemoryStorageState

  constructor(state?: MemoryStorageState) {
    this.state = state || getSharedMemoryState()
  }

  async createSnapshot(): Promise<BackupDataSnapshot> {
    const trips = Array.from(this.state.trips.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(cloneEntity)

    const items = Array.from(this.state.items.values()).map(cloneEntity)
    const templates = Array.from(this.state.templates.values()).map(cloneEntity)

    return { trips, items, templates }
  }

  async atomicRestore(
    data: BackupDataSnapshot,
    mode: 'replace' | 'merge',
    conflictStrategy: 'skip' | 'overwrite' = 'skip'
  ): Promise<BackupRestoreResult> {
    // Take rollback snapshots before performing mutations
    const rollbackTrips = new Map(this.state.trips)
    const rollbackItems = new Map(this.state.items)
    const rollbackTemplates = new Map(this.state.templates)

    try {
      if (mode === 'replace') {
        this.state.trips.clear()
        this.state.items.clear()
        this.state.templates.clear()

        for (const trip of data.trips) {
          this.state.trips.set(trip.id, cloneEntity(trip))
        }
        for (const item of data.items) {
          this.state.items.set(item.id, cloneEntity(item))
        }
        for (const tmpl of data.templates) {
          this.state.templates.set(tmpl.id, cloneEntity(tmpl))
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
      let tripConflicts = 0
      let tripSkipped = 0
      let tripsImported = 0

      for (const trip of data.trips) {
        if (this.state.trips.has(trip.id)) {
          tripConflicts++
          if (conflictStrategy === 'overwrite') {
            this.state.trips.set(trip.id, cloneEntity(trip))
            tripsImported++
          } else {
            tripSkipped++
          }
        } else {
          this.state.trips.set(trip.id, cloneEntity(trip))
          tripsImported++
        }
      }

      let itemConflicts = 0
      let itemSkipped = 0
      let itemsImported = 0

      for (const item of data.items) {
        const existingItem = this.state.items.get(item.id)
        if (existingItem) {
          itemConflicts++
          if (conflictStrategy === 'overwrite') {
            // Guard against cross-trip re-parenting: only overwrite if item belongs to the same trip
            if (existingItem.tripId === item.tripId) {
              this.state.items.set(item.id, cloneEntity(item))
              itemsImported++
            } else {
              // Cross-trip collision: preserve original item in original trip
              itemSkipped++
            }
          } else {
            itemSkipped++
          }
        } else {
          this.state.items.set(item.id, cloneEntity(item))
          itemsImported++
        }
      }

      let templateConflicts = 0
      let templateSkipped = 0
      let templatesImported = 0

      for (const tmpl of data.templates) {
        if (this.state.templates.has(tmpl.id)) {
          templateConflicts++
          if (conflictStrategy === 'overwrite') {
            this.state.templates.set(tmpl.id, cloneEntity(tmpl))
            templatesImported++
          } else {
            templateSkipped++
          }
        } else {
          this.state.templates.set(tmpl.id, cloneEntity(tmpl))
          templatesImported++
        }
      }

      return {
        imported: {
          trips: tripsImported,
          items: itemsImported,
          templates: templatesImported,
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
    } catch (err) {
      // Rollback to original state on failure
      this.state.trips = rollbackTrips
      this.state.items = rollbackItems
      this.state.templates = rollbackTemplates
      throw err
    }
  }
}
