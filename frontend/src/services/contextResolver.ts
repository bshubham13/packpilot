/**
 * PackPilot — Asynchronous Trip Context Resolver Service
 * Orchestrates geocoding, weather forecasts, and air quality retrieval to assemble
 * a complete, validated NormalizedTripContext with request coalescing, timeout protection,
 * and deterministic offline fallbacks.
 */

import type {
  TripConfig,
  NormalizedTripContext,
  ResolvedLocation,
  Coordinates,
  MetricProvenance,
  ContextState,
} from '../types'
import {
  GeoService,
  defaultGeoService,
  createManualLocation,
  slugifyCity,
} from './geoService'
import {
  WeatherService,
  defaultWeatherService,
  type DailyForecastRecord,
  type DailyAqiRecord,
} from './weatherService'
import { buildNormalizedTripContext } from './contextBuilder'

export interface ResolveContextOptions {
  tripId?: string
  geoService?: GeoService
  weatherService?: WeatherService
  signal?: AbortSignal
  timeoutMs?: number
  now?: Date
  contextState?: ContextState
}

export const DEFAULT_RESOLVE_TIMEOUT_MS = 4000

export function createAbortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) {
    const err = signal.reason
    if (!err.name || err.name === 'Error') {
      err.name = 'AbortError'
    }
    return err
  }
  const message = typeof signal?.reason === 'string' ? signal.reason : 'Operation aborted'
  const err = new Error(message)
  err.name = 'AbortError'
  return err
}

export class ContextResolver {
  private geoService: GeoService
  private weatherService: WeatherService

  // In-flight request coalescing maps
  private inFlightGeo = new Map<string, Promise<ResolvedLocation[]>>()
  private inFlightWeather = new Map<
    string,
    Promise<{
      records: Map<string, DailyForecastRecord>
      elevationMeters?: number
      provenance: MetricProvenance
    }>
  >()
  private inFlightAqi = new Map<
    string,
    Promise<{
      records: Map<string, DailyAqiRecord>
      provenance: MetricProvenance
    }>
  >()

  constructor(geoService?: GeoService, weatherService?: WeatherService) {
    this.geoService = geoService || defaultGeoService
    this.weatherService = weatherService || defaultWeatherService
  }

  /**
   * Clears any pending in-flight request tracking. Useful for test cleanup.
   */
  clearInFlight(): void {
    this.inFlightGeo.clear()
    this.inFlightWeather.clear()
    this.inFlightAqi.clear()
  }

  /**
   * Inspect current in-flight request count for testing and monitoring.
   */
  getInFlightCounts(): { geo: number; weather: number; aqi: number } {
    return {
      geo: this.inFlightGeo.size,
      weather: this.inFlightWeather.size,
      aqi: this.inFlightAqi.size,
    }
  }

  /**
   * Coalesces concurrent geocoding requests for identical city query strings.
   * Isolates caller cancellation so one caller's abort does not abort shared requests.
   */
  private async coalescedSearchCities(
    geo: GeoService,
    cityName: string,
    timeoutMs: number
  ): Promise<ResolvedLocation[]> {
    const normalizedKey = slugifyCity(cityName)
    if (!normalizedKey) return []

    const existing = this.inFlightGeo.get(normalizedKey)
    if (existing) {
      return existing
    }

    const promise = (async () => {
      try {
        return await geo.searchCities(cityName, { timeoutMs })
      } catch {
        return []
      } finally {
        this.inFlightGeo.delete(normalizedKey)
      }
    })()

    this.inFlightGeo.set(normalizedKey, promise)
    return promise
  }

  /**
   * Coalesces concurrent weather forecast requests for identical coordinate pairs.
   * Note: In-flight key matches WeatherService.ts cache key format: "weather:${lat.toFixed(4)}_${lon.toFixed(4)}".
   * Open-Meteo forecast queries are pinned to centroid coordinates; elevation is retrieved from the
   * response body rather than partitioned in the query key.
   */
  private async coalescedFetchForecast(
    weather: WeatherService,
    coords: Coordinates,
    timeoutMs: number
  ): Promise<{
    records: Map<string, DailyForecastRecord>
    elevationMeters?: number
    provenance: MetricProvenance
  }> {
    const key = `${coords.latitude.toFixed(4)}_${coords.longitude.toFixed(4)}`
    const existing = this.inFlightWeather.get(key)
    if (existing) {
      return existing
    }

    const promise = (async (): Promise<{
      records: Map<string, DailyForecastRecord>
      elevationMeters?: number
      provenance: MetricProvenance
    }> => {
      try {
        return await weather.fetchForecast(coords, { timeoutMs })
      } catch {
        const errorProv: MetricProvenance = {
          provider: 'open_meteo',
          retrievalMethod: 'offline_fallback',
          source: 'none',
          availability: 'provider_error',
          confidence: 'unavailable',
        }
        return {
          records: new Map<string, DailyForecastRecord>(),
          provenance: errorProv,
        }
      } finally {
        this.inFlightWeather.delete(key)
      }
    })()

    this.inFlightWeather.set(key, promise)
    return promise
  }

  /**
   * Coalesces concurrent air quality requests for identical coordinate pairs.
   */
  private async coalescedFetchAqi(
    weather: WeatherService,
    coords: Coordinates,
    timeoutMs: number
  ): Promise<{
    records: Map<string, DailyAqiRecord>
    provenance: MetricProvenance
  }> {
    const key = `${coords.latitude.toFixed(4)}_${coords.longitude.toFixed(4)}`
    const existing = this.inFlightAqi.get(key)
    if (existing) {
      return existing
    }

    const promise = (async (): Promise<{
      records: Map<string, DailyAqiRecord>
      provenance: MetricProvenance
    }> => {
      try {
        return await weather.fetchAirQuality(coords, { timeoutMs })
      } catch {
        const errorProv: MetricProvenance = {
          provider: 'open_meteo',
          retrievalMethod: 'offline_fallback',
          source: 'none',
          availability: 'provider_error',
          confidence: 'unavailable',
        }
        return {
          records: new Map<string, DailyAqiRecord>(),
          provenance: errorProv,
        }
      } finally {
        this.inFlightAqi.delete(key)
      }
    })()

    this.inFlightAqi.set(key, promise)
    return promise
  }

  /**
   * Assembles a pure, deterministic offline fallback context without external I/O.
   * If destination coordinates are already present, represents failed/timed-out environmental
   * resolution as provider_error rather than letting days within horizon default to outside_forecast_horizon.
   */
  buildFallbackContext(
    config: TripConfig,
    options: ResolveContextOptions = {}
  ): NormalizedTripContext {
    let destination = config.destinationLocation
    if (!destination) {
      destination = createManualLocation(config.destination || 'Destination')
    }

    let origin = config.originLocation
    if (!origin && config.origin && config.origin.trim()) {
      origin = createManualLocation(config.origin)
    }

    let weatherProvenance: MetricProvenance | undefined = undefined
    let aqiProvenance: MetricProvenance | undefined = undefined

    if (destination.coordinates) {
      weatherProvenance = {
        provider: 'open_meteo',
        retrievalMethod: 'offline_fallback',
        source: 'none',
        availability: 'provider_error',
        confidence: 'unavailable',
      }
      aqiProvenance = {
        provider: 'open_meteo',
        retrievalMethod: 'offline_fallback',
        source: 'none',
        availability: 'provider_error',
        confidence: 'unavailable',
      }
    }

    return buildNormalizedTripContext(config, {
      tripId: options.tripId,
      resolvedOrigin: origin,
      resolvedDestination: destination,
      weatherProvenance,
      aqiProvenance,
      now: options.now,
      contextState: options.contextState,
    })
  }

  /**
   * Resolves complete NormalizedTripContext by coordinating geocoding, weather forecasts,
   * air quality, and heuristic journey calculations.
   */
  async resolve(
    config: TripConfig,
    options: ResolveContextOptions = {}
  ): Promise<NormalizedTripContext> {
    const { signal } = options
    if (signal?.aborted) {
      throw createAbortError(signal)
    }

    const timeoutMs = options.timeoutMs ?? DEFAULT_RESOLVE_TIMEOUT_MS

    return new Promise<NormalizedTripContext>((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      let cleanupAbortListener: (() => void) | undefined

      const cleanup = () => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId)
          timeoutId = undefined
        }
        if (cleanupAbortListener) {
          cleanupAbortListener()
          cleanupAbortListener = undefined
        }
      }

      if (signal) {
        const onAbort = () => {
          cleanup()
          reject(createAbortError(signal))
        }
        signal.addEventListener('abort', onAbort, { once: true })
        cleanupAbortListener = () => signal.removeEventListener('abort', onAbort)
      }

      // Schedule caller-specific timeout timer
      timeoutId = setTimeout(() => {
        cleanup()
        resolve(this.buildFallbackContext(config, options))
      }, timeoutMs)

      // Start or join execution promise (which shares underlying in-flight requests)
      this.doResolve(config, options, timeoutMs).then(
        (val) => {
          cleanup()
          resolve(val)
        },
        (err) => {
          cleanup()
          reject(err)
        }
      )
    })
  }

  private async doResolve(
    config: TripConfig,
    options: ResolveContextOptions,
    timeoutMs: number
  ): Promise<NormalizedTripContext> {
    const geo = options.geoService || this.geoService
    const weather = options.weatherService || this.weatherService

    // 1. Resolve Locations (Origin and Destination in parallel)
    const resolveDest = async (): Promise<ResolvedLocation> => {
      if (config.destinationLocation?.coordinates) {
        return config.destinationLocation
      }
      const rawDest = config.destination?.trim()
      if (!rawDest) {
        return config.destinationLocation || createManualLocation('Unknown Destination')
      }
      const results = await this.coalescedSearchCities(geo, rawDest, timeoutMs)
      if (results.length > 0) {
        return results[0]
      }
      return config.destinationLocation || createManualLocation(rawDest)
    }

    const resolveOrig = async (): Promise<ResolvedLocation | undefined> => {
      if (config.originLocation?.coordinates) {
        return config.originLocation
      }
      const rawOrig = config.origin?.trim()
      if (!rawOrig) {
        return config.originLocation
      }
      const results = await this.coalescedSearchCities(geo, rawOrig, timeoutMs)
      if (results.length > 0) {
        return results[0]
      }
      return config.originLocation || createManualLocation(rawOrig)
    }

    const [resolvedDestination, resolvedOrigin] = await Promise.all([
      resolveDest(),
      resolveOrig(),
    ])

    // 2. Resolve Environmental Intelligence (if destination coordinates resolved)
    let weatherForecastRecords: Map<string, DailyForecastRecord> | undefined = undefined
    let weatherProvenance: MetricProvenance | undefined = undefined
    let aqiRecords: Map<string, DailyAqiRecord> | undefined = undefined
    let aqiProvenance: MetricProvenance | undefined = undefined
    let elevationMeters: number | undefined = undefined

    if (resolvedDestination.coordinates) {
      const coords = resolvedDestination.coordinates
      const [weatherResult, aqiResult] = await Promise.all([
        this.coalescedFetchForecast(weather, coords, timeoutMs),
        this.coalescedFetchAqi(weather, coords, timeoutMs),
      ])

      weatherForecastRecords = weatherResult.records
      weatherProvenance = weatherResult.provenance
      elevationMeters = weatherResult.elevationMeters ?? coords.elevationMeters

      aqiRecords = aqiResult.records
      aqiProvenance = aqiResult.provenance
    } else {
      weatherProvenance = {
        provider: 'none',
        retrievalMethod: 'offline_fallback',
        source: 'none',
        availability: 'unresolved_location',
        confidence: 'unavailable',
      }
      aqiProvenance = {
        provider: 'none',
        retrievalMethod: 'offline_fallback',
        source: 'none',
        availability: 'unresolved_location',
        confidence: 'unavailable',
      }
    }

    // 3. Assemble NormalizedTripContext via pure ContextBuilder
    return buildNormalizedTripContext(config, {
      tripId: options.tripId,
      resolvedOrigin,
      resolvedDestination,
      weatherForecastRecords,
      weatherProvenance,
      aqiRecords,
      aqiProvenance,
      elevationMeters,
      now: options.now,
      contextState: options.contextState,
    })
  }
}

export const defaultContextResolver = new ContextResolver()

export function resolveTripContext(
  config: TripConfig,
  options?: ResolveContextOptions
): Promise<NormalizedTripContext> {
  return defaultContextResolver.resolve(config, options)
}
