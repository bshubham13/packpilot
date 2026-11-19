import { describe, it, expect } from 'vitest'
import Dexie from 'dexie'
import { PackPilotDatabase } from '../../src/db/dexie/db'
import type { Trip, PackingItem, PackingTemplate } from '../../src/types'
import 'fake-indexeddb/auto'

describe('Dexie Database Schema Version 2 Additive Migration', () => {
  it('preserves all Version 1 trips, items, and templates without data loss after Version 2 upgrade', async () => {
    const dbName = `MigrationTestDB_${Date.now()}`

    // 1. Simulate an existing Version 1 database created prior to Milestone 7.1
    class LegacyV1Database extends Dexie {
      trips!: Dexie.Table<Trip, string>
      items!: Dexie.Table<PackingItem, string>
      templates!: Dexie.Table<PackingTemplate, string>

      constructor() {
        super(dbName)
        this.version(1).stores({
          trips: 'id, destination, startDate, endDate, createdAt',
          items: 'id, tripId, category, priority, isPacked, [tripId+category], itemSlug',
          templates: 'id, isSystem, createdAt',
        })
      }
    }

    const legacyDb = new LegacyV1Database()
    await legacyDb.open()

    // Seed Version 1 records
    const v1Trip: Trip = {
      id: 'trip-v1-existing',
      name: 'Goa Summer Retreat',
      destination: 'Goa',
      startDate: '2026-04-10',
      endDate: '2026-04-15',
      durationDays: 5,
      transportModes: ['flight'],
      activities: ['beach'],
      climate: 'warm',
      travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 0 },
      totalTravellerCount: 2,
      personalPreferences: [],
      hasLaundryAccess: false,
      baggageConfig: { hasCabinBaggage: true, cabinWeightLimitKg: 7, hasCheckedBaggage: true, checkedWeightLimitKg: 20 },
      dismissedItems: [],
      engineVersion: '1.0.0',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    const v1Item: PackingItem = {
      id: 'item-v1-existing',
      tripId: 'trip-v1-existing',
      name: 'Sunscreen SPF 50',
      itemSlug: 'toil-sunscreen-spf50',
      category: 'toiletries',
      priority: 'recommended',
      quantityStrategy: 'fixed',
      generatedQuantity: 1,
      effectiveQuantity: 1,
      packedQuantity: 1,
      isPacked: true,
      isShared: true,
      isCustom: false,
      reasons: ['Beach travel'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    const v1Template: PackingTemplate = {
      id: 'tpl-v1-existing',
      name: 'Beach Getaway',
      description: 'Template for coastal travel',
      isSystem: true,
      items: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    await legacyDb.trips.add(v1Trip)
    await legacyDb.items.add(v1Item)
    await legacyDb.templates.add(v1Template)
    legacyDb.close()

    // 2. Open the same database using modern PackPilotDatabase (Version 2)
    const upgradedDb = new PackPilotDatabase(dbName)
    await upgradedDb.open()

    expect(upgradedDb.verno).toBe(2)

    // 3. Verify all Version 1 data is preserved verbatim
    const retrievedTrip = await upgradedDb.trips.get('trip-v1-existing')
    expect(retrievedTrip).toBeDefined()
    expect(retrievedTrip?.name).toBe('Goa Summer Retreat')
    expect(retrievedTrip?.destination).toBe('Goa')

    const retrievedItem = await upgradedDb.items.get('item-v1-existing')
    expect(retrievedItem).toBeDefined()
    expect(retrievedItem?.name).toBe('Sunscreen SPF 50')
    expect(retrievedItem?.isPacked).toBe(true)

    const retrievedTemplate = await upgradedDb.templates.get('tpl-v1-existing')
    expect(retrievedTemplate).toBeDefined()
    expect(retrievedTemplate?.name).toBe('Beach Getaway')

    // 4. Verify Version 2 cache tables are operational
    await upgradedDb.geo_cache.put({ key: 'geo:pune', data: { name: 'Pune' }, expiresAt: Date.now() + 10000 })
    await upgradedDb.weather_cache.put({ key: 'weather:pune', data: { temp: 25 }, expiresAt: Date.now() + 10000 })

    const geoRecord = await upgradedDb.geo_cache.get('geo:pune')
    const weatherRecord = await upgradedDb.weather_cache.get('weather:pune')

    expect(geoRecord?.data).toEqual({ name: 'Pune' })
    expect(weatherRecord?.data).toEqual({ temp: 25 })

    upgradedDb.close()
  })
})
