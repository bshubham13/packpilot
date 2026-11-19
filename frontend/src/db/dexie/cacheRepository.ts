/**
 * PackPilot — Dexie Cache Repository Implementation
 * Stores key-value payloads with TTL expiration in IndexedDB.
 */

import type { ICacheRepository, CacheRecord } from '../interfaces'
import type { PackPilotDatabase } from './db'

export class DexieCacheRepository implements ICacheRepository {
  private db: PackPilotDatabase

  constructor(db: PackPilotDatabase) {
    this.db = db
  }

  private getTable(key: string) {
    if (key.startsWith('weather:') || key.startsWith('aqi:')) {
      return this.db.weather_cache
    }
    return this.db.geo_cache
  }

  async get<T>(key: string): Promise<T | null> {
    const table = this.getTable(key)
    const entry = await table.get(key)
    if (!entry) return null

    if (Date.now() >= entry.expiresAt) {
      await table.delete(key)
      return null
    }

    return entry.data as T
  }

  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    const table = this.getTable(key)
    const record: CacheRecord<T> = {
      key,
      data,
      expiresAt: Date.now() + ttlMs,
    }
    await table.put(record)
  }

  async delete(key: string): Promise<void> {
    const table = this.getTable(key)
    await table.delete(key)
  }

  async clear(): Promise<void> {
    await Promise.all([
      this.db.geo_cache.clear(),
      this.db.weather_cache.clear(),
    ])
  }
}
