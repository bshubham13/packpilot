/**
 * PackPilot — Geocoding & City Identity Service
 * Connects to Open-Meteo Geocoding API with 90-day caching, debouncing support, and offline safety.
 */

import type { ResolvedLocation, CityIdentity, Coordinates } from '../types'
import type { ICacheRepository } from '../db/interfaces'
import { getStorageContext } from '../db/factory'

export const GEO_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000 // 90 days

export interface OpenMeteoGeoResult {
  id?: number
  name: string
  latitude: number
  longitude: number
  elevation?: number
  feature_code?: string
  country_code?: string
  country?: string
  admin1?: string
  admin2?: string
}

export interface OpenMeteoGeoResponse {
  results?: OpenMeteoGeoResult[]
  generationtime_ms?: number
}

export function slugifyCity(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function normalizeGeoResult(result: OpenMeteoGeoResult): ResolvedLocation {
  const countryCode = (result.country_code || '').toUpperCase()
  const region = result.admin1?.trim() || undefined
  const name = result.name.trim()
  
  const id = result.id
    ? `geoname_${result.id}`
    : `${slugifyCity(name)}_${slugifyCity(region || '')}_${slugifyCity(countryCode)}`

  const city: CityIdentity = {
    id,
    name,
    region,
    country: result.country?.trim() || countryCode,
    countryCode,
  }

  const coordinates: Coordinates = {
    latitude: result.latitude,
    longitude: result.longitude,
    elevationMeters: typeof result.elevation === 'number' && Number.isFinite(result.elevation)
      ? Math.round(result.elevation)
      : undefined,
    isCentroid: true,
  }

  return { city, coordinates }
}

export function createManualLocation(rawInput: string): ResolvedLocation {
  const trimmed = rawInput.trim()
  return {
    city: {
      id: `manual_${slugifyCity(trimmed)}`,
      name: trimmed,
      country: 'Unknown',
      countryCode: 'XX',
      rawInput: trimmed,
    },
    coordinates: undefined, // Explicitly unresolved
  }
}

export class GeoService {
  private cacheRepo?: ICacheRepository

  constructor(cacheRepo?: ICacheRepository) {
    this.cacheRepo = cacheRepo
  }

  private getCache(): ICacheRepository {
    return this.cacheRepo || getStorageContext().cache
  }

  /**
   * Searches for cities matching query string with 90-day caching and timeout protection.
   */
  async searchCities(
    query: string,
    options?: { limit?: number; signal?: AbortSignal; timeoutMs?: number }
  ): Promise<ResolvedLocation[]> {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 2) {
      return []
    }

    const limit = Math.min(Math.max(options?.limit || 5, 1), 10)
    const normalizedKey = `geo:${slugifyCity(trimmed)}:${limit}`
    const cache = this.getCache()

    // 1. Check cache first
    try {
      const cached = await cache.get<ResolvedLocation[]>(normalizedKey)
      if (cached && Array.isArray(cached)) {
        return cached
      }
    } catch {
      // Safe ignore cache read failure
    }

    // 2. Fetch from Open-Meteo Geocoding API with timeout
    const timeoutMs = options?.timeoutMs || 3500
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    // Chain caller's abort signal if provided
    if (options?.signal) {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=${limit}&language=en&format=json`
      const res = await fetch(url, { signal: controller.signal })

      if (!res.ok) {
        return []
      }

      const json: OpenMeteoGeoResponse = await res.json()
      if (!json.results || !Array.isArray(json.results)) {
        return []
      }

      const normalized = json.results.map(normalizeGeoResult)

      // Store in cache
      try {
        await cache.set(normalizedKey, normalized, GEO_CACHE_TTL_MS)
      } catch {
        // Safe ignore cache write failure
      }

      return normalized
    } catch {
      // Offline, network failure, or timeout returns empty list gracefully
      return []
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

export const defaultGeoService = new GeoService()
