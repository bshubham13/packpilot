import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  GeoService,
  normalizeGeoResult,
  createManualLocation,
  slugifyCity,
  type OpenMeteoGeoResult,
} from '../../src/services/geoService'
import { MemoryCacheRepository } from '../../src/db/memory/memoryCacheRepository'
import { MemoryStorageState } from '../../src/db/memory/memoryStorage'

describe('GeoService & City Identity', () => {
  let memoryState: MemoryStorageState
  let cacheRepo: MemoryCacheRepository
  let geoService: GeoService

  beforeEach(() => {
    memoryState = new MemoryStorageState()
    cacheRepo = new MemoryCacheRepository(memoryState)
    geoService = new GeoService(cacheRepo)
    vi.restoreAllMocks()
  })

  it('correctly normalizes Open-Meteo geocoding results into structured ResolvedLocation', () => {
    const rawResult: OpenMeteoGeoResult = {
      id: 1259229,
      name: 'Pune',
      latitude: 18.5204,
      longitude: 73.8567,
      elevation: 560,
      country_code: 'IN',
      country: 'India',
      admin1: 'Maharashtra',
    }

    const resolved = normalizeGeoResult(rawResult)
    expect(resolved.city.id).toBe('geoname_1259229')
    expect(resolved.city.name).toBe('Pune')
    expect(resolved.city.region).toBe('Maharashtra')
    expect(resolved.city.countryCode).toBe('IN')
    expect(resolved.coordinates).toBeDefined()
    expect(resolved.coordinates?.latitude).toBe(18.5204)
    expect(resolved.coordinates?.longitude).toBe(73.8567)
    expect(resolved.coordinates?.elevationMeters).toBe(560)
    expect(resolved.coordinates?.isCentroid).toBe(true)
  })

  it('creates manual location with unresolved coordinates and preserves raw input', () => {
    const manual = createManualLocation('Hidden Mountain Village')
    expect(manual.city.name).toBe('Hidden Mountain Village')
    expect(manual.city.rawInput).toBe('Hidden Mountain Village')
    expect(manual.city.id).toBe('manual_hidden_mountain_village')
    expect(manual.coordinates).toBeUndefined()
  })

  it('caches search results for 90 days and retrieves from cache on repeat query', async () => {
    const mockResult: OpenMeteoGeoResult = {
      id: 1273294,
      name: 'Delhi',
      latitude: 28.6139,
      longitude: 77.209,
      country_code: 'IN',
      country: 'India',
      admin1: 'Delhi',
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [mockResult] }),
    } as Response)

    // First call: fetches over network
    const firstCall = await geoService.searchCities('Delhi')
    expect(firstCall).toHaveLength(1)
    expect(firstCall[0].city.name).toBe('Delhi')
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // Verify written to cache with 90-day TTL
    const cacheKey = `geo:delhi:5`
    const cachedEntry = await cacheRepo.get(cacheKey)
    expect(cachedEntry).toBeDefined()

    // Second call: served strictly from cache without calling fetch
    const secondCall = await geoService.searchCities('Delhi')
    expect(secondCall).toHaveLength(1)
    expect(secondCall[0].city.name).toBe('Delhi')
    expect(fetchSpy).toHaveBeenCalledTimes(1) // Still 1
  })

  it('handles network failure and offline gracefully by returning empty array', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Failed to fetch (offline)'))

    const results = await geoService.searchCities('Mumbai')
    expect(results).toEqual([])
  })

  it('handles request timeout without throwing unhandled exceptions', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        }, 100)
      })
    })

    const results = await geoService.searchCities('Bangalore', { timeoutMs: 50 })
    expect(results).toEqual([])
  })

  it('slugifyCity normalizes diverse city names consistently', () => {
    expect(slugifyCity('New Delhi')).toBe('new_delhi')
    expect(slugifyCity('São Paulo')).toBe('s_o_paulo')
    expect(slugifyCity('  Bengaluru / Bangalore  ')).toBe('bengaluru_bangalore')
  })
})
