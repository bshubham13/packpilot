/**
 * PackPilot — In-Memory Storage State
 * Shared memory store for fallback repository implementations when IndexedDB is unavailable.
 */

import type { Trip, PackingItem, PackingTemplate } from '../../types'
import type { CacheRecord } from '../interfaces'

export class MemoryStorageState {
  trips = new Map<string, Trip>()
  items = new Map<string, PackingItem>()
  templates = new Map<string, PackingTemplate>()
  cache = new Map<string, CacheRecord>()

  clear(): void {
    this.trips.clear()
    this.items.clear()
    this.templates.clear()
    this.cache.clear()
  }
}

let sharedMemoryState: MemoryStorageState | null = null

export function getSharedMemoryState(): MemoryStorageState {
  if (!sharedMemoryState) {
    sharedMemoryState = new MemoryStorageState()
  }
  return sharedMemoryState
}
