/**
 * PackPilot — Weather Forecast & Air Quality Service
 * Connects to Open-Meteo Forecast (up to 16 days) and Air Quality (up to 7 days) APIs.
 * Enforces strict per-day independent provenance, 6-hour caching, and zero measurement fabrication.
 */

import type { Coordinates, MetricProvenance } from '../types'
import type { ICacheRepository } from '../db/interfaces'
import { getStorageContext } from '../db/factory'

export const OPEN_METEO_ATTRIBUTION = 'Weather data by Open-Meteo.com (CC BY 4.0)'
export const WEATHER_CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

export interface RawDailyForecastData {
  time: string[]
  temperature_2m_max?: number[]
  temperature_2m_min?: number[]
  precipitation_sum?: number[]
  precipitation_probability_max?: number[]
  windspeed_10m_max?: number[]
  uv_index_max?: number[]
  weathercode?: number[]
}

export interface RawHourlyAqiData {
  time: string[]
  us_aqi?: number[]
  pm2_5?: number[]
  pm10?: number[]
}

export interface OpenMeteoForecastResponse {
  latitude: number
  longitude: number
  elevation?: number
  daily?: RawDailyForecastData
}

export interface OpenMeteoAqiResponse {
  latitude: number
  longitude: number
  hourly?: RawHourlyAqiData
}

export interface DailyForecastRecord {
  date: string
  temperatureMinC?: number
  temperatureMaxC?: number
  precipitationSumMm?: number
  precipitationProbabilityMax?: number
  windSpeedMaxKmh?: number
  uvIndexMax?: number
  weatherCode?: number
}

export interface DailyAqiRecord {
  date: string
  usAqi?: number
  pm25Ugm3?: number
}

export class WeatherService {
  private cacheRepo?: ICacheRepository

  constructor(cacheRepo?: ICacheRepository) {
    this.cacheRepo = cacheRepo
  }

  private getCache(): ICacheRepository {
    return this.cacheRepo || getStorageContext().cache
  }

  /**
   * Fetches Open-Meteo forecast (up to 16 days) with 6-hour caching and timeout protection.
   */
  async fetchForecast(
    coords: Coordinates,
    options?: { signal?: AbortSignal; timeoutMs?: number; now?: Date }
  ): Promise<{
    records: Map<string, DailyForecastRecord>
    elevationMeters?: number
    provenance: MetricProvenance
  }> {
    const latKey = coords.latitude.toFixed(4)
    const lonKey = coords.longitude.toFixed(4)
    const cacheKey = `weather:${latKey}_${lonKey}`
    const cache = this.getCache()

    // 1. Check cache
    try {
      const cached = await cache.get<{
        records: [string, DailyForecastRecord][]
        elevationMeters?: number
        fetchedAt: string
      }>(cacheKey)

      if (cached && Array.isArray(cached.records)) {
        return {
          records: new Map(cached.records),
          elevationMeters: cached.elevationMeters,
          provenance: {
            provider: 'open_meteo',
            retrievalMethod: 'cache',
            fetchedAt: cached.fetchedAt,
            source: 'open_meteo_forecast',
            availability: 'available',
            confidence: 'forecast',
          },
        }
      }
    } catch {
      // Safe ignore cache read failure
    }

    // 2. Fetch live forecast with timeout
    const timeoutMs = options?.timeoutMs || 3500
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    if (options?.signal) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max,uv_index_max,weathercode&timezone=auto`
      const res = await fetch(url, { signal: controller.signal })

      if (!res.ok) {
        return {
          records: new Map(),
          provenance: {
            provider: 'open_meteo',
            retrievalMethod: 'network',
            source: 'none',
            availability: 'provider_error',
            confidence: 'unavailable',
          },
        }
      }

      const json: OpenMeteoForecastResponse = await res.json()
      const records = new Map<string, DailyForecastRecord>()
      const daily = json.daily

      if (daily && Array.isArray(daily.time)) {
        for (let i = 0; i < daily.time.length; i++) {
          const date = daily.time[i]
          records.set(date, {
            date,
            temperatureMinC: daily.temperature_2m_min?.[i],
            temperatureMaxC: daily.temperature_2m_max?.[i],
            precipitationSumMm: daily.precipitation_sum?.[i],
            precipitationProbabilityMax: daily.precipitation_probability_max?.[i],
            windSpeedMaxKmh: daily.windspeed_10m_max?.[i],
            uvIndexMax: daily.uv_index_max?.[i],
            weatherCode: daily.weathercode?.[i],
          })
        }
      }

      const nowIso = new Date().toISOString()
      const elevationMeters = typeof json.elevation === 'number' ? Math.round(json.elevation) : undefined

      // Store in cache
      try {
        await cache.set(
          cacheKey,
          {
            records: Array.from(records.entries()),
            elevationMeters,
            fetchedAt: nowIso,
          },
          WEATHER_CACHE_TTL_MS
        )
      } catch {
        // Safe ignore cache write failure
      }

      return {
        records,
        elevationMeters,
        provenance: {
          provider: 'open_meteo',
          retrievalMethod: 'network',
          fetchedAt: nowIso,
          source: 'open_meteo_forecast',
          availability: 'available',
          confidence: 'forecast',
        },
      }
    } catch {
      return {
        records: new Map(),
        provenance: {
          provider: 'open_meteo',
          retrievalMethod: 'offline_fallback',
          source: 'none',
          availability: 'provider_error',
          confidence: 'unavailable',
        },
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Fetches Open-Meteo Air Quality (up to 7 days) with 6-hour caching and timeout protection.
   */
  async fetchAirQuality(
    coords: Coordinates,
    options?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<{
    records: Map<string, DailyAqiRecord>
    provenance: MetricProvenance
  }> {
    const latKey = coords.latitude.toFixed(4)
    const lonKey = coords.longitude.toFixed(4)
    const cacheKey = `aqi:${latKey}_${lonKey}`
    const cache = this.getCache()

    // 1. Check cache
    try {
      const cached = await cache.get<{
        records: [string, DailyAqiRecord][]
        fetchedAt: string
      }>(cacheKey)

      if (cached && Array.isArray(cached.records)) {
        return {
          records: new Map(cached.records),
          provenance: {
            provider: 'open_meteo',
            retrievalMethod: 'cache',
            fetchedAt: cached.fetchedAt,
            source: 'open_meteo_forecast',
            availability: 'available',
            confidence: 'forecast',
          },
        }
      }
    } catch {
      // Safe ignore cache read failure
    }

    // 2. Fetch live AQI with timeout
    const timeoutMs = options?.timeoutMs || 3500
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    if (options?.signal) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    try {
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coords.latitude}&longitude=${coords.longitude}&hourly=us_aqi,pm2_5,pm10&timezone=auto`
      const res = await fetch(url, { signal: controller.signal })

      if (!res.ok) {
        return {
          records: new Map(),
          provenance: {
            provider: 'open_meteo',
            retrievalMethod: 'network',
            source: 'none',
            availability: 'provider_error',
            confidence: 'unavailable',
          },
        }
      }

      const json: OpenMeteoAqiResponse = await res.json()
      const records = new Map<string, DailyAqiRecord>()
      const hourly = json.hourly

      if (hourly && Array.isArray(hourly.time)) {
        // Aggregate hourly values into daily peaks
        for (let i = 0; i < hourly.time.length; i++) {
          const timeStr = hourly.time[i]
          const date = timeStr.split('T')[0]
          const usAqi = hourly.us_aqi?.[i]
          const pm25 = hourly.pm2_5?.[i]

          const existing = records.get(date) || { date }

          if (typeof usAqi === 'number' && Number.isFinite(usAqi)) {
            existing.usAqi = Math.max(existing.usAqi ?? 0, Math.round(usAqi))
          }
          if (typeof pm25 === 'number' && Number.isFinite(pm25)) {
            existing.pm25Ugm3 = Math.max(existing.pm25Ugm3 ?? 0, Math.round(pm25 * 10) / 10)
          }

          records.set(date, existing)
        }
      }

      const nowIso = new Date().toISOString()

      // Store in cache
      try {
        await cache.set(
          cacheKey,
          {
            records: Array.from(records.entries()),
            fetchedAt: nowIso,
          },
          WEATHER_CACHE_TTL_MS
        )
      } catch {
        // Safe ignore cache write failure
      }

      return {
        records,
        provenance: {
          provider: 'open_meteo',
          retrievalMethod: 'network',
          fetchedAt: nowIso,
          source: 'open_meteo_forecast',
          availability: 'available',
          confidence: 'forecast',
        },
      }
    } catch {
      return {
        records: new Map(),
        provenance: {
          provider: 'open_meteo',
          retrievalMethod: 'offline_fallback',
          source: 'none',
          availability: 'provider_error',
          confidence: 'unavailable',
        },
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

export const defaultWeatherService = new WeatherService()
