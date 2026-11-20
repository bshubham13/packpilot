import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PackPilotDatabase } from '../../src/db/dexie/db'
import { DexieTripsRepository } from '../../src/db/dexie/tripsRepository'
import { DexieItemsRepository } from '../../src/db/dexie/itemsRepository'
import { DexieTemplatesRepository } from '../../src/db/dexie/templatesRepository'
import { DexieCacheRepository } from '../../src/db/dexie/cacheRepository'
import { DexieBackupRepository } from '../../src/db/dexie/backupRepository'
import { MemoryStorageState } from '../../src/db/memory/memoryStorage'
import { MemoryTripsRepository } from '../../src/db/memory/memoryTripsRepository'
import { MemoryItemsRepository } from '../../src/db/memory/memoryItemsRepository'
import { MemoryTemplatesRepository } from '../../src/db/memory/memoryTemplatesRepository'
import { MemoryCacheRepository } from '../../src/db/memory/memoryCacheRepository'
import { MemoryBackupRepository } from '../../src/db/memory/memoryBackupRepository'
import type { StorageContext } from '../../src/db/interfaces'
import type { Trip, PackingItem, PackingTemplate } from '../../src/types'
import { DEFAULT_BAGGAGE_CONFIG } from '../../src/types'
import {
  PACKPILOT_APP_ID,
  CURRENT_BACKUP_SCHEMA_VERSION,
  type PackPilotBackupPayload,
} from '../../src/types/backup'
import {
  validateBackupPayload,
  exportBackup,
  serializeBackup,
  generateBackupFilename,
  restoreBackup,
} from '../../src/services/backupService'

function createSampleTrip(id = 'trip-1', name = 'Swiss Alps Hiking'): Trip {
  return {
    id,
    name,
    destination: 'Zermatt, Switzerland',
    origin: 'Geneva, Switzerland',
    startDate: '2026-08-01',
    endDate: '2026-08-07',
    durationDays: 7,
    totalTravellerCount: 2,
    transportModes: ['train'],
    activities: ['trekking'],
    climate: 'mixed',
    accommodationType: 'hotel',
    travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 0 },
    personalPreferences: ['carry_on_only'],
    baggageConfig: DEFAULT_BAGGAGE_CONFIG,
    dismissedItems: [
      {
        itemSlug: 'wear-heavy-boots',
        name: 'Heavy Mountaineering Boots',
        category: 'clothing',
        priority: 'optional',
        reasons: ['User dismissed'],
        dismissedAt: '2026-08-01T10:00:00Z',
        originalItemSnapshot: {
          id: 'dismissed-item-1',
          tripId: id,
          name: 'Heavy Mountaineering Boots',
          itemSlug: 'wear-heavy-boots',
          category: 'clothing',
          priority: 'optional',
          quantityStrategy: 'per_person',
          generatedQuantity: 1,
          effectiveQuantity: 1,
          packedQuantity: 0,
          isPacked: false,
          isCustom: false,
          isShared: false,
          reasons: ['Trekking activity'],
          createdAt: '2026-08-01T09:00:00Z',
          updatedAt: '2026-08-01T09:00:00Z',
        },
      },
    ],
    engineVersion: '1.4.0',
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-08-01T08:30:00Z',
  }
}

function createSampleItem(
  id = 'item-1',
  tripId = 'trip-1',
  overrides: Partial<PackingItem> = {}
): PackingItem {
  return {
    id,
    tripId,
    name: 'Merino Wool Socks',
    itemSlug: 'wear-merino-socks',
    category: 'clothing',
    priority: 'recommended',
    quantityStrategy: 'per_person_per_day',
    generatedQuantity: 5,
    userAdjustedQuantity: 7,
    effectiveQuantity: 7,
    packedQuantity: 4,
    isPacked: false,
    weightGrams: 80,
    bagAssignment: 'cabin',
    isShared: false,
    isCustom: false,
    reasons: ['7-day trip', 'Trekking activity'],
    notes: 'Pack cushioned hiking pairs',
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-08-01T08:30:00Z',
    ...overrides,
  }
}

function createSampleTemplate(id = 'template-1', name = 'Weekend Trekking'): PackingTemplate {
  return {
    id,
    name,
    description: 'Minimalist packing gear for 2-day alpine treks',
    isSystem: false,
    defaultTransport: ['train'],
    defaultActivities: ['trekking'],
    defaultClimate: 'mixed',
    defaultAccommodation: 'hotel',
    items: [
      {
        name: 'Trekking Pole Set',
        itemSlug: 'gear-trekking-poles',
        category: 'gear',
        quantityStrategy: 'fixed',
        defaultQuantity: 1,
        priority: 'recommended',
        weightGrams: 450,
        isShared: false,
        reasons: ['Mountain terrain stability'],
      },
    ],
    createdAt: '2026-08-01T07:00:00Z',
    updatedAt: '2026-08-01T07:00:00Z',
  }
}

function createMemoryStorage(existingState?: MemoryStorageState): StorageContext & { state: MemoryStorageState } {
  const state = existingState || new MemoryStorageState()
  return Object.assign(
    {
      trips: new MemoryTripsRepository(state),
      items: new MemoryItemsRepository(state),
      templates: new MemoryTemplatesRepository(state),
      cache: new MemoryCacheRepository(state),
      backup: new MemoryBackupRepository(state),
      isStorageAvailable: false,
      storageType: 'memory' as const,
    },
    { state }
  )
}

function createDexieStorage(dbName: string): { context: StorageContext; db: PackPilotDatabase } {
  const db = new PackPilotDatabase(dbName)
  const context: StorageContext = {
    trips: new DexieTripsRepository(db),
    items: new DexieItemsRepository(db),
    templates: new DexieTemplatesRepository(db),
    cache: new DexieCacheRepository(db),
    backup: new DexieBackupRepository(db),
    isStorageAvailable: true,
    storageType: 'indexeddb',
  }
  return { context, db }
}

describe('PackPilot JSON Backup & Restore Engine', () => {
  describe('Schema Validation (Phase 2)', () => {
    it('rejects non-object or null root input', () => {
      expect(validateBackupPayload(null).valid).toBe(false)
      expect(validateBackupPayload(undefined).valid).toBe(false)
      expect(validateBackupPayload('string').valid).toBe(false)
      expect(validateBackupPayload(42).valid).toBe(false)
      expect(validateBackupPayload([]).valid).toBe(false)
    })

    it('rejects payloads with invalid app identifier', () => {
      const res = validateBackupPayload({
        app: 'wrong-app',
        version: 1,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [],
        items: [],
        templates: [],
      })
      expect(res.valid).toBe(false)
      expect(res.errors[0]).toContain("expected 'packpilot'")
    })

    it('rejects unsupported future schema versions (> 1)', () => {
      const res = validateBackupPayload({
        app: PACKPILOT_APP_ID,
        version: 2,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [],
        items: [],
        templates: [],
      })
      expect(res.valid).toBe(false)
      expect(res.errors.some((e) => e.includes('Unsupported backup schema version: 2'))).toBe(true)
    })

    it('rejects invalid or non-integer schema versions', () => {
      const res = validateBackupPayload({
        app: PACKPILOT_APP_ID,
        version: 0,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [],
        items: [],
        templates: [],
      })
      expect(res.valid).toBe(false)
      expect(res.errors.some((e) => e.includes('Version must be >= 1'))).toBe(true)
    })

    it('rejects invalid or unparseable date strings', () => {
      const res = validateBackupPayload({
        app: PACKPILOT_APP_ID,
        version: 1,
        exportedAt: 'not-a-valid-date',
        trips: [],
        items: [],
        templates: [],
      })
      expect(res.valid).toBe(false)
      expect(res.errors.some((e) => e.includes("Invalid or missing export timestamp: 'exportedAt'"))).toBe(true)
    })

    it('rejects missing or non-array collections', () => {
      const res = validateBackupPayload({
        app: PACKPILOT_APP_ID,
        version: 1,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: 'not-an-array',
        items: null,
      })
      expect(res.valid).toBe(false)
      expect(res.errors.some((e) => e.includes("'trips' collection must be an array"))).toBe(true)
      expect(res.errors.some((e) => e.includes("'items' collection must be an array"))).toBe(true)
      expect(res.errors.some((e) => e.includes("'templates' collection must be an array"))).toBe(true)
    })

    it('rejects duplicate IDs within the backup payload', () => {
      const trip1 = createSampleTrip('trip-duplicate', 'Trip 1')
      const trip2 = createSampleTrip('trip-duplicate', 'Trip 2')

      const res = validateBackupPayload({
        app: PACKPILOT_APP_ID,
        version: 1,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [trip1, trip2],
        items: [],
        templates: [],
      })
      expect(res.valid).toBe(false)
      expect(res.errors.some((e) => e.includes("Duplicate trip ID found in backup: 'trip-duplicate'"))).toBe(true)
    })

    it('rejects duplicate item IDs within the backup payload', () => {
      const trip = createSampleTrip('trip-1')
      const item1 = createSampleItem('item-dup', 'trip-1')
      const item2 = createSampleItem('item-dup', 'trip-1')

      const res = validateBackupPayload({
        app: PACKPILOT_APP_ID,
        version: 1,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [trip],
        items: [item1, item2],
        templates: [],
      })
      expect(res.valid).toBe(false)
      expect(res.errors.some((e) => e.includes("Duplicate item ID found in backup: 'item-dup'"))).toBe(true)
    })

    it('enforces referential integrity: rejects child items referencing unknown tripId', () => {
      const trip = createSampleTrip('trip-1')
      const orphanItem = createSampleItem('item-orphan', 'trip-non-existent')

      const res = validateBackupPayload({
        app: PACKPILOT_APP_ID,
        version: 1,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [trip],
        items: [orphanItem],
        templates: [],
      })
      expect(res.valid).toBe(false)
      expect(
        res.errors.some((e) =>
          e.includes("Referential integrity violation: Item 'item-orphan' ('Merino Wool Socks') references unknown tripId 'trip-non-existent'")
        )
      ).toBe(true)
    })

    it('validates required fields on trips and items', () => {
      const malformedTrip = { id: '', name: '' } as unknown as Trip
      const res = validateBackupPayload({
        app: PACKPILOT_APP_ID,
        version: 1,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [malformedTrip],
        items: [],
        templates: [],
      })
      expect(res.valid).toBe(false)
      expect(res.errors.some((e) => e.includes("Trip at index 0 is missing a valid string 'id'"))).toBe(true)
    })

    it('accepts a valid empty backup payload', () => {
      const res = validateBackupPayload({
        app: PACKPILOT_APP_ID,
        version: 1,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [],
        items: [],
        templates: [],
      })
      expect(res.valid).toBe(true)
      expect(res.errors).toHaveLength(0)
      expect(res.data).toBeDefined()
    })

    it('rejects malformed dismissedItems elements and missing snapshot fields', () => {
      const trip = createSampleTrip('trip-bad-dismissed')
      trip.dismissedItems = [
        {
          itemSlug: '',
          name: 'Missing Slug Item',
          category: 'clothing',
          priority: 'optional',
          reasons: [],
          dismissedAt: 'not-a-date',
          originalItemSnapshot: null as unknown as PackingItem,
        },
      ]

      const res = validateBackupPayload({
        app: PACKPILOT_APP_ID,
        version: 1,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [trip],
        items: [],
        templates: [],
      })
      expect(res.valid).toBe(false)
      expect(res.errors.some((e) => e.includes("is missing 'itemSlug'"))).toBe(true)
      expect(res.errors.some((e) => e.includes("has an invalid 'dismissedAt' date"))).toBe(true)
      expect(res.errors.some((e) => e.includes("is missing 'originalItemSnapshot' object"))).toBe(true)
    })

    it('rejects malformed template.items elements', () => {
      const template = createSampleTemplate('tmpl-bad')
      template.items = [
        {
          name: '',
          itemSlug: 'bad-slug',
          category: 'gear',
          quantityStrategy: 'fixed',
          defaultQuantity: -5,
          priority: 'recommended',
          isShared: false,
          reasons: [],
        },
      ]

      const res = validateBackupPayload({
        app: PACKPILOT_APP_ID,
        version: 1,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [],
        items: [],
        templates: [template],
      })
      expect(res.valid).toBe(false)
      expect(res.errors.some((e) => e.includes("item at index 0 is missing 'name'"))).toBe(true)
      expect(res.errors.some((e) => e.includes('has invalid defaultQuantity'))).toBe(true)
    })

    it('rejects invalid optional item fields (negative weight, negative userAdjustedQuantity, invalid bagAssignment)', () => {
      const trip = createSampleTrip('trip-opt-val')
      const itemBadWeight = createSampleItem('item-bad-weight', 'trip-opt-val', { weightGrams: -50 })
      const itemBadQty = createSampleItem('item-bad-qty', 'trip-opt-val', { userAdjustedQuantity: -1 })
      const itemBadBag = createSampleItem('item-bad-bag', 'trip-opt-val', {
        bagAssignment: 'cargo' as unknown as import('../../src/types').BagAssignment,
      })

      const res = validateBackupPayload({
        app: PACKPILOT_APP_ID,
        version: 1,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [trip],
        items: [itemBadWeight, itemBadQty, itemBadBag],
        templates: [],
      })
      expect(res.valid).toBe(false)
      expect(res.errors.some((e) => e.includes('has invalid weightGrams'))).toBe(true)
      expect(res.errors.some((e) => e.includes('has invalid userAdjustedQuantity'))).toBe(true)
      expect(res.errors.some((e) => e.includes('has invalid bagAssignment'))).toBe(true)
    })
  })

  describe('Export Engine (Phase 3)', () => {
    it('exports an empty database backup with canonical metadata', async () => {
      const storage = createMemoryStorage()
      const backup = await exportBackup(storage)

      expect(backup.app).toBe(PACKPILOT_APP_ID)
      expect(backup.version).toBe(CURRENT_BACKUP_SCHEMA_VERSION)
      expect(new Date(backup.exportedAt).toString()).not.toBe('Invalid Date')
      expect(backup.trips).toEqual([])
      expect(backup.items).toEqual([])
      expect(backup.templates).toEqual([])
    })

    it('exports all durable user-owned collections while excluding disposable cache tables', async () => {
      const storage = createMemoryStorage()
      const trip = createSampleTrip('trip-1')
      const item = createSampleItem('item-1', 'trip-1')
      const template = createSampleTemplate('tmpl-1')

      await storage.trips.saveTripWithItems(trip, [item])
      await storage.templates.saveTemplate(template)
      await storage.cache.set('geo:paris', { lat: 48.8, lon: 2.3 }, 3600000)

      const backup = await exportBackup(storage)

      expect(backup.trips).toHaveLength(1)
      expect(backup.trips[0].id).toBe('trip-1')
      expect(backup.items).toHaveLength(1)
      expect(backup.items[0].id).toBe('item-1')
      expect(backup.templates).toHaveLength(1)
      expect(backup.templates[0].id).toBe('tmpl-1')

      // Ensure cache is NOT in backup payload
      expect((backup as Record<string, unknown>).cache).toBeUndefined()
      expect((backup as Record<string, unknown>).geo_cache).toBeUndefined()
      expect((backup as Record<string, unknown>).weather_cache).toBeUndefined()
    })

    it('preserves all rich item metadata, partial packing progress, overrides and notes', async () => {
      const storage = createMemoryStorage()
      const trip = createSampleTrip('trip-alpha')
      const customItem = createSampleItem('custom-1', 'trip-alpha', {
        name: 'Family Passport Bundle',
        itemSlug: 'custom-family-passports',
        isCustom: true,
        userAdjustedQuantity: 4,
        effectiveQuantity: 4,
        packedQuantity: 2,
        isPacked: false,
        weightGrams: 200,
        bagAssignment: 'cabin',
        notes: 'Keep in front zippered compartment',
      })

      await storage.trips.saveTripWithItems(trip, [customItem])
      const backup = await exportBackup(storage)
      const exportedItem = backup.items[0]

      expect(exportedItem.isCustom).toBe(true)
      expect(exportedItem.userAdjustedQuantity).toBe(4)
      expect(exportedItem.effectiveQuantity).toBe(4)
      expect(exportedItem.packedQuantity).toBe(2)
      expect(exportedItem.isPacked).toBe(false)
      expect(exportedItem.weightGrams).toBe(200)
      expect(exportedItem.bagAssignment).toBe('cabin')
      expect(exportedItem.notes).toBe('Keep in front zippered compartment')
    })

    it('preserves dismissed item snapshots on trips', async () => {
      const storage = createMemoryStorage()
      const trip = createSampleTrip('trip-dismissed')
      await storage.trips.saveTripWithItems(trip, [])

      const backup = await exportBackup(storage)
      expect(backup.trips[0].dismissedItems).toHaveLength(1)
      expect(backup.trips[0].dismissedItems[0].itemSlug).toBe('wear-heavy-boots')
      expect(backup.trips[0].dismissedItems[0].originalItemSnapshot.id).toBe('dismissed-item-1')
    })

    it('serializes backup cleanly to formatted JSON string', async () => {
      const storage = createMemoryStorage()
      const backup = await exportBackup(storage)
      const json = serializeBackup(backup)

      expect(typeof json).toBe('string')
      const parsed = JSON.parse(json)
      expect(parsed.app).toBe(PACKPILOT_APP_ID)
    })

    it('generates deterministic backup filenames with dates', () => {
      const fixedDate = new Date('2026-11-20T12:00:00Z')
      const filename = generateBackupFilename(fixedDate)
      expect(filename).toBe('packpilot-backup-2026-11-20.json')
    })

    it('guarantees consistent snapshot across trips and items during concurrent writes in Dexie', async () => {
      const dbName = `ExportConsistency_${Date.now()}_${Math.random()}`
      const { context: dexieStorage, db } = createDexieStorage(dbName)
      try {
        // Seed initial trip
        const trip1 = createSampleTrip('trip-initial')
        const item1 = createSampleItem('item-initial', 'trip-initial')
        await dexieStorage.trips.saveTripWithItems(trip1, [item1])

        // Trigger export and concurrent write simultaneously
        const exportPromise = exportBackup(dexieStorage)
        const writePromise = dexieStorage.trips.saveTripWithItems(
          createSampleTrip('trip-concurrent'),
          [createSampleItem('item-concurrent', 'trip-concurrent')]
        )

        const [backupResult] = await Promise.all([exportPromise, writePromise])

        // The exported snapshot MUST be internally self-consistent:
        // An exported item must never be orphaned without its trip
        const validation = validateBackupPayload(backupResult)
        expect(validation.valid).toBe(true)

        const hasConcurrentItem = backupResult.items.some((i) => i.id === 'item-concurrent')
        const hasConcurrentTrip = backupResult.trips.some((t) => t.id === 'trip-concurrent')
        expect(hasConcurrentItem).toBe(hasConcurrentTrip)
      } finally {
        await db.delete()
      }
    })
  })

  describe('Restore Engine (Phase 4 & 5)', () => {
    it('rejects invalid JSON string input with clear error', async () => {
      const storage = createMemoryStorage()
      const result = await restoreBackup('{ malformed json ', { mode: 'replace', storage })

      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('Invalid JSON format')
    })

    it('rejects payloads failing validation before any database mutation occurs', async () => {
      const storage = createMemoryStorage()
      const initialTrip = createSampleTrip('existing-trip')
      await storage.trips.saveTripWithItems(initialTrip, [])

      const invalidPayload = {
        app: PACKPILOT_APP_ID,
        version: 999, // unsupported version
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [],
        items: [],
        templates: [],
      }

      const result = await restoreBackup(invalidPayload, { mode: 'replace', storage })

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.includes('Unsupported backup schema version'))).toBe(true)

      // Verify existing trip is untouched
      const existing = await storage.trips.getAllTrips()
      expect(existing).toHaveLength(1)
      expect(existing[0].id).toBe('existing-trip')
    })

    it('executes atomic replace mode: completely clears old collections and writes backup', async () => {
      const storage = createMemoryStorage()

      // Seed old data
      const oldTrip = createSampleTrip('old-trip-1', 'Old Vacation')
      const oldItem = createSampleItem('old-item-1', 'old-trip-1')
      const oldTemplate = createSampleTemplate('old-tmpl-1', 'Old Template')
      await storage.trips.saveTripWithItems(oldTrip, [oldItem])
      await storage.templates.saveTemplate(oldTemplate)

      // Backup to restore
      const newTrip1 = createSampleTrip('new-trip-1', 'New Safari')
      const newTrip2 = createSampleTrip('new-trip-2', 'New City Break')
      const newItem1 = createSampleItem('new-item-1', 'new-trip-1')
      const newItem2 = createSampleItem('new-item-2', 'new-trip-2')
      const newTemplate = createSampleTemplate('new-tmpl-1', 'Safari Template')

      const backup: PackPilotBackupPayload = {
        app: PACKPILOT_APP_ID,
        version: CURRENT_BACKUP_SCHEMA_VERSION,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [newTrip1, newTrip2],
        items: [newItem1, newItem2],
        templates: [newTemplate],
      }

      const result = await restoreBackup(serializeBackup(backup), { mode: 'replace', storage })

      expect(result.success).toBe(true)
      expect(result.mode).toBe('replace')
      expect(result.imported).toEqual({ trips: 2, items: 2, templates: 1 })
      expect(result.skipped).toEqual({ trips: 0, items: 0, templates: 0 })
      expect(result.conflicts).toEqual({ trips: 0, items: 0, templates: 0 })

      // Verify old data is gone
      const currentTrips = await storage.trips.getAllTrips()
      expect(currentTrips.map((t) => t.id).sort()).toEqual(['new-trip-1', 'new-trip-2'])
      expect(await storage.items.getItemById('old-item-1')).toBeNull()
      expect(await storage.templates.getTemplateById('old-tmpl-1')).toBeNull()
      expect(await storage.templates.getTemplateById('new-tmpl-1')).toBeDefined()
    })

    it('executes merge mode with non-conflicting records and preserves existing data', async () => {
      const storage = createMemoryStorage()

      const existingTrip = createSampleTrip('existing-trip-1', 'Existing Paris')
      const existingItem = createSampleItem('existing-item-1', 'existing-trip-1')
      await storage.trips.saveTripWithItems(existingTrip, [existingItem])

      const incomingTrip = createSampleTrip('incoming-trip-1', 'Incoming Tokyo')
      const incomingItem = createSampleItem('incoming-item-1', 'incoming-trip-1')

      const backup: PackPilotBackupPayload = {
        app: PACKPILOT_APP_ID,
        version: CURRENT_BACKUP_SCHEMA_VERSION,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [incomingTrip],
        items: [incomingItem],
        templates: [],
      }

      const result = await restoreBackup(backup, { mode: 'merge', storage })

      expect(result.success).toBe(true)
      expect(result.imported).toEqual({ trips: 1, items: 1, templates: 0 })
      expect(result.skipped).toEqual({ trips: 0, items: 0, templates: 0 })
      expect(result.conflicts).toEqual({ trips: 0, items: 0, templates: 0 })

      const trips = await storage.trips.getAllTrips()
      expect(trips).toHaveLength(2)
      expect(await storage.items.getItemById('existing-item-1')).toBeDefined()
      expect(await storage.items.getItemById('incoming-item-1')).toBeDefined()
    })

    it('executes merge mode with matching IDs: preserves existing data and reports conflicts (skip strategy)', async () => {
      const storage = createMemoryStorage()

      const existingTrip = createSampleTrip('trip-conflict', 'Original Local Paris Trip')
      const existingItem = createSampleItem('item-conflict', 'trip-conflict', {
        name: 'Original Local Passport',
        packedQuantity: 1,
        isPacked: true,
      })
      await storage.trips.saveTripWithItems(existingTrip, [existingItem])

      const conflictingIncomingTrip = createSampleTrip('trip-conflict', 'Conflicting Incoming Name')
      const conflictingIncomingItem = createSampleItem('item-conflict', 'trip-conflict', {
        name: 'Conflicting Incoming Passport',
        packedQuantity: 0,
        isPacked: false,
      })
      const nonConflictingItem = createSampleItem('item-new', 'trip-conflict', {
        name: 'New Merged Item',
      })

      const backup: PackPilotBackupPayload = {
        app: PACKPILOT_APP_ID,
        version: CURRENT_BACKUP_SCHEMA_VERSION,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [conflictingIncomingTrip],
        items: [conflictingIncomingItem, nonConflictingItem],
        templates: [],
      }

      const result = await restoreBackup(backup, {
        mode: 'merge',
        conflictStrategy: 'skip',
        storage,
      })

      expect(result.success).toBe(true)
      expect(result.conflicts).toEqual({ trips: 1, items: 1, templates: 0 })
      expect(result.skipped).toEqual({ trips: 1, items: 1, templates: 0 })
      expect(result.imported).toEqual({ trips: 0, items: 1, templates: 0 })

      // Verify original local data was preserved
      const trip = await storage.trips.getTripById('trip-conflict')
      expect(trip?.name).toBe('Original Local Paris Trip')

      const originalItem = await storage.items.getItemById('item-conflict')
      expect(originalItem?.name).toBe('Original Local Passport')
      expect(originalItem?.isPacked).toBe(true)

      // Verify newly introduced non-conflicting item was successfully added
      const newItem = await storage.items.getItemById('item-new')
      expect(newItem).toBeDefined()
      expect(newItem?.name).toBe('New Merged Item')
    })

    it('supports overwrite conflict strategy in merge mode when explicitly requested', async () => {
      const storage = createMemoryStorage()

      const existingTrip = createSampleTrip('trip-conflict', 'Original Local Trip')
      await storage.trips.saveTripWithItems(existingTrip, [])

      const incomingTrip = createSampleTrip('trip-conflict', 'Overwritten Trip Name')

      const backup: PackPilotBackupPayload = {
        app: PACKPILOT_APP_ID,
        version: CURRENT_BACKUP_SCHEMA_VERSION,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [incomingTrip],
        items: [],
        templates: [],
      }

      const result = await restoreBackup(backup, {
        mode: 'merge',
        conflictStrategy: 'overwrite',
        storage,
      })

      expect(result.success).toBe(true)
      expect(result.conflicts.trips).toBe(1)
      expect(result.imported.trips).toBe(1)
      expect(result.skipped.trips).toBe(0)

      const updated = await storage.trips.getTripById('trip-conflict')
      expect(updated?.name).toBe('Overwritten Trip Name')
    })

    describe('Cross-Trip Item Re-Parenting Guards (Merge + Overwrite)', () => {
      it('allows overwriting item when both item ID and trip ID match', async () => {
        const storage = createMemoryStorage()
        const trip = createSampleTrip('trip-1')
        const item = createSampleItem('item-1', 'trip-1', { notes: 'Old Notes' })
        await storage.trips.saveTripWithItems(trip, [item])

        const backup: PackPilotBackupPayload = {
          app: PACKPILOT_APP_ID,
          version: CURRENT_BACKUP_SCHEMA_VERSION,
          exportedAt: '2026-08-01T00:00:00Z',
          trips: [trip],
          items: [createSampleItem('item-1', 'trip-1', { notes: 'Updated Notes' })],
          templates: [],
        }

        const result = await restoreBackup(backup, {
          mode: 'merge',
          conflictStrategy: 'overwrite',
          storage,
        })

        expect(result.success).toBe(true)
        expect(result.conflicts.items).toBe(1)
        expect(result.imported.items).toBe(1)
        expect(result.skipped.items).toBe(0)

        const updated = await storage.items.getItemById('item-1')
        expect(updated?.notes).toBe('Updated Notes')
        expect(updated?.tripId).toBe('trip-1')
      })

      it('prevents cross-trip item re-parenting when item ID collides with an existing item from a different trip', async () => {
        const storage = createMemoryStorage()
        // Local database has Trip A with Item 1
        const tripA = createSampleTrip('trip-A', 'Trip A')
        const itemA = createSampleItem('shared-item-id', 'trip-A', { name: 'Item on Trip A' })
        await storage.trips.saveTripWithItems(tripA, [itemA])

        // Incoming backup has Trip B attempting to import Item 1 with tripId: 'trip-B'
        const tripB = createSampleTrip('trip-B', 'Trip B')
        const incomingItem = createSampleItem('shared-item-id', 'trip-B', { name: 'Re-parent Attempt Item' })

        const backup: PackPilotBackupPayload = {
          app: PACKPILOT_APP_ID,
          version: CURRENT_BACKUP_SCHEMA_VERSION,
          exportedAt: '2026-08-01T00:00:00Z',
          trips: [tripB],
          items: [incomingItem],
          templates: [],
        }

        const result = await restoreBackup(backup, {
          mode: 'merge',
          conflictStrategy: 'overwrite',
          storage,
        })

        expect(result.success).toBe(true)
        expect(result.conflicts.items).toBe(1)
        expect(result.skipped.items).toBe(1)
        expect(result.imported.items).toBe(0)
        expect(result.imported.trips).toBe(1)

        // Verify the original item is PRESERVED on Trip A and NOT re-parented
        const itemInDb = await storage.items.getItemById('shared-item-id')
        expect(itemInDb?.tripId).toBe('trip-A')
        expect(itemInDb?.name).toBe('Item on Trip A')

        // Verify Trip B has no items
        const tripBItems = await storage.items.getItemsForTrip('trip-B')
        expect(tripBItems).toHaveLength(0)
      })

      it('handles mixed valid, same-trip conflicting, and cross-trip conflicting items in one restore', async () => {
        const storage = createMemoryStorage()

        // Local state: Trip 1 has item-same, Trip 2 has item-cross
        const trip1 = createSampleTrip('trip-1', 'Trip 1')
        const trip2 = createSampleTrip('trip-2', 'Trip 2')
        const itemSame = createSampleItem('item-same', 'trip-1', { name: 'Local Same-Trip Item' })
        const itemCross = createSampleItem('item-cross', 'trip-2', { name: 'Local Trip 2 Item' })

        await storage.trips.saveTripWithItems(trip1, [itemSame])
        await storage.trips.saveTripWithItems(trip2, [itemCross])

        // Backup for Trip 1:
        // 1. item-same with tripId 'trip-1' (valid overwrite)
        // 2. item-cross with tripId 'trip-1' (cross-trip collision, should be skipped)
        // 3. item-new with tripId 'trip-1' (brand new, should be imported)
        const backup: PackPilotBackupPayload = {
          app: PACKPILOT_APP_ID,
          version: CURRENT_BACKUP_SCHEMA_VERSION,
          exportedAt: '2026-08-01T00:00:00Z',
          trips: [trip1],
          items: [
            createSampleItem('item-same', 'trip-1', { name: 'Overwritten Same-Trip Item' }),
            createSampleItem('item-cross', 'trip-1', { name: 'Attempted Cross-Trip Item' }),
            createSampleItem('item-brand-new', 'trip-1', { name: 'Brand New Item' }),
          ],
          templates: [],
        }

        const result = await restoreBackup(backup, {
          mode: 'merge',
          conflictStrategy: 'overwrite',
          storage,
        })

        expect(result.success).toBe(true)
        expect(result.conflicts.items).toBe(2)
        expect(result.imported.items).toBe(2) // item-same and item-brand-new
        expect(result.skipped.items).toBe(1)  // item-cross skipped

        // Verify item-cross remains on trip-2
        const crossInDb = await storage.items.getItemById('item-cross')
        expect(crossInDb?.tripId).toBe('trip-2')
        expect(crossInDb?.name).toBe('Local Trip 2 Item')

        // Verify item-same was updated
        const sameInDb = await storage.items.getItemById('item-same')
        expect(sameInDb?.name).toBe('Overwritten Same-Trip Item')

        // Verify item-brand-new was imported
        const newInDb = await storage.items.getItemById('item-brand-new')
        expect(newInDb?.tripId).toBe('trip-1')
      })
    })

    describe('Genuine Atomicity and Rollback Verification', () => {
      it('executes genuine transaction rollback in Dexie when a failure occurs mid-transaction', async () => {
        const dbName = `GenuineDexieRollback_${Date.now()}_${Math.random()}`
        const { context: dexieStorage, db } = createDexieStorage(dbName)

        try {
          // 1. Seed existing data
          const seededTrip = createSampleTrip('seeded-trip-1', 'Seeded Trip')
          const seededItem = createSampleItem('seeded-item-1', 'seeded-trip-1')
          const seededTmpl = createSampleTemplate('seeded-tmpl-1', 'Seeded Tmpl')
          await dexieStorage.trips.saveTripWithItems(seededTrip, [seededItem])
          await dexieStorage.templates.saveTemplate(seededTmpl)

          // 2. Prepare replacement backup
          const newTrip = createSampleTrip('new-trip-1', 'New Trip')
          const newItem = createSampleItem('new-item-1', 'new-trip-1')
          const backup: PackPilotBackupPayload = {
            app: PACKPILOT_APP_ID,
            version: CURRENT_BACKUP_SCHEMA_VERSION,
            exportedAt: '2026-08-01T00:00:00Z',
            trips: [newTrip],
            items: [newItem],
            templates: [],
          }

          // 3. Spy on the actual Dexie items table write operation to fail mid-transaction
          const bulkPutSpy = vi.spyOn(db.items, 'bulkPut').mockRejectedValueOnce(
            new Error('Simulated Mid-Transaction Dexie BulkPut Failure')
          )

          const result = await restoreBackup(backup, { mode: 'replace', storage: dexieStorage })

          expect(result.success).toBe(false)
          expect(result.errors[0]).toContain('Simulated Mid-Transaction Dexie BulkPut Failure')

          // 4. Verify GENUINE rollback: seeded collections are completely intact
          const tripsInDb = await dexieStorage.trips.getAllTrips()
          expect(tripsInDb).toHaveLength(1)
          expect(tripsInDb[0].id).toBe('seeded-trip-1')

          const itemsInDb = await dexieStorage.items.getAllItems()
          expect(itemsInDb).toHaveLength(1)
          expect(itemsInDb[0].id).toBe('seeded-item-1')

          const tmplsInDb = await dexieStorage.templates.getAllTemplates()
          expect(tmplsInDb).toHaveLength(1)
          expect(tmplsInDb[0].id).toBe('seeded-tmpl-1')

          bulkPutSpy.mockRestore()
        } finally {
          await db.delete()
        }
      })

      it('executes genuine rollback in Memory when a mutation failure occurs midway', async () => {
        const storage = createMemoryStorage()

        // 1. Seed existing data
        const seededTrip = createSampleTrip('mem-seeded-trip', 'Mem Seeded Trip')
        const seededItem = createSampleItem('mem-seeded-item', 'mem-seeded-trip')
        const seededTmpl = createSampleTemplate('mem-seeded-tmpl', 'Mem Seeded Tmpl')
        await storage.trips.saveTripWithItems(seededTrip, [seededItem])
        await storage.templates.saveTemplate(seededTmpl)

        // 2. Prepare replacement backup with multiple items
        const newTrip = createSampleTrip('mem-new-trip', 'Mem New Trip')
        const newItem1 = createSampleItem('mem-new-item-1', 'mem-new-trip')
        const newItem2 = createSampleItem('mem-new-item-2', 'mem-new-trip')
        const backup: PackPilotBackupPayload = {
          app: PACKPILOT_APP_ID,
          version: CURRENT_BACKUP_SCHEMA_VERSION,
          exportedAt: '2026-08-01T00:00:00Z',
          trips: [newTrip],
          items: [newItem1, newItem2],
          templates: [],
        }

        // 3. Spy on memory map mutation to fail on second item insertion
        // (after trips were cleared and written, and item 1 was written)
        let setCallCount = 0
        const originalSet = storage.state.items.set.bind(storage.state.items)
        const setSpy = vi.spyOn(storage.state.items, 'set').mockImplementation((...args) => {
          setCallCount++
          if (setCallCount >= 2) {
            throw new Error('Simulated Memory Item Mutation Failure')
          }
          return originalSet(...args)
        })

        const result = await restoreBackup(backup, { mode: 'replace', storage })

        expect(result.success).toBe(false)
        expect(result.errors[0]).toContain('Simulated Memory Item Mutation Failure')

        // 4. Verify GENUINE rollback: memory store reverted to original snapshot
        const trips = await storage.trips.getAllTrips()
        expect(trips).toHaveLength(1)
        expect(trips[0].id).toBe('mem-seeded-trip')

        const items = await storage.items.getAllItems()
        expect(items).toHaveLength(1)
        expect(items[0].id).toBe('mem-seeded-item')

        const tmpls = await storage.templates.getAllTemplates()
        expect(tmpls).toHaveLength(1)
        expect(tmpls[0].id).toBe('mem-seeded-tmpl')

        setSpy.mockRestore()
      })
    })
  })

  describe('Dexie IndexedDB and In-Memory Parity (Phase 6)', () => {
    let dexieDb: PackPilotDatabase
    let dexieStorage: StorageContext
    const dbName = `BackupParityTest_${Date.now()}_${Math.random()}`

    beforeEach(() => {
      const created = createDexieStorage(dbName)
      dexieDb = created.db
      dexieStorage = created.context
    })

    afterEach(async () => {
      await dexieDb.delete()
    })

    it('performs round-trip export and restore equivalently in Dexie and Memory', async () => {
      const memStorage = createMemoryStorage()

      // Seed both with identical test data
      const trip = createSampleTrip('parity-trip-1', 'Norway Fjords')
      const item1 = createSampleItem('parity-item-1', 'parity-trip-1', {
        name: 'Waterproof Shell Jacket',
        packedQuantity: 1,
        isPacked: true,
        bagAssignment: 'cabin',
      })
      const item2 = createSampleItem('parity-item-2', 'parity-trip-1', {
        name: 'Trail Map',
        packedQuantity: 0,
        isPacked: false,
        isCustom: true,
        bagAssignment: 'checked',
      })
      const template = createSampleTemplate('parity-tmpl-1', 'Alpine Template')

      await memStorage.trips.saveTripWithItems(trip, [item1, item2])
      await memStorage.templates.saveTemplate(template)

      await dexieStorage.trips.saveTripWithItems(trip, [item1, item2])
      await dexieStorage.templates.saveTemplate(template)

      // Export from Memory and restore into Dexie
      const memBackup = await exportBackup(memStorage)
      const dexieRestoreResult = await restoreBackup(memBackup, { mode: 'replace', storage: dexieStorage })

      expect(dexieRestoreResult.success).toBe(true)
      expect(dexieRestoreResult.imported).toEqual({ trips: 1, items: 2, templates: 1 })

      // Export from Dexie and compare
      const dexieBackup = await exportBackup(dexieStorage)
      expect(dexieBackup.trips).toEqual(memBackup.trips)
      expect(dexieBackup.items).toEqual(memBackup.items)
      expect(dexieBackup.templates).toEqual(memBackup.templates)
    })

    it('preserves referential integrity in Dexie during merge with conflicts', async () => {
      const existingTrip = createSampleTrip('dexie-trip-1', 'Dexie Local Trip')
      const existingItem = createSampleItem('dexie-item-1', 'dexie-trip-1')
      await dexieStorage.trips.saveTripWithItems(existingTrip, [existingItem])

      const backup: PackPilotBackupPayload = {
        app: PACKPILOT_APP_ID,
        version: CURRENT_BACKUP_SCHEMA_VERSION,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [
          createSampleTrip('dexie-trip-1', 'Conflicting Dexie Trip'),
          createSampleTrip('dexie-trip-2', 'Brand New Dexie Trip'),
        ],
        items: [
          createSampleItem('dexie-item-1', 'dexie-trip-1'),
          createSampleItem('dexie-item-2', 'dexie-trip-2'),
        ],
        templates: [],
      }

      const result = await restoreBackup(backup, {
        mode: 'merge',
        conflictStrategy: 'skip',
        storage: dexieStorage,
      })

      expect(result.success).toBe(true)
      expect(result.conflicts.trips).toBe(1)
      expect(result.conflicts.items).toBe(1)
      expect(result.skipped.trips).toBe(1)
      expect(result.skipped.items).toBe(1)
      expect(result.imported.trips).toBe(1)
      expect(result.imported.items).toBe(1)

      const allTrips = await dexieStorage.trips.getAllTrips()
      expect(allTrips).toHaveLength(2)
      expect(allTrips.find((t) => t.id === 'dexie-trip-1')?.name).toBe('Dexie Local Trip')
      expect(allTrips.find((t) => t.id === 'dexie-trip-2')?.name).toBe('Brand New Dexie Trip')
    })

    it('prevents cross-trip item re-parenting in Dexie during merge overwrite', async () => {
      const trip1 = createSampleTrip('dexie-t1', 'Dexie Trip 1')
      const item1 = createSampleItem('dexie-shared-item', 'dexie-t1', { name: 'Item on Trip 1' })
      await dexieStorage.trips.saveTripWithItems(trip1, [item1])

      const trip2 = createSampleTrip('dexie-t2', 'Dexie Trip 2')
      const incomingItem = createSampleItem('dexie-shared-item', 'dexie-t2', { name: 'Cross Trip Attempt' })

      const backup: PackPilotBackupPayload = {
        app: PACKPILOT_APP_ID,
        version: CURRENT_BACKUP_SCHEMA_VERSION,
        exportedAt: '2026-08-01T00:00:00Z',
        trips: [trip2],
        items: [incomingItem],
        templates: [],
      }

      const result = await restoreBackup(backup, {
        mode: 'merge',
        conflictStrategy: 'overwrite',
        storage: dexieStorage,
      })

      expect(result.success).toBe(true)
      expect(result.conflicts.items).toBe(1)
      expect(result.skipped.items).toBe(1)
      expect(result.imported.items).toBe(0)

      const storedItem = await dexieStorage.items.getItemById('dexie-shared-item')
      expect(storedItem?.tripId).toBe('dexie-t1')
      expect(storedItem?.name).toBe('Item on Trip 1')
    })
  })
})
