import { describe, it, expect } from 'vitest'
import {
  buildNormalizedTripContext,
  createLegacyNormalizedContext,
  generateDateRange,
} from '../../src/services/contextBuilder'
import type { TripConfig, ResolvedLocation } from '../../src/types'
import type { DailyForecastRecord, DailyAqiRecord } from '../../src/services/weatherService'

describe('ContextBuilder — NormalizedTripContext Assembly', () => {
  const baseTripConfig: TripConfig = {
    name: 'Delhi Winter Conference',
    destination: 'Delhi',
    origin: 'Pune',
    startDate: '2026-12-15',
    endDate: '2026-12-18',
    transportModes: ['train'],
    activities: ['business'],
    climate: 'cold',
    travellers: { adults: 1, teens: 0, children: 0, infants: 0, seniors: 0 },
    personalPreferences: ['work_tech'],
  }

  const puneResolved: ResolvedLocation = {
    city: { id: 'pune_in', name: 'Pune', region: 'Maharashtra', country: 'India', countryCode: 'IN' },
    coordinates: { latitude: 18.5204, longitude: 73.8567, isCentroid: true },
  }

  const delhiResolved: ResolvedLocation = {
    city: { id: 'delhi_in', name: 'Delhi', region: 'Delhi', country: 'India', countryCode: 'IN' },
    coordinates: { latitude: 28.6139, longitude: 77.209, elevationMeters: 216, isCentroid: true },
  }

  it('generates sequential ISO date list for trip duration', () => {
    const dates = generateDateRange('2026-12-15', '2026-12-18')
    expect(dates).toEqual(['2026-12-15', '2026-12-16', '2026-12-17', '2026-12-18'])
  })

  it('assembles full normalized context with resolved distance, overnight transit, and environmental metrics', () => {
    const now = new Date('2026-12-10T00:00:00Z') // 5 days before trip start

    const forecastRecords = new Map<string, DailyForecastRecord>([
      [
        '2026-12-15',
        { date: '2026-12-15', temperatureMinC: 7.0, temperatureMaxC: 21.0, precipitationProbabilityMax: 0, precipitationSumMm: 0 },
      ],
      [
        '2026-12-16',
        { date: '2026-12-16', temperatureMinC: 6.5, temperatureMaxC: 20.0, precipitationProbabilityMax: 10, precipitationSumMm: 0 },
      ],
      [
        '2026-12-17',
        { date: '2026-12-17', temperatureMinC: 6.0, temperatureMaxC: 19.5, precipitationProbabilityMax: 5, precipitationSumMm: 0 },
      ],
      [
        '2026-12-18',
        { date: '2026-12-18', temperatureMinC: 8.0, temperatureMaxC: 22.0, precipitationProbabilityMax: 0, precipitationSumMm: 0 },
      ],
    ])

    const aqiRecords = new Map<string, DailyAqiRecord>([
      ['2026-12-15', { date: '2026-12-15', usAqi: 310, pm25Ugm3: 210.5 }],
      ['2026-12-16', { date: '2026-12-16', usAqi: 340, pm25Ugm3: 240.0 }],
    ])

    const context = buildNormalizedTripContext(baseTripConfig, {
      resolvedOrigin: puneResolved,
      resolvedDestination: delhiResolved,
      weatherForecastRecords: forecastRecords,
      aqiRecords,
      now,
    })

    expect(context.contextVersion).toBe('2.0.0')
    expect(context.contextState).toBe('current')
    expect(context.journey.classification).toBe('intercity')
    expect(context.journey.straightLineDistanceKm).toBeGreaterThan(1170)
    expect(context.journey.isOvernightTransit).toBe(true)
    expect(context.journey.isOvernightResolved).toBe(true)

    // Summary calculations
    expect(context.environment.summary.periodMinTempC).toBe(6.0)
    expect(context.environment.summary.periodMaxTempC).toBe(22.0)
    expect(context.environment.summary.elevationMeters).toBe(216)
    expect(context.environment.summary.isHighAltitude).toBe(false)
    expect(context.environment.summary.isSubZero).toBe(false)
    expect(context.environment.hasFullForecastCoverage).toBe(true)
    expect(context.environment.attribution).toContain('Open-Meteo.com')
  })

  it('handles missing optional origin cleanly without treating new trip as legacy (Guardrail 4)', () => {
    const tripWithoutOrigin: TripConfig = {
      ...baseTripConfig,
      origin: undefined,
    }

    const context = buildNormalizedTripContext(tripWithoutOrigin, {
      resolvedDestination: delhiResolved,
    })

    expect(context.contextState).toBe('current') // NOT legacy!
    expect(context.journey.origin).toBeUndefined()
    expect(context.journey.straightLineDistanceKm).toBeUndefined()
    expect(context.journey.classification).toBe('unknown')
  })

  it('marks legacy trips with contextState: legacy', () => {
    const legacyContext = createLegacyNormalizedContext(baseTripConfig, 'trip-old-123')
    expect(legacyContext.contextState).toBe('legacy')
    expect(legacyContext.tripId).toBe('trip-old-123')
  })

  it('preserves unknown environmental measurements as undefined, not false or 0 (Guardrail 3)', () => {
    // Destination with unresolved coordinates (e.g. offline or manual entry)
    const context = buildNormalizedTripContext(baseTripConfig, {
      resolvedOrigin: puneResolved,
      // destination coordinates unresolved
      resolvedDestination: {
        city: { id: 'delhi_manual', name: 'Delhi', country: 'India', countryCode: 'IN' },
        coordinates: undefined,
      },
    })

    expect(context.environment.summary.periodMinTempC).toBeUndefined()
    expect(context.environment.summary.periodMaxTempC).toBeUndefined()
    expect(context.environment.summary.elevationMeters).toBeUndefined()
    expect(context.environment.summary.isHighAltitude).toBeUndefined()
    expect(context.environment.summary.isSubZero).toBeUndefined()
    expect(context.environment.summary.isExtremeUv).toBeUndefined()
  })

  it('handles trips crossing forecast boundaries with partial forecast coverage and independent AQI limits', () => {
    // Current date is 2026-12-01
    // Trip is 2026-12-15 to 2026-12-20
    // Days 15, 16, 17 are <= 16 days (forecast available)
    // Days 18, 19, 20 are > 16 days (outside_forecast_horizon)
    // All days (15-20) are > 7 days from Dec 1 (AQI outside_forecast_horizon)
    const now = new Date('2026-12-01T00:00:00Z')

    const forecastRecords = new Map<string, DailyForecastRecord>([
      ['2026-12-15', { date: '2026-12-15', temperatureMinC: 5, temperatureMaxC: 18, precipitationProbabilityMax: 10 }],
      ['2026-12-16', { date: '2026-12-16', temperatureMinC: 6, temperatureMaxC: 19, precipitationProbabilityMax: 0 }],
      ['2026-12-17', { date: '2026-12-17', temperatureMinC: 5, temperatureMaxC: 17, precipitationProbabilityMax: 5 }],
    ])

    const longTripConfig: TripConfig = {
      ...baseTripConfig,
      startDate: '2026-12-15',
      endDate: '2026-12-20',
    }

    const context = buildNormalizedTripContext(longTripConfig, {
      resolvedOrigin: puneResolved,
      resolvedDestination: delhiResolved,
      weatherForecastRecords: forecastRecords,
      now,
    })

    expect(context.environment.hasFullForecastCoverage).toBe(false)
    expect(context.environment.hasPartialForecastCoverage).toBe(true)

    // Dec 15 has forecast
    const day15 = context.environment.daily.find((d) => d.date === '2026-12-15')
    expect(day15?.weatherProvenance.availability).toBe('available')
    expect(day15?.temperatureMinC).toBe(5)

    // Dec 19 is outside forecast horizon
    const day19 = context.environment.daily.find((d) => d.date === '2026-12-19')
    expect(day19?.weatherProvenance.availability).toBe('outside_forecast_horizon')
    expect(day19?.temperatureMinC).toBeUndefined()
    expect(day19?.precipitationProbabilityMax).toBeUndefined()

    // AQI for day 15 is outside 7-day AQI horizon
    expect(day15?.aqiProvenance.availability).toBe('outside_forecast_horizon')
    expect(day15?.usAqi).toBeUndefined()
  })

  it('handles independent failure of weather and AQI services', () => {
    const now = new Date('2026-12-14T00:00:00Z')

    // Forecast available, AQI failed
    const forecastRecords = new Map<string, DailyForecastRecord>([
      ['2026-12-15', { date: '2026-12-15', temperatureMinC: 7, temperatureMaxC: 20 }],
    ])

    const context = buildNormalizedTripContext(baseTripConfig, {
      resolvedOrigin: puneResolved,
      resolvedDestination: delhiResolved,
      weatherForecastRecords: forecastRecords,
      weatherProvenance: { provider: 'open_meteo', source: 'open_meteo_forecast', availability: 'available', confidence: 'forecast', retrievalMethod: 'network' },
      aqiRecords: new Map(),
      aqiProvenance: { provider: 'open_meteo', source: 'none', availability: 'provider_error', confidence: 'unavailable', retrievalMethod: 'network' },
      now,
    })

    const day15 = context.environment.daily[0]
    expect(day15.weatherProvenance.availability).toBe('available')
    expect(day15.aqiProvenance.availability).toBe('provider_error')
    expect(day15.usAqi).toBeUndefined()
  })
})
