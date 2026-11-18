/**
 * PackPilot — Storage Factory & Context Selector
 * Selects Dexie IndexedDB or In-Memory fallback repositories based on capability probe.
 */

import type { StorageContext, StorageType } from './interfaces'
import { probeIndexedDB } from './probe'
import { PackPilotDatabase, getDexieDatabase, closeAndResetDexieDatabase } from './dexie/db'
import { DexieTripsRepository } from './dexie/tripsRepository'
import { DexieItemsRepository } from './dexie/itemsRepository'
import { DexieTemplatesRepository } from './dexie/templatesRepository'
import { MemoryTripsRepository } from './memory/memoryTripsRepository'
import { MemoryItemsRepository } from './memory/memoryItemsRepository'
import { MemoryTemplatesRepository } from './memory/memoryTemplatesRepository'

let currentContext: StorageContext | null = null

export async function createStorageContext(
  forcedType?: StorageType
): Promise<StorageContext> {
  // If persistent IndexedDB storage has already been initialized and active,
  // do not silently downgrade to memory unless an explicit forcedType was requested.
  if (!forcedType && currentContext?.storageType === 'indexeddb') {
    return currentContext
  }

  let useIndexedDB = false

  if (forcedType === 'indexeddb') {
    useIndexedDB = true
  } else if (forcedType === 'memory') {
    useIndexedDB = false
  } else {
    // Automatic probing
    useIndexedDB = await probeIndexedDB()
  }

  if (useIndexedDB) {
    let db: PackPilotDatabase | null = null
    try {
      db = getDexieDatabase()
      // Verify actual database initialization and open connection
      await db.open()

      const context: StorageContext = {
        trips: new DexieTripsRepository(db),
        items: new DexieItemsRepository(db),
        templates: new DexieTemplatesRepository(db),
        isStorageAvailable: true,
        storageType: 'indexeddb',
      }
      currentContext = context
      return context
    } catch {
      // Safely close connection and cleanup failed Dexie instance
      closeAndResetDexieDatabase()
      useIndexedDB = false
    }
  }

  // Safe In-Memory Fallback
  const memoryContext: StorageContext = {
    trips: new MemoryTripsRepository(),
    items: new MemoryItemsRepository(),
    templates: new MemoryTemplatesRepository(),
    isStorageAvailable: false,
    storageType: 'memory',
  }
  currentContext = memoryContext
  return memoryContext
}

export function getStorageContext(): StorageContext {
  if (!currentContext) {
    // Default to in-memory until async initialization completes
    currentContext = {
      trips: new MemoryTripsRepository(),
      items: new MemoryItemsRepository(),
      templates: new MemoryTemplatesRepository(),
      isStorageAvailable: false,
      storageType: 'memory',
    }
  }
  return currentContext
}

export function setStorageContext(context: StorageContext): void {
  currentContext = context
}

export function resetStorageContext(): void {
  currentContext = null
}
