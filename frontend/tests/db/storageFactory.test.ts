import { describe, it, expect, beforeEach, vi } from 'vitest'
import { probeIndexedDB } from '../../src/db/probe'
import {
  createStorageContext,
  getStorageContext,
  setStorageContext,
  resetStorageContext,
} from '../../src/db/factory'
import { PackPilotDatabase } from '../../src/db/dexie/db'

describe('Storage Factory & Health Probe (src/db/probe.ts & factory.ts)', () => {
  beforeEach(async () => {
    // Reset context before each test
    await createStorageContext()
  })

  it('probeIndexedDB succeeds in test environment with fake-indexeddb', async () => {
    const isFunctional = await probeIndexedDB()
    expect(isFunctional).toBe(true)
  })

  it('createStorageContext creates indexeddb context when functional', async () => {
    const context = await createStorageContext()
    expect(context.isStorageAvailable).toBe(true)
    expect(context.storageType).toBe('indexeddb')
    expect(context.trips).toBeDefined()
    expect(context.items).toBeDefined()
    expect(context.templates).toBeDefined()
  })

  it('createStorageContext("memory") forces in-memory fallback mode', async () => {
    const context = await createStorageContext('memory')
    expect(context.isStorageAvailable).toBe(false)
    expect(context.storageType).toBe('memory')
    expect(context.trips).toBeDefined()
    expect(context.items).toBeDefined()
  })

  it('getStorageContext returns active context singleton', async () => {
    const context = await createStorageContext('memory')
    setStorageContext(context)

    const active = getStorageContext()
    expect(active.storageType).toBe('memory')
    expect(active.isStorageAvailable).toBe(false)
  })

  it('safely falls back to memory mode when Dexie database open fails', async () => {
    resetStorageContext()
    const openSpy = vi.spyOn(PackPilotDatabase.prototype, 'open').mockRejectedValueOnce(
      new Error('QuotaExceededError: Database initialization failed')
    )

    const context = await createStorageContext('indexeddb')
    expect(context.storageType).toBe('memory')
    expect(context.isStorageAvailable).toBe(false)
    expect(context.trips).toBeDefined()
    expect(context.items).toBeDefined()

    openSpy.mockRestore()
  })

  it('does not silently downgrade persistent IndexedDB context if already open and active', async () => {
    resetStorageContext()
    const firstContext = await createStorageContext()
    expect(firstContext.storageType).toBe('indexeddb')

    // Calling createStorageContext() again without forcedType should preserve existing persistent context
    const secondContext = await createStorageContext()
    expect(secondContext.storageType).toBe('indexeddb')
    expect(secondContext).toBe(firstContext)
  })
})
