import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  WeatherService,
  OPEN_METEO_ATTRIBUTION,
  type OpenMeteoForecastResponse,
  type OpenMeteoAqiResponse,
} from '../../src/services/weatherService'
import { MemoryCacheRepository } from '../../src/db/memory/memoryCacheRepository'
import { MemoryStorageState } from '../../src/db/memory/memoryStorage'
import type { Coordinates } from '../../src/types'

describe('WeatherService — Forecast & Air Quality', () => {
  let memoryState: MemoryStorageState
  let cacheRepo: MemoryCacheRepository
  let weatherService: WeatherService

  const testCoords: Coordinates = {
    latitude: 28.6139,
    longitude: 77.209,
    elevationMeters: 216,
    isCentroid: true,
  }

  beforeEach(() => {
    memoryState = new MemoryStorageState()
    cacheRepo = new MemoryCacheRepository(memoryState)
    weatherService = new WeatherService(cacheRepo)
    vi.restoreAllMocks()
  })

  it('exposes the mandatory Open-Meteo attribution string', () => {
    expect(OPEN_METEO_ATTRIBUTION).toContain('Weather data by Open-Meteo.com')
    expect(OPEN_METEO_ATTRIBUTION).toContain('CC BY 4.0')
  })

  it('fetches forecast data, maps daily fields, and caches with 6-hour TTL', async () => {
    const mockResponse: OpenMeteoForecastResponse = {
      latitude: 28.6139,
      longitude: 77.209,
      elevation: 216,
      daily: {
        time: ['2026-12-15', '2026-12-16'],
        temperature_2m_min: [7.2, 8.1],
        temperature_2m_max: [21.5, 22.0],
        precipitation_sum: [0.0, 3.5],
        precipitation_probability_max: [5, 60],
        windspeed_10m_max: [12.4, 15.1],
        uv_index_max: [4.2, 4.0],
        weathercode: [0, 61],
      },
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await weatherService.fetchForecast(testCoords)
    expect(result.elevationMeters).toBe(216)
    expect(result.provenance.availability).toBe('available')
    expect(result.provenance.confidence).toBe('forecast')
    expect(result.records.size).toBe(2)

    const day1 = result.records.get('2026-12-15')
    expect(day1?.temperatureMinC).toBe(7.2)
    expect(day1?.temperatureMaxC).toBe(21.5)
    expect(day1?.precipitationProbabilityMax).toBe(5)

    // Repeat call should be served from cache
    const secondResult = await weatherService.fetchForecast(testCoords)
    expect(secondResult.provenance.retrievalMethod).toBe('cache')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('fetches air quality and aggregates hourly values into daily peaks', async () => {
    const mockAqiResponse: OpenMeteoAqiResponse = {
      latitude: 28.6139,
      longitude: 77.209,
      hourly: {
        time: ['2026-12-15T01:00', '2026-12-15T12:00', '2026-12-16T08:00'],
        us_aqi: [180, 245, 160],
        pm2_5: [95.4, 142.1, 88.0],
      },
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockAqiResponse,
    } as Response)

    const result = await weatherService.fetchAirQuality(testCoords)
    expect(result.records.size).toBe(2)

    const dec15 = result.records.get('2026-12-15')
    // Max US AQI on Dec 15 was 245, Max PM2.5 was 142.1
    expect(dec15?.usAqi).toBe(245)
    expect(dec15?.pm25Ugm3).toBe(142.1)
  })

  it('handles network failure gracefully without throwing unhandled exceptions', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'))

    const result = await weatherService.fetchForecast(testCoords)
    expect(result.records.size).toBe(0)
    expect(result.provenance.availability).toBe('provider_error')
    expect(result.provenance.confidence).toBe('unavailable')
  })
})
