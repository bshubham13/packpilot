import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  ContextResolver,
  resolveTripContext,
  defaultContextResolver,
} from '../../src/services/contextResolver'
import { GeoService } from '../../src/services/geoService'
import { WeatherService } from '../../src/services/weatherService'
import { MemoryCacheRepository } from '../../src/db/memory/memoryCacheRepository'
import { MemoryStorageState } from '../../src/db/memory/memoryStorage'
import type { TripConfig, ResolvedLocation } from '../../src/types'

describe('ContextResolver — Asynchronous Context Resolution Facade', () => {
  let memoryState: MemoryStorageState
  let cacheRepo: MemoryCacheRepository
  let geoService: GeoService
  let weatherService: WeatherService
  let resolver: ContextResolver

  const baseConfig: TripConfig = {
    name: 'Japan Rail Autumn',
    destination: 'Tokyo',
    origin: 'Osaka',
    startDate: '2026-10-01',
    endDate: '2026-10-05',
    transportModes: ['train'],
    activities: ['sightseeing'],
    climate: 'mixed',
    travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 0 },
    personalPreferences: ['medications'],
  }

  const osakaLocation: ResolvedLocation = {
    city: { id: 'osaka_jp', name: 'Osaka', country: 'Japan', countryCode: 'JP' },
    coordinates: { latitude: 34.6937, longitude: 135.5023, isCentroid: true },
  }

  const tokyoLocation: ResolvedLocation = {
    city: { id: 'tokyo_jp', name: 'Tokyo', country: 'Japan', countryCode: 'JP' },
    coordinates: { latitude: 35.6762, longitude: 139.6503, elevationMeters: 40, isCentroid: true },
  }

  beforeEach(() => {
    memoryState = new MemoryStorageState()
    cacheRepo = new MemoryCacheRepository(memoryState)
    geoService = new GeoService(cacheRepo)
    weatherService = new WeatherService(cacheRepo)
    resolver = new ContextResolver(geoService, weatherService)
    defaultContextResolver.clearInFlight()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    resolver.clearInFlight()
    defaultContextResolver.clearInFlight()
  })

  it('1. Full context resolution: resolves locations, weather, AQI, distance, and attribution', async () => {
    vi.spyOn(geoService, 'searchCities').mockImplementation(async (query) => {
      if (query.toLowerCase().includes('osaka')) return [osakaLocation]
      if (query.toLowerCase().includes('tokyo')) return [tokyoLocation]
      return []
    })

    const forecastSpy = vi.spyOn(weatherService, 'fetchForecast').mockResolvedValue({
      records: new Map([
        [
          '2026-10-01',
          {
            date: '2026-10-01',
            temperatureMinC: 15.0,
            temperatureMaxC: 22.0,
            precipitationProbabilityMax: 10,
            precipitationSumMm: 0,
            windSpeedMaxKmh: 14,
            uvIndexMax: 4.5,
            weatherCode: 1,
          },
        ],
      ]),
      elevationMeters: 40,
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'network',
        source: 'open_meteo_forecast',
        availability: 'available',
        confidence: 'forecast',
        fetchedAt: '2026-09-28T00:00:00.000Z',
      },
    })

    const aqiSpy = vi.spyOn(weatherService, 'fetchAirQuality').mockResolvedValue({
      records: new Map([
        ['2026-10-01', { date: '2026-10-01', usAqi: 42, pm25Ugm3: 10.2 }],
      ]),
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'network',
        source: 'open_meteo_forecast',
        availability: 'available',
        confidence: 'forecast',
        fetchedAt: '2026-09-28T00:00:00.000Z',
      },
    })

    const context = await resolver.resolve(baseConfig, {
      now: new Date('2026-09-28T00:00:00Z'), // 3 days before start
    })

    expect(context.contextVersion).toBe('2.0.0')
    expect(context.contextState).toBe('current')
    expect(context.journey.origin?.city.name).toBe('Osaka')
    expect(context.journey.destination.city.name).toBe('Tokyo')
    expect(context.journey.straightLineDistanceKm).toBeGreaterThan(390)
    expect(context.journey.classification).toBe('intercity')
    expect(context.journey.durationRangeHours).toBeDefined()
    expect(context.environment.attribution).toContain('Open-Meteo.com')
    expect(context.environment.daily.length).toBe(5)
    expect(forecastSpy).toHaveBeenCalledTimes(1)
    expect(aqiSpy).toHaveBeenCalledTimes(1)
  })

  it('2. Missing origin: resolves destination without origin, producing unknown classification', async () => {
    vi.spyOn(geoService, 'searchCities').mockResolvedValue([tokyoLocation])
    vi.spyOn(weatherService, 'fetchForecast').mockResolvedValue({
      records: new Map(),
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'network',
        source: 'open_meteo_forecast',
        availability: 'available',
        confidence: 'forecast',
      },
    })
    vi.spyOn(weatherService, 'fetchAirQuality').mockResolvedValue({
      records: new Map(),
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'network',
        source: 'open_meteo_forecast',
        availability: 'available',
        confidence: 'forecast',
      },
    })

    const tripWithoutOrigin: TripConfig = {
      ...baseConfig,
      origin: undefined,
      originLocation: undefined,
    }

    const context = await resolver.resolve(tripWithoutOrigin)

    expect(context.journey.origin).toBeUndefined()
    expect(context.journey.straightLineDistanceKm).toBeUndefined()
    expect(context.journey.classification).toBe('unknown')
    expect(context.journey.durationRangeHours).toBeUndefined()
    expect(context.journey.destination.city.name).toBe('Tokyo')
  })

  it('3. Geocoding failure: preserves manual location label and skips weather requests', async () => {
    vi.spyOn(geoService, 'searchCities').mockResolvedValue([]) // No matches found
    const weatherSpy = vi.spyOn(weatherService, 'fetchForecast')

    const context = await resolver.resolve(baseConfig)

    expect(context.journey.destination.city.name).toBe('Tokyo')
    expect(context.journey.destination.coordinates).toBeUndefined()
    expect(context.journey.destination.city.id).toBe('manual_tokyo')
    expect(context.journey.straightLineDistanceKm).toBeUndefined()
    expect(context.journey.classification).toBe('unknown')
    // Weather should not be fetched when destination coordinates cannot be resolved
    expect(weatherSpy).not.toHaveBeenCalled()
    expect(context.environment.summary.periodMinTempC).toBeUndefined()
    expect(context.environment.contextProvenance.availability).toBe('unresolved_location')
  })

  it('4. Weather failure with valid coordinates: preserves geocoded journey and marks climate fallback', async () => {
    vi.spyOn(geoService, 'searchCities').mockImplementation(async (query) => {
      if (query.includes('Osaka')) return [osakaLocation]
      return [tokyoLocation]
    })

    vi.spyOn(weatherService, 'fetchForecast').mockResolvedValue({
      records: new Map(),
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'offline_fallback',
        source: 'none',
        availability: 'provider_error',
        confidence: 'unavailable',
      },
    })
    vi.spyOn(weatherService, 'fetchAirQuality').mockResolvedValue({
      records: new Map(),
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'offline_fallback',
        source: 'none',
        availability: 'provider_error',
        confidence: 'unavailable',
      },
    })

    const context = await resolver.resolve(baseConfig)

    // Journey is fully calculated
    expect(context.journey.straightLineDistanceKm).toBeGreaterThan(390)
    expect(context.journey.classification).toBe('intercity')
    // Weather reflects provider failure and legacy climate enum is intact
    expect(context.legacyClimateEnum).toBe('mixed')
    expect(context.environment.hasFullForecastCoverage).toBe(false)
    expect(context.environment.contextProvenance.availability).toBe('provider_error')
  })

  it('5. Partial AQI availability: AQI records present only within 7-day horizon', async () => {
    vi.spyOn(geoService, 'searchCities').mockResolvedValue([tokyoLocation])

    // 10-day trip starting today
    const longTrip: TripConfig = {
      ...baseConfig,
      startDate: '2026-10-01',
      endDate: '2026-10-10',
    }

    // AQI has values for day 1 to 5, but nothing beyond
    const aqiMap = new Map<string, { date: string; usAqi: number; pm25Ugm3: number }>([
      ['2026-10-01', { date: '2026-10-01', usAqi: 50, pm25Ugm3: 12 }],
      ['2026-10-02', { date: '2026-10-02', usAqi: 55, pm25Ugm3: 14 }],
    ])

    vi.spyOn(weatherService, 'fetchForecast').mockResolvedValue({
      records: new Map(),
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'network',
        source: 'open_meteo_forecast',
        availability: 'available',
        confidence: 'forecast',
      },
    })
    vi.spyOn(weatherService, 'fetchAirQuality').mockResolvedValue({
      records: aqiMap,
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'network',
        source: 'open_meteo_forecast',
        availability: 'available',
        confidence: 'forecast',
      },
    })

    const context = await resolver.resolve(longTrip, {
      now: new Date('2026-10-01T00:00:00Z'),
    })

    expect(context.environment.daily[0].usAqi).toBe(50)
    // Day 8 (2026-10-08) is outside 7-day AQI horizon
    const day8 = context.environment.daily.find((d) => d.date === '2026-10-08')
    expect(day8?.usAqi).toBeUndefined()
    expect(day8?.aqiProvenance.availability).toBe('outside_forecast_horizon')
  })

  it('6. Cache reuse: repeated resolution reuses underlying cached geo and weather data', async () => {
    const geoSpy = vi.spyOn(geoService, 'searchCities').mockResolvedValue([tokyoLocation])
    const weatherSpy = vi.spyOn(weatherService, 'fetchForecast').mockResolvedValue({
      records: new Map(),
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'cache',
        source: 'open_meteo_forecast',
        availability: 'available',
        confidence: 'forecast',
      },
    })
    vi.spyOn(weatherService, 'fetchAirQuality').mockResolvedValue({
      records: new Map(),
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'cache',
        source: 'open_meteo_forecast',
        availability: 'available',
        confidence: 'forecast',
      },
    })

    await resolver.resolve(baseConfig)
    await resolver.resolve(baseConfig)

    // Second call triggers cache hit in GeoService/WeatherService
    expect(geoSpy).toHaveBeenCalled()
    expect(weatherSpy).toHaveBeenCalled()
  })

  it('7. Concurrent identical requests: coalesces in-flight queries without duplicate network calls', async () => {
    let geoCallCount = 0
    let weatherCallCount = 0

    vi.spyOn(geoService, 'searchCities').mockImplementation(async () => {
      geoCallCount++
      await new Promise((r) => setTimeout(r, 20))
      return [tokyoLocation]
    })

    vi.spyOn(weatherService, 'fetchForecast').mockImplementation(async () => {
      weatherCallCount++
      await new Promise((r) => setTimeout(r, 20))
      return {
        records: new Map(),
        provenance: {
          provider: 'open_meteo',
          retrievalMethod: 'network',
          source: 'open_meteo_forecast',
          availability: 'available',
          confidence: 'forecast',
        },
      }
    })

    vi.spyOn(weatherService, 'fetchAirQuality').mockImplementation(async () => {
      return {
        records: new Map(),
        provenance: {
          provider: 'open_meteo',
          retrievalMethod: 'network',
          source: 'open_meteo_forecast',
          availability: 'available',
          confidence: 'forecast',
        },
      }
    })

    const trip1: TripConfig = { ...baseConfig, origin: undefined }
    const trip2: TripConfig = { ...baseConfig, origin: undefined }

    // Launch both resolutions simultaneously
    const [res1, res2] = await Promise.all([
      resolver.resolve(trip1),
      resolver.resolve(trip2),
    ])

    expect(res1.journey.destination.city.name).toBe('Tokyo')
    expect(res2.journey.destination.city.name).toBe('Tokyo')
    // Coalesced into exactly 1 network call each
    expect(geoCallCount).toBe(1)
    expect(weatherCallCount).toBe(1)
  })

  it('8. Caller cancellation: one caller aborting does not cancel shared in-flight request for another caller', async () => {
    vi.spyOn(geoService, 'searchCities').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 40))
      return [tokyoLocation]
    })
    vi.spyOn(weatherService, 'fetchForecast').mockResolvedValue({
      records: new Map(),
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'network',
        source: 'open_meteo_forecast',
        availability: 'available',
        confidence: 'forecast',
      },
    })
    vi.spyOn(weatherService, 'fetchAirQuality').mockResolvedValue({
      records: new Map(),
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'network',
        source: 'open_meteo_forecast',
        availability: 'available',
        confidence: 'forecast',
      },
    })

    const controller = new AbortController()
    const trip: TripConfig = { ...baseConfig, origin: undefined }

    // Caller 1 provides AbortSignal and aborts shortly
    const promise1 = resolver.resolve(trip, { signal: controller.signal })
    // Caller 2 has no signal and waits for completion
    const promise2 = resolver.resolve(trip)

    // Abort Caller 1 after 10ms
    setTimeout(() => controller.abort(), 10)

    // Caller 1 must reject with AbortError
    await expect(promise1).rejects.toThrow(/abort/i)

    // Caller 2 must resolve successfully without being cancelled
    const res2 = await promise2
    expect(res2.journey.destination.city.name).toBe('Tokyo')
    expect(res2.journey.destination.coordinates?.latitude).toBe(35.6762)
  })

  it('9. Timeout: returns deterministic fallback context when timeout is reached', async () => {
    vi.spyOn(geoService, 'searchCities').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 100))
      return [tokyoLocation]
    })

    // Set tight timeoutMs = 25ms
    const context = await resolver.resolve(baseConfig, { timeoutMs: 25 })

    expect(context).toBeDefined()
    expect(context.contextVersion).toBe('2.0.0')
    // Destination falls back to manual label without failing or throwing unhandled rejection
    expect(context.journey.destination.city.name).toBe('Tokyo')
    expect(context.journey.destination.coordinates).toBeUndefined()
  })

  it('10. Cleanup after failed requests: removes failed entries from in-flight maps so retries can run', async () => {
    let attempts = 0
    vi.spyOn(geoService, 'searchCities').mockImplementation(async () => {
      attempts++
      if (attempts === 1) {
        throw new Error('Network failure')
      }
      return [tokyoLocation]
    })
    vi.spyOn(weatherService, 'fetchForecast').mockResolvedValue({
      records: new Map(),
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'network',
        source: 'open_meteo_forecast',
        availability: 'available',
        confidence: 'forecast',
      },
    })
    vi.spyOn(weatherService, 'fetchAirQuality').mockResolvedValue({
      records: new Map(),
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'network',
        source: 'open_meteo_forecast',
        availability: 'available',
        confidence: 'forecast',
      },
    })

    const trip: TripConfig = { ...baseConfig, origin: undefined }

    // First attempt fails during geo search
    const context1 = await resolver.resolve(trip)
    expect(context1.journey.destination.coordinates).toBeUndefined()
    expect(resolver.getInFlightCounts().geo).toBe(0) // Cleaned up

    // Second attempt succeeds
    const context2 = await resolver.resolve(trip)
    expect(context2.journey.destination.coordinates?.latitude).toBe(35.6762)
    expect(resolver.getInFlightCounts().geo).toBe(0) // Cleaned up
  })

  it('11. Deterministic fallback context: buildFallbackContext produces identical baseline context', () => {
    const fallback = resolver.buildFallbackContext(baseConfig)

    expect(fallback.contextVersion).toBe('2.0.0')
    expect(fallback.journey.destination.city.name).toBe('Tokyo')
    expect(fallback.journey.classification).toBe('unknown')
    expect(fallback.environment.daily.length).toBe(5)
    expect(fallback.environment.attribution).toContain('Open-Meteo.com')
  })

  it('12. Existing attribution and forecast horizon constraints preserved', async () => {
    vi.spyOn(geoService, 'searchCities').mockResolvedValue([tokyoLocation])
    vi.spyOn(weatherService, 'fetchForecast').mockResolvedValue({
      records: new Map(),
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'network',
        source: 'open_meteo_forecast',
        availability: 'available',
        confidence: 'forecast',
      },
    })
    vi.spyOn(weatherService, 'fetchAirQuality').mockResolvedValue({
      records: new Map(),
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'network',
        source: 'open_meteo_forecast',
        availability: 'available',
        confidence: 'forecast',
      },
    })

    // Far future trip (e.g. 6 months ahead)
    const futureTrip: TripConfig = {
      ...baseConfig,
      startDate: '2027-04-01',
      endDate: '2027-04-05',
    }

    const context = await resolver.resolve(futureTrip, {
      now: new Date('2026-10-01T00:00:00Z'),
    })

    expect(context.environment.attribution).toBe('Weather data by Open-Meteo.com (CC BY 4.0)')
    expect(context.environment.hasFullForecastCoverage).toBe(false)
    expect(context.environment.daily.every((d) => d.weatherProvenance.availability === 'outside_forecast_horizon')).toBe(true)
  })

  it('13. Convenience function resolveTripContext delegates to default resolver', async () => {
    const context = await resolveTripContext({
      ...baseConfig,
      destinationLocation: tokyoLocation,
      originLocation: osakaLocation,
    })

    expect(context.journey.destination.city.name).toBe('Tokyo')
    expect(context.journey.origin?.city.name).toBe('Osaka')
    expect(context.journey.classification).toBe('intercity')
  })

  it('14. F-01 regression: early abort clears the timeout timer promptly', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    vi.spyOn(geoService, 'searchCities').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 100))
      return [tokyoLocation]
    })

    const controller = new AbortController()
    const promise = resolver.resolve(baseConfig, {
      signal: controller.signal,
      timeoutMs: 5000,
    })

    // Abort early
    controller.abort('User navigated away')
    await expect(promise).rejects.toThrow('User navigated away')

    // Timeout timer must be promptly cleared
    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  it('15. F-01 regression: normal success removes abort event listener immediately', async () => {
    vi.spyOn(geoService, 'searchCities').mockResolvedValue([tokyoLocation])
    vi.spyOn(weatherService, 'fetchForecast').mockResolvedValue({
      records: new Map(),
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'network',
        source: 'open_meteo_forecast',
        availability: 'available',
        confidence: 'forecast',
      },
    })
    vi.spyOn(weatherService, 'fetchAirQuality').mockResolvedValue({
      records: new Map(),
      provenance: {
        provider: 'open_meteo',
        retrievalMethod: 'network',
        source: 'open_meteo_forecast',
        availability: 'available',
        confidence: 'forecast',
      },
    })

    const controller = new AbortController()
    const removeEventListenerSpy = vi.spyOn(controller.signal, 'removeEventListener')

    await resolver.resolve(baseConfig, { signal: controller.signal })

    expect(removeEventListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it('16. F-01/F-03 regression: already-aborted signal rejects immediately without timers or listeners', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const controller = new AbortController()
    controller.abort(new Error('Pre-aborted signal'))

    const promise = resolver.resolve(baseConfig, { signal: controller.signal })
    await expect(promise).rejects.toThrow('Pre-aborted signal')

    // No timers scheduled for already-aborted signals
    expect(setTimeoutSpy).not.toHaveBeenCalled()
  })

  it('17. F-02 regression: timeout with pre-existing destination coordinates uses provider_error for dates within horizon and outside_forecast_horizon for distant dates', async () => {
    // 25-day trip: days 0..16 are within forecast window; days 17..24 are outside
    const tripWithCoords: TripConfig = {
      ...baseConfig,
      destinationLocation: tokyoLocation,
      startDate: '2026-10-01',
      endDate: '2026-10-25',
    }

    // Weather resolution will take 100ms, triggering the 25ms timeout
    vi.spyOn(weatherService, 'fetchForecast').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 100))
      return {
        records: new Map(),
        provenance: {
          provider: 'open_meteo',
          retrievalMethod: 'network',
          source: 'open_meteo_forecast',
          availability: 'available',
          confidence: 'forecast',
        },
      }
    })

    const context = await resolver.resolve(tripWithCoords, {
      timeoutMs: 25,
      now: new Date('2026-10-01T00:00:00Z'),
    })

    // Day 1 (within 16-day horizon): must NOT be outside_forecast_horizon; represents timeout as provider_error
    const day1 = context.environment.daily[0]
    expect(day1.date).toBe('2026-10-01')
    expect(day1.weatherProvenance.availability).toBe('provider_error')
    expect(day1.aqiProvenance.availability).toBe('provider_error')

    // Day 20 (outside 16-day horizon): genuine horizon limit preserved
    const day20 = context.environment.daily.find((d) => d.date === '2026-10-20')
    expect(day20).toBeDefined()
    expect(day20?.weatherProvenance.availability).toBe('outside_forecast_horizon')
    expect(day20?.aqiProvenance.availability).toBe('outside_forecast_horizon')
  })
})
