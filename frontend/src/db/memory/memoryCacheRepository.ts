/**
 * PackPilot — In-Memory Cache Repository Implementation
 * Fallback key-value cache when IndexedDB is unavailable.
 */

import type { ICacheRepository, CacheRecord } from '../interfaces'
import { MemoryStorageState, getSharedMemoryState } from './memoryStorage'

export class MemoryCacheRepository implements ICacheRepository {
  private state: MemoryStorageState

  constructor(state?: MemoryStorageState) {
    this.state = state || getSharedMemoryState()
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.state.cache.get(key)
    if (!entry) return null

    if (Date.now() >= entry.expiresAt) {
      this.state.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    const record: CacheRecord<T> = {
      key,
      data,
      expiresAt: Date.now() + ttlMs,
    }
    this.state.cache.set(key, record as CacheRecord)
  }

  async delete(key: string): Promise<void> {
    this.state.cache.delete(key)
  }

  async clear(): Promise<void> {
    this.state.cache.clear()
  }
}
