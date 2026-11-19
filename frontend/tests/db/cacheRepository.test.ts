import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryCacheRepository } from '../../src/db/memory/memoryCacheRepository'
import { MemoryStorageState } from '../../src/db/memory/memoryStorage'
import { DexieCacheRepository } from '../../src/db/dexie/cacheRepository'
import { PackPilotDatabase } from '../../src/db/dexie/db'
import 'fake-indexeddb/auto'

describe('Cache Repository & TTL Expiration (Memory & Dexie)', () => {
  describe('MemoryCacheRepository', () => {
    let state: MemoryStorageState
    let repo: MemoryCacheRepository

    beforeEach(() => {
      state = new MemoryStorageState()
      repo = new MemoryCacheRepository(state)
    })

    it('stores and retrieves cache entries within TTL', async () => {
      await repo.set('geo:pune:5', { name: 'Pune' }, 1000)
      const data = await repo.get<{ name: string }>('geo:pune:5')
      expect(data).toEqual({ name: 'Pune' })
    })

    it('returns null and purges entry after TTL expires', async () => {
      // Set with negative TTL so it is already expired
      await repo.set('weather:delhi', { temp: 20 }, -100)

      expect(await repo.get('weather:delhi')).toBeNull()
      expect(state.cache.has('weather:delhi')).toBe(false)
    })

    it('deletes and clears cache records', async () => {
      await repo.set('k1', 'val1', 5000)
      await repo.set('k2', 'val2', 5000)
      await repo.delete('k1')
      expect(await repo.get('k1')).toBeNull()
      expect(await repo.get('k2')).toBe('val2')

      await repo.clear()
      expect(await repo.get('k2')).toBeNull()
    })
  })

  describe('DexieCacheRepository', () => {
    let db: PackPilotDatabase
    let repo: DexieCacheRepository

    beforeEach(async () => {
      db = new PackPilotDatabase(`TestCacheDB_${Date.now()}_${Math.random()}`)
      await db.open()
      repo = new DexieCacheRepository(db)
    })

    it('stores and retrieves geo and weather cache entries in Dexie IndexedDB', async () => {
      await repo.set('geo:delhi', { city: 'Delhi' }, 5000)
      await repo.set('weather:28.61_77.20', { temp: 22 }, 5000)

      const geo = await repo.get<{ city: string }>('geo:delhi')
      const weather = await repo.get<{ temp: number }>('weather:28.61_77.20')

      expect(geo).toEqual({ city: 'Delhi' })
      expect(weather).toEqual({ temp: 22 })
    })

    it('returns null and deletes expired entry in Dexie', async () => {
      // Set with negative TTL so it is already expired
      await repo.set('weather:expired', { temp: 15 }, -100)

      const expired = await repo.get('weather:expired')
      expect(expired).toBeNull()

      // Confirm deleted from Dexie table
      const inDb = await db.weather_cache.get('weather:expired')
      expect(inDb).toBeUndefined()
    })
  })
})
