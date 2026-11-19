/**
 * PackPilot — Trip Context Builder Service
 * Assembles NormalizedTripContext with independent per-day weather & AQI provenance,
 * safe legacy fallback, duration range envelopes, and zero measurement fabrication.
 */

import type {
  TripConfig,
  ResolvedLocation,
  NormalizedTripContext,
  JourneyContext,
  EnvironmentalContext,
  DailyEnvironmentalMeasurement,
  EnvironmentalSummary,
  MetricProvenance,
  ContextState,
} from '../types'
import {
  calculateHaversineDistanceKm,
  classifyJourney,
  calculateDurationRangeHours,
  resolveOvernightTransit,
  adaptTransportModes,
} from './journeyService'
import {
  OPEN_METEO_ATTRIBUTION,
  type DailyForecastRecord,
  type DailyAqiRecord,
} from './weatherService'
import { createManualLocation } from './geoService'
import { calculateDurationDays } from '../utils/dates'

export function generateDateRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = []
  if (!startDateStr || !endDateStr) return dates

  const current = new Date(`${startDateStr}T00:00:00Z`)
  const end = new Date(`${endDateStr}T00:00:00Z`)

  if (isNaN(current.getTime()) || isNaN(end.getTime()) || current > end) {
    return [startDateStr]
  }

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return dates
}

export interface BuildContextOptions {
  tripId?: string
  resolvedOrigin?: ResolvedLocation
  resolvedDestination?: ResolvedLocation
  weatherForecastRecords?: Map<string, DailyForecastRecord>
  weatherProvenance?: MetricProvenance
  aqiRecords?: Map<string, DailyAqiRecord>
  aqiProvenance?: MetricProvenance
  elevationMeters?: number
  now?: Date
  contextState?: ContextState
}

export function buildNormalizedTripContext(
  config: TripConfig,
  options: BuildContextOptions = {}
): NormalizedTripContext {
  const now = options.now || new Date()
  const todayStr = now.toISOString().split('T')[0]
  const todayMidnight = new Date(`${todayStr}T00:00:00Z`).getTime()

  // 1. Resolve Locations
  let destination = options.resolvedDestination || config.destinationLocation
  if (!destination) {
    destination = createManualLocation(config.destination)
  }

  let origin = options.resolvedOrigin || config.originLocation
  if (!origin && config.origin && config.origin.trim()) {
    origin = createManualLocation(config.origin)
  }

  // 2. Journey Intelligence
  let straightLineDistanceKm: number | undefined = undefined
  if (origin?.coordinates && destination.coordinates) {
    straightLineDistanceKm = calculateHaversineDistanceKm(
      origin.coordinates,
      destination.coordinates
    )
  }

  const classification = classifyJourney(
    straightLineDistanceKm,
    origin?.city,
    destination.city
  )

  const adapted = adaptTransportModes(config.transportModes)
  const primaryTransport = config.primaryTransport || adapted.primaryTransport
  const destinationMobility = {
    isDrivingAtDestination:
      config.destinationMobility?.isDrivingAtDestination ??
      adapted.destinationMobility.isDrivingAtDestination,
    isPublicTransitFocused:
      config.destinationMobility?.isPublicTransitFocused ??
      adapted.destinationMobility.isPublicTransitFocused,
  }

  const durationRangeHours = calculateDurationRangeHours(
    straightLineDistanceKm,
    primaryTransport
  )

  const overnightSelection = config.overnightSelection || 'auto'
  const overnightResult = resolveOvernightTransit(
    overnightSelection,
    durationRangeHours,
    primaryTransport
  )

  const journey: JourneyContext = {
    origin,
    destination,
    straightLineDistanceKm,
    isHeuristicDistance: true,
    classification,
    durationRangeHours,
    overnightSelection,
    isOvernightTransit: overnightResult.isOvernightTransit,
    isOvernightResolved: overnightResult.isOvernightResolved,
    primaryTransport,
    destinationMobility,
    secondaryTransportModes: adapted.secondaryTransportModes,
    provenance: {
      distanceMethod: straightLineDistanceKm !== undefined ? 'haversine' : 'none',
      retrievalMethod: 'offline_fallback',
      availability: straightLineDistanceKm !== undefined ? 'available' : 'unresolved_location',
    },
  }

  // 3. Environmental Intelligence (Per-Day Resolution)
  const tripDates = generateDateRange(config.startDate, config.endDate)
  const forecastMap = options.weatherForecastRecords || new Map()
  const aqiMap = options.aqiRecords || new Map()

  const defaultWeatherProv: MetricProvenance = options.weatherProvenance || {
    provider: 'none',
    retrievalMethod: 'offline_fallback',
    source: 'none',
    availability: 'unresolved_location',
    confidence: 'unavailable',
  }

  const defaultAqiProv: MetricProvenance = options.aqiProvenance || {
    provider: 'none',
    retrievalMethod: 'offline_fallback',
    source: 'none',
    availability: 'unresolved_location',
    confidence: 'unavailable',
  }

  const daily: DailyEnvironmentalMeasurement[] = []

  for (const date of tripDates) {
    const dayDate = new Date(`${date}T00:00:00Z`).getTime()
    const daysFromNow = Math.floor((dayDate - todayMidnight) / (24 * 60 * 60 * 1000))

    // Weather forecast horizon: 0 to 16 days
    let dayWeatherProv: MetricProvenance
    let forecastRecord: DailyForecastRecord | undefined = undefined

    if (daysFromNow >= 0 && daysFromNow <= 16) {
      if (destination.coordinates) {
        forecastRecord = forecastMap.get(date)
        if (forecastRecord) {
          dayWeatherProv = {
            provider: 'open_meteo',
            retrievalMethod: defaultWeatherProv.retrievalMethod,
            fetchedAt: defaultWeatherProv.fetchedAt,
            source: 'open_meteo_forecast',
            availability: 'available',
            confidence: 'forecast',
          }
        } else {
          dayWeatherProv = {
            provider: 'open_meteo',
            retrievalMethod: defaultWeatherProv.retrievalMethod,
            source: 'none',
            availability: defaultWeatherProv.availability === 'provider_error' ? 'provider_error' : 'outside_forecast_horizon',
            confidence: 'unavailable',
          }
        }
      } else {
        dayWeatherProv = {
          provider: 'none',
          retrievalMethod: 'offline_fallback',
          source: 'none',
          availability: 'unresolved_location',
          confidence: 'unavailable',
        }
      }
    } else {
      dayWeatherProv = {
        provider: 'none',
        retrievalMethod: 'offline_fallback',
        source: 'none',
        availability: 'outside_forecast_horizon',
        confidence: 'unavailable',
      }
    }

    // AQI horizon: 0 to 7 days
    let dayAqiProv: MetricProvenance
    let aqiRecord: DailyAqiRecord | undefined = undefined

    if (daysFromNow >= 0 && daysFromNow <= 7) {
      if (destination.coordinates) {
        aqiRecord = aqiMap.get(date)
        if (aqiRecord) {
          dayAqiProv = {
            provider: 'open_meteo',
            retrievalMethod: defaultAqiProv.retrievalMethod,
            fetchedAt: defaultAqiProv.fetchedAt,
            source: 'open_meteo_forecast',
            availability: 'available',
            confidence: 'forecast',
          }
        } else {
          dayAqiProv = {
            provider: 'open_meteo',
            retrievalMethod: defaultAqiProv.retrievalMethod,
            source: 'none',
            availability: defaultAqiProv.availability === 'provider_error' ? 'provider_error' : 'outside_forecast_horizon',
            confidence: 'unavailable',
          }
        }
      } else {
        dayAqiProv = {
          provider: 'none',
          retrievalMethod: 'offline_fallback',
          source: 'none',
          availability: 'unresolved_location',
          confidence: 'unavailable',
        }
      }
    } else {
      dayAqiProv = {
        provider: 'none',
        retrievalMethod: 'offline_fallback',
        source: 'none',
        availability: 'outside_forecast_horizon',
        confidence: 'unavailable',
      }
    }

    daily.push({
      date,
      temperatureMinC: forecastRecord?.temperatureMinC,
      temperatureMaxC: forecastRecord?.temperatureMaxC,
      precipitationProbabilityMax: daysFromNow <= 16 ? forecastRecord?.precipitationProbabilityMax : undefined,
      precipitationSumMm: forecastRecord?.precipitationSumMm,
      windSpeedMaxKmh: forecastRecord?.windSpeedMaxKmh,
      uvIndexMax: forecastRecord?.uvIndexMax,
      weatherCode: forecastRecord?.weatherCode,
      usAqi: daysFromNow <= 7 ? aqiRecord?.usAqi : undefined,
      pm25Ugm3: daysFromNow <= 7 ? aqiRecord?.pm25Ugm3 : undefined,
      weatherProvenance: dayWeatherProv,
      aqiProvenance: dayAqiProv,
    })
  }

  // Summary aggregation over available forecast days
  const validMins = daily
    .map((d) => d.temperatureMinC)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  const validMaxs = daily
    .map((d) => d.temperatureMaxC)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  const validDiurnals = daily
    .filter(
      (d) =>
        typeof d.temperatureMinC === 'number' &&
        typeof d.temperatureMaxC === 'number' &&
        Number.isFinite(d.temperatureMinC) &&
        Number.isFinite(d.temperatureMaxC)
    )
    .map((d) => (d.temperatureMaxC as number) - (d.temperatureMinC as number))

  const validRainProbs = daily
    .map((d) => d.precipitationProbabilityMax)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  const validRainSums = daily
    .map((d) => d.precipitationSumMm)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  const validUvs = daily
    .map((d) => d.uvIndexMax)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  const periodMinTempC = validMins.length > 0 ? Math.min(...validMins) : undefined
  const periodMaxTempC = validMaxs.length > 0 ? Math.max(...validMaxs) : undefined
  const maxDiurnalRangeC = validDiurnals.length > 0 ? Math.max(...validDiurnals) : undefined
  const maxPrecipitationProbability = validRainProbs.length > 0 ? Math.max(...validRainProbs) : undefined
  const totalPrecipitationMm = validRainSums.length > 0
    ? Math.round(validRainSums.reduce((acc, curr) => acc + curr, 0) * 10) / 10
    : undefined
  const maxUvIndex = validUvs.length > 0 ? Math.max(...validUvs) : undefined

  const elevationMeters = options.elevationMeters ?? destination.coordinates?.elevationMeters

  const summary: EnvironmentalSummary = {
    periodMinTempC,
    periodMaxTempC,
    maxDiurnalRangeC,
    maxPrecipitationProbability,
    totalPrecipitationMm,
    maxUvIndex,
    elevationMeters,
    isHighAltitude: typeof elevationMeters === 'number' ? elevationMeters >= 2500 : undefined,
    isExtremeUv: typeof maxUvIndex === 'number' ? maxUvIndex >= 8 : undefined,
    isSubZero: typeof periodMinTempC === 'number' ? periodMinTempC < 0 : undefined,
  }

  const hasFullForecastCoverage =
    daily.length > 0 && daily.every((d) => d.weatherProvenance.availability === 'available')
  const hasPartialForecastCoverage =
    daily.some((d) => d.weatherProvenance.availability === 'available') && !hasFullForecastCoverage

  const environment: EnvironmentalContext = {
    daily,
    summary,
    hasFullForecastCoverage,
    hasPartialForecastCoverage,
    contextProvenance: defaultWeatherProv,
    attribution: OPEN_METEO_ATTRIBUTION,
  }

  const durationDays = calculateDurationDays(config.startDate, config.endDate)

  // Guardrail 4: Distinguish legacy trips from new trips with missing optional origin using a persisted context schema version
  const contextState: ContextState = options.contextState || 'current'

  return {
    contextVersion: '2.0.0',
    contextState,
    tripId: options.tripId || 'temp-context-trip',
    name: config.name,
    startDate: config.startDate,
    endDate: config.endDate,
    durationDays,
    travellers: { ...config.travellers },
    hasLaundryAccess: Boolean(config.hasLaundryAccess),
    activities: [...config.activities],
    accommodationType: config.accommodationType,
    personalPreferences: [...(config.personalPreferences || [])],
    specialRequirements: config.specialRequirements,
    baggageConfig: {
      hasCabinBaggage: config.baggageConfig?.hasCabinBaggage ?? true,
      cabinWeightLimitKg: config.baggageConfig?.cabinWeightLimitKg ?? 7.0,
      hasCheckedBaggage: config.baggageConfig?.hasCheckedBaggage ?? false,
      checkedWeightLimitKg: config.baggageConfig?.checkedWeightLimitKg ?? 23.0,
    },
    legacyClimateEnum: config.climate || 'mixed',
    journey,
    environment,
    contextGeneratedAt: now.toISOString(),
  }
}

/**
 * Creates a backward-compatible NormalizedTripContext for legacy trips.
 */
export function createLegacyNormalizedContext(
  config: TripConfig,
  tripId = 'legacy-trip'
): NormalizedTripContext {
  return buildNormalizedTripContext(config, {
    tripId,
    contextState: 'legacy',
  })
}
