/**
 * PackPilot — Pure Intelligence Formatting & Classification Utilities
 * Milestone 7.2B-2C-1 (Adversarial Corrections Applied)
 *
 * Provides pure, zero-side-effect formatting and classification helpers for:
 * 1. WMO weather code descriptions and categorizations.
 * 2. Deterministic relative timestamp formatting with clock-skew bounds.
 * 3. US EPA AQI category mapping and presentation.
 * 4. Independent Travel Intelligence status classification for Weather and Journey.
 */

import type {
  EnvironmentalContext,
  JourneyContext,
  NormalizedTripContext,
} from '../types/context'
import type { TripResolutionStatus } from '../stores/tripStore'

// ==========================================
// 1. WMO Weather Code Formatting
// ==========================================

export type WeatherGroup =
  | 'clear'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'showers'
  | 'thunderstorm'
  | 'unknown'

interface WmoWeatherMeta {
  description: string
  group: WeatherGroup
}

/**
 * Standard WMO Weather interpretation codes (WW) utilized by Open-Meteo.
 * Does not fabricate unobserved atmospheric states.
 */
const WMO_WEATHER_REGISTRY: Record<number, WmoWeatherMeta> = {
  0: { description: 'Clear sky', group: 'clear' },
  1: { description: 'Mainly clear', group: 'clear' },
  2: { description: 'Partly cloudy', group: 'cloudy' },
  3: { description: 'Overcast', group: 'cloudy' },
  45: { description: 'Fog', group: 'fog' },
  48: { description: 'Depositing rime fog', group: 'fog' },
  51: { description: 'Light drizzle', group: 'drizzle' },
  53: { description: 'Moderate drizzle', group: 'drizzle' },
  55: { description: 'Dense drizzle', group: 'drizzle' },
  56: { description: 'Light freezing drizzle', group: 'drizzle' },
  57: { description: 'Dense freezing drizzle', group: 'drizzle' },
  61: { description: 'Slight rain', group: 'rain' },
  63: { description: 'Moderate rain', group: 'rain' },
  65: { description: 'Heavy rain', group: 'rain' },
  66: { description: 'Light freezing rain', group: 'rain' },
  67: { description: 'Heavy freezing rain', group: 'rain' },
  71: { description: 'Slight snow fall', group: 'snow' },
  73: { description: 'Moderate snow fall', group: 'snow' },
  75: { description: 'Heavy snow fall', group: 'snow' },
  77: { description: 'Snow grains', group: 'snow' },
  80: { description: 'Slight rain showers', group: 'showers' },
  81: { description: 'Moderate rain showers', group: 'showers' },
  82: { description: 'Violent rain showers', group: 'showers' },
  85: { description: 'Slight snow showers', group: 'showers' },
  86: { description: 'Heavy snow showers', group: 'showers' },
  95: { description: 'Thunderstorm', group: 'thunderstorm' },
  96: { description: 'Thunderstorm with slight hail', group: 'thunderstorm' },
  99: { description: 'Thunderstorm with heavy hail', group: 'thunderstorm' },
}

/**
 * Converts a WMO weather interpretation code into a human-readable condition description.
 * Handles unknown codes gracefully without inventing conditions.
 */
export function getWmoWeatherDescription(
  code?: number | null,
  fallback = 'Unknown conditions'
): string {
  if (code === undefined || code === null || !Number.isFinite(code)) {
    return fallback
  }
  return WMO_WEATHER_REGISTRY[code]?.description ?? fallback
}

/**
 * Categorizes a WMO weather interpretation code into an overarching atmospheric group.
 */
export function getWmoWeatherGroup(code?: number | null): WeatherGroup {
  if (code === undefined || code === null || !Number.isFinite(code)) {
    return 'unknown'
  }
  return WMO_WEATHER_REGISTRY[code]?.group ?? 'unknown'
}

// ==========================================
// 2. Relative Timestamp Formatting
// ==========================================

export interface RelativeTimeOptions {
  now?: Date | number
  fallback?: string
  timeZone?: string
  /**
   * Maximum future offset (in milliseconds) permitted as minor clock skew before
   * formatting as a calendar date. Defaults to 60,000ms (1 minute).
   */
  clockSkewToleranceMs?: number
}

/**
 * Formats an ISO 8601 timestamp relative to a target reference time (defaulting to now).
 * Handles just now, minutes ago, hours ago, and calendar date transitions safely.
 * The current-time reference is injectable for deterministic testing.
 *
 * Guardrail (FIX M-2): Future timestamps beyond clock-skew tolerance format as calendar
 * dates rather than being falsely reported as "Just now".
 */
export function formatRelativeTime(
  isoTimestamp?: string | null,
  nowOrOptions?: Date | number | RelativeTimeOptions
): string {
  let nowMs: number
  let fallback = 'Never'
  let timeZone = 'UTC'
  let clockSkewToleranceMs = 60_000

  if (nowOrOptions instanceof Date) {
    nowMs = nowOrOptions.getTime()
  } else if (typeof nowOrOptions === 'number') {
    nowMs = nowOrOptions
  } else if (nowOrOptions && typeof nowOrOptions === 'object') {
    nowMs =
      nowOrOptions.now instanceof Date
        ? nowOrOptions.now.getTime()
        : typeof nowOrOptions.now === 'number'
          ? nowOrOptions.now
          : Date.now()
    if (nowOrOptions.fallback !== undefined) {
      fallback = nowOrOptions.fallback
    }
    if (nowOrOptions.timeZone !== undefined) {
      timeZone = nowOrOptions.timeZone
    }
    if (nowOrOptions.clockSkewToleranceMs !== undefined && Number.isFinite(nowOrOptions.clockSkewToleranceMs)) {
      clockSkewToleranceMs = Math.max(0, nowOrOptions.clockSkewToleranceMs)
    }
  } else {
    nowMs = Date.now()
  }

  if (!isoTimestamp || typeof isoTimestamp !== 'string' || Number.isNaN(nowMs)) {
    return fallback
  }

  const timestamp = Date.parse(isoTimestamp)
  if (Number.isNaN(timestamp)) {
    return fallback
  }

  const diffMs = nowMs - timestamp

  // If timestamp is slightly in the future within minor clock skew tolerance (-tolerance <= diffMs < 60s)
  if (diffMs >= -clockSkewToleranceMs && diffMs < 60_000) {
    return 'Just now'
  }

  // If timestamp is in the future beyond minor clock skew tolerance (FIX M-2)
  if (diffMs < -clockSkewToleranceMs) {
    const futureDateObj = new Date(timestamp)
    return futureDateObj.toLocaleDateString('en-US', {
      timeZone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const diffMinutes = Math.floor(diffMs / 60_000)
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`
  }

  const diffHours = Math.floor(diffMs / 3_600_000)
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  }

  // 24 hours or older: format as full calendar date (e.g. "Jun 10, 2026")
  const dateObj = new Date(timestamp)
  return dateObj.toLocaleDateString('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ==========================================
// 3. AQI Presentation (US EPA Standard)
// ==========================================

export type AqiSeverity =
  | 'good'
  | 'moderate'
  | 'unhealthy_sensitive'
  | 'unhealthy'
  | 'very_unhealthy'
  | 'hazardous'

export interface AqiCategoryInfo {
  category: AqiSeverity
  label: string
  min: number
  max: number | null
  description: string
}

const AQI_THRESHOLDS: AqiCategoryInfo[] = [
  {
    category: 'good',
    label: 'Good',
    min: 0,
    max: 50,
    description: 'Air quality is satisfactory, and air pollution poses little or no risk.',
  },
  {
    category: 'moderate',
    label: 'Moderate',
    min: 51,
    max: 100,
    description: 'Air quality is acceptable; some pollutants may concern a small number of sensitive people.',
  },
  {
    category: 'unhealthy_sensitive',
    label: 'Unhealthy for Sensitive Groups',
    min: 101,
    max: 150,
    description: 'Members of sensitive groups may experience health effects. General public is less likely to be affected.',
  },
  {
    category: 'unhealthy',
    label: 'Unhealthy',
    min: 151,
    max: 200,
    description: 'Everyone may begin to experience health effects; members of sensitive groups may experience more serious effects.',
  },
  {
    category: 'very_unhealthy',
    label: 'Very Unhealthy',
    min: 201,
    max: 300,
    description: 'Health alert: The risk of health effects is increased for everyone.',
  },
  {
    category: 'hazardous',
    label: 'Hazardous',
    min: 301,
    max: null,
    description: 'Health warning of emergency conditions: everyone is more likely to be affected.',
  },
]

/**
 * Maps numeric US AQI values to standardized EPA categories.
 * Returns null if the value is missing, non-finite, or negative without fabricating values.
 */
export function getAqiCategory(aqi?: number | null): AqiCategoryInfo | null {
  if (aqi === undefined || aqi === null || !Number.isFinite(aqi) || aqi < 0) {
    return null
  }

  const rounded = Math.round(aqi)

  for (const tier of AQI_THRESHOLDS) {
    if (tier.max === null) {
      if (rounded >= tier.min) return tier
    } else if (rounded >= tier.min && rounded <= tier.max) {
      return tier
    }
  }

  return null
}

/**
 * Formats a numeric AQI with its category label (e.g. "42 (Good)").
 * Returns fallback when AQI measurement is missing or invalid.
 */
export function formatAqi(aqi?: number | null, fallback = 'Unavailable'): string {
  const categoryInfo = getAqiCategory(aqi)
  if (!categoryInfo || aqi === undefined || aqi === null) {
    return fallback
  }
  return `${Math.round(aqi)} (${categoryInfo.label})`
}

// ==========================================
// 4. Independent Intelligence Status Classification
// ==========================================

export type IntelligenceStatus =
  | 'resolving'
  | 'available'
  | 'partial'
  | 'outside_horizon'
  | 'offline_fallback'
  | 'cached'
  | 'failed'
  | 'idle'

export interface ClassifiedIntelligence {
  status: IntelligenceStatus
  label: string
  description?: string
  isLive: boolean
  isCached: boolean
  isFallback: boolean
}

export interface TripIntelligenceStatus {
  weather: ClassifiedIntelligence
  journey: ClassifiedIntelligence
  overallStatus: IntelligenceStatus
}

export interface ClassifyWeatherOptions {
  resolutionStatus?: TripResolutionStatus
  environment?: EnvironmentalContext | null
}

export interface ClassifyJourneyOptions {
  resolutionStatus?: TripResolutionStatus
  journey?: JourneyContext | null
}

export interface ClassifyTripIntelligenceOptions {
  resolutionStatus?: TripResolutionStatus
  context?: NormalizedTripContext | null
}

/**
 * Classifies weather intelligence state independently based on resolution status,
 * per-day availability records, and environmental provenance.
 *
 * Invariant (FIX C-2 & FIX H-1):
 * - Never claims live forecast availability when data is only cached or offline fallback.
 * - Never infers full forecast coverage from missing data.
 * - Correctly detects when 100% of trip dates are outside the 16-day forecast horizon.
 * - Preserves partial coverage and horizon limits for cached data.
 */
export function classifyWeatherStatus(options: ClassifyWeatherOptions): ClassifiedIntelligence {
  const { resolutionStatus, environment } = options

  if (resolutionStatus === 'resolving') {
    return {
      status: 'resolving',
      label: 'Updating Weather...',
      description: 'Fetching forecast and atmospheric metrics',
      isLive: false,
      isCached: false,
      isFallback: false,
    }
  }

  if (resolutionStatus === 'failed') {
    return {
      status: 'failed',
      label: 'Weather Unavailable',
      description: 'Context resolution failed to complete',
      isLive: false,
      isCached: false,
      isFallback: false,
    }
  }

  if (!environment || !environment.contextProvenance) {
    if (resolutionStatus === 'idle' || !resolutionStatus) {
      return {
        status: 'idle',
        label: 'Weather Pending',
        description: 'Context has not yet been resolved',
        isLive: false,
        isCached: false,
        isFallback: false,
      }
    }
    return {
      status: 'failed',
      label: 'Weather Unavailable',
      description: 'No environmental context recorded',
      isLive: false,
      isCached: false,
      isFallback: false,
    }
  }

  const prov = environment.contextProvenance

  // Check explicit provider failure
  if (prov.availability === 'provider_error') {
    return {
      status: 'failed',
      label: 'Weather Service Unavailable',
      description: 'External weather service returned an error',
      isLive: false,
      isCached: false,
      isFallback: false,
    }
  }

  // Check unresolved destination location
  if (prov.availability === 'unresolved_location') {
    return {
      status: 'offline_fallback',
      label: 'Location Unresolved',
      description: 'Coordinates could not be resolved for destination',
      isLive: false,
      isCached: false,
      isFallback: true,
    }
  }

  // Check whether all trip dates are outside the 16-day forecast horizon (FIX C-2)
  const isAllOutsideHorizon =
    prov.availability === 'outside_forecast_horizon' ||
    (Array.isArray(environment.daily) &&
      environment.daily.length > 0 &&
      environment.daily.every((d) => d.weatherProvenance?.availability === 'outside_forecast_horizon'))

  if (isAllOutsideHorizon) {
    return {
      status: 'outside_horizon',
      label: 'Outside Forecast Horizon',
      description: 'Forecast unavailable outside the 16-day window',
      isLive: false,
      isCached: false,
      isFallback: false,
    }
  }

  // Check offline seasonal fallback
  if (prov.retrievalMethod === 'offline_fallback') {
    return {
      status: 'offline_fallback',
      label: 'Seasonal Estimate',
      description: 'Using offline seasonal baseline climate',
      isLive: false,
      isCached: false,
      isFallback: true,
    }
  }

  // Check cached forecast (FIX H-1: Must not bypass coverage checks!)
  if (prov.retrievalMethod === 'cache') {
    if (environment.hasFullForecastCoverage) {
      return {
        status: 'cached',
        label: 'Cached Forecast',
        description: prov.fetchedAt
          ? `Cached forecast from ${formatRelativeTime(prov.fetchedAt)}`
          : 'Using cached forecast data',
        isLive: false,
        isCached: true,
        isFallback: false,
      }
    }

    if (environment.hasPartialForecastCoverage) {
      return {
        status: 'partial',
        label: 'Partial Cached Forecast',
        description: 'Cached forecast extends beyond the 16-day forecast horizon',
        isLive: false,
        isCached: true,
        isFallback: false,
      }
    }

    return {
      status: 'offline_fallback',
      label: 'Limited Cached Data',
      description: 'Insufficient cached forecast coverage; seasonal guidance applied',
      isLive: false,
      isCached: true,
      isFallback: true,
    }
  }

  // Live network forecast
  if (prov.retrievalMethod === 'network') {
    if (environment.hasFullForecastCoverage) {
      return {
        status: 'available',
        label: 'Live Forecast',
        description: 'Complete forecast available for all trip dates',
        isLive: true,
        isCached: false,
        isFallback: false,
      }
    }

    if (environment.hasPartialForecastCoverage) {
      return {
        status: 'partial',
        label: 'Partial Forecast',
        description: 'Trip extends beyond the 16-day forecast horizon',
        isLive: false,
        isCached: false,
        isFallback: false,
      }
    }

    // Never infer full forecast coverage from missing data
    return {
      status: 'offline_fallback',
      label: 'Limited Weather Data',
      description: 'Insufficient forecast coverage; seasonal guidance applied',
      isLive: false,
      isCached: false,
      isFallback: true,
    }
  }

  return {
    status: 'idle',
    label: 'Weather Status Unknown',
    isLive: false,
    isCached: false,
    isFallback: false,
  }
}

/**
 * Classifies journey intelligence state independently based on resolution status and journey provenance.
 *
 * Invariant (FIX C-1):
 * - A locally calculated Haversine distance is valid journey intelligence, not an unavailable route.
 * - Distinguishes estimated straight-line distance from actual road/rail travel distance.
 * - Does not claim journey availability when origin or destination coordinates are unresolved.
 */
export function classifyJourneyStatus(options: ClassifyJourneyOptions): ClassifiedIntelligence {
  const { resolutionStatus, journey } = options

  if (resolutionStatus === 'resolving') {
    return {
      status: 'resolving',
      label: 'Calculating Route...',
      description: 'Resolving transit distance and destination mobility',
      isLive: false,
      isCached: false,
      isFallback: false,
    }
  }

  if (resolutionStatus === 'failed') {
    return {
      status: 'failed',
      label: 'Route Unavailable',
      description: 'Journey resolution failed to complete',
      isLive: false,
      isCached: false,
      isFallback: false,
    }
  }

  if (!journey || !journey.provenance) {
    if (resolutionStatus === 'idle' || !resolutionStatus) {
      return {
        status: 'idle',
        label: 'Route Pending',
        description: 'Journey context has not yet been resolved',
        isLive: false,
        isCached: false,
        isFallback: false,
      }
    }
    return {
      status: 'failed',
      label: 'Route Unavailable',
      description: 'No journey context recorded',
      isLive: false,
      isCached: false,
      isFallback: false,
    }
  }

  const prov = journey.provenance

  if (prov.availability === 'provider_error') {
    return {
      status: 'failed',
      label: 'Route Service Error',
      description: 'Journey calculation encountered an error',
      isLive: false,
      isCached: false,
      isFallback: false,
    }
  }

  if (prov.availability === 'unresolved_location') {
    return {
      status: 'offline_fallback',
      label: 'Location Unresolved',
      description: 'Origin or destination coordinates could not be resolved',
      isLive: false,
      isCached: false,
      isFallback: true,
    }
  }

  // FIX C-1: Valid Haversine distance indicates active journey intelligence
  const hasValidDistance =
    typeof journey.straightLineDistanceKm === 'number' &&
    Number.isFinite(journey.straightLineDistanceKm) &&
    journey.straightLineDistanceKm >= 0

  if (prov.availability === 'available' && hasValidDistance) {
    const formattedDistance = Math.round(journey.straightLineDistanceKm as number)
    const distanceNote = `Estimated straight-line distance: ${formattedDistance} km (actual road/rail travel distance may vary)`

    if (prov.retrievalMethod === 'cache') {
      return {
        status: 'cached',
        label: 'Cached Route',
        description: `Cached straight-line distance: ${formattedDistance} km (actual road/rail travel distance may vary)`,
        isLive: false,
        isCached: true,
        isFallback: false,
      }
    }

    return {
      status: 'available',
      label: 'Route Available',
      description: distanceNote,
      isLive: true,
      isCached: false,
      isFallback: false,
    }
  }

  // When origin is omitted or distance cannot be computed, use local mobility fallback
  if (prov.retrievalMethod === 'offline_fallback' || !hasValidDistance) {
    return {
      status: 'offline_fallback',
      label: 'Offline Route',
      description: 'Using local transit defaults without origin distance',
      isLive: false,
      isCached: false,
      isFallback: true,
    }
  }

  if (prov.retrievalMethod === 'cache') {
    return {
      status: 'cached',
      label: 'Cached Route',
      description: 'Using cached transit parameters',
      isLive: false,
      isCached: true,
      isFallback: false,
    }
  }

  return {
    status: 'offline_fallback',
    label: 'Route Fallback',
    isLive: false,
    isCached: false,
    isFallback: true,
  }
}

/**
 * Combines independent Weather and Journey status classifications into an overall TripIntelligenceStatus.
 *
 * Precedence Rules:
 * 1. resolving (any active resolution in flight)
 * 2. available (both weather and journey fully available)
 * 3. cached (both services fully cached, or cached weather + valid journey heuristics)
 * 4. double failed (both services failed)
 * 5. partial availability (one service available/cached/partial alongside degraded service)
 * 6. failed (explicit service failure must NOT be masked by another service's offline fallback - FIX M-1)
 * 7. outside_horizon (weather outside forecast horizon when no service has real available data)
 * 8. offline_fallback (pure baseline fallback across both services)
 * 9. idle
 */
export function classifyTripIntelligence(
  options: ClassifyTripIntelligenceOptions
): TripIntelligenceStatus {
  const { resolutionStatus, context } = options

  const weather = classifyWeatherStatus({
    resolutionStatus,
    environment: context?.environment,
  })

  const journey = classifyJourneyStatus({
    resolutionStatus,
    journey: context?.journey,
  })

  let overallStatus: IntelligenceStatus

  // 1. In-flight resolution takes precedence
  if (
    resolutionStatus === 'resolving' ||
    weather.status === 'resolving' ||
    journey.status === 'resolving'
  ) {
    overallStatus = 'resolving'
  }
  // 2. Both services fully available
  else if (weather.status === 'available' && journey.status === 'available') {
    overallStatus = 'available'
  }
  // 3. Fully cached or cached weather + active journey heuristics (FIX L-1)
  else if (
    (weather.status === 'cached' || weather.status === 'available') &&
    (journey.status === 'cached' || journey.status === 'available') &&
    (weather.status === 'cached' || journey.status === 'cached')
  ) {
    overallStatus = 'cached'
  }
  // 4. Double explicit failure
  else if (weather.status === 'failed' && journey.status === 'failed') {
    overallStatus = 'failed'
  }
  // 5. Partial availability: at least one service has live or cached data
  else if (
    (weather.status === 'available' || weather.status === 'partial' || weather.status === 'cached') &&
    (journey.status === 'available' || journey.status === 'cached' || journey.status === 'offline_fallback' || journey.status === 'failed' || journey.status === 'outside_horizon')
  ) {
    overallStatus = 'partial'
  }
  else if (
    (journey.status === 'available' || journey.status === 'cached') &&
    (weather.status === 'offline_fallback' || weather.status === 'outside_horizon' || weather.status === 'failed')
  ) {
    overallStatus = 'partial'
  }
  // 6. Explicit failure must not be masked by offline fallback (FIX M-1)
  else if (weather.status === 'failed' || journey.status === 'failed') {
    overallStatus = 'failed'
  }
  // 7. Forecast outside supported horizon
  else if (weather.status === 'outside_horizon') {
    overallStatus = 'outside_horizon'
  }
  // 8. Offline fallback (basic trip information only)
  else if (weather.status === 'offline_fallback' || journey.status === 'offline_fallback') {
    overallStatus = 'offline_fallback'
  }
  // 9. Idle / uninitialized
  else {
    overallStatus = 'idle'
  }

  return {
    weather,
    journey,
    overallStatus,
  }
}
