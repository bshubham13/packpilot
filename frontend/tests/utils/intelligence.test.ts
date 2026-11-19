import { describe, it, expect } from 'vitest'
import {
  getWmoWeatherDescription,
  getWmoWeatherGroup,
  formatRelativeTime,
  getAqiCategory,
  formatAqi,
  classifyWeatherStatus,
  classifyJourneyStatus,
  classifyTripIntelligence,
} from '../../src/utils/intelligence'
import type {
  EnvironmentalContext,
  JourneyContext,
  NormalizedTripContext,
  DailyEnvironmentalMeasurement,
} from '../../src/types/context'

describe('Travel Intelligence Formatting & Classification Utilities (src/utils/intelligence.ts)', () => {
  describe('1. WMO Weather Code Formatting', () => {
    it('translates clear atmospheric codes correctly', () => {
      expect(getWmoWeatherDescription(0)).toBe('Clear sky')
      expect(getWmoWeatherGroup(0)).toBe('clear')

      expect(getWmoWeatherDescription(1)).toBe('Mainly clear')
      expect(getWmoWeatherGroup(1)).toBe('clear')
    })

    it('translates cloudy atmospheric codes correctly', () => {
      expect(getWmoWeatherDescription(2)).toBe('Partly cloudy')
      expect(getWmoWeatherGroup(2)).toBe('cloudy')

      expect(getWmoWeatherDescription(3)).toBe('Overcast')
      expect(getWmoWeatherGroup(3)).toBe('cloudy')
    })

    it('translates fog atmospheric codes correctly', () => {
      expect(getWmoWeatherDescription(45)).toBe('Fog')
      expect(getWmoWeatherGroup(45)).toBe('fog')

      expect(getWmoWeatherDescription(48)).toBe('Depositing rime fog')
      expect(getWmoWeatherGroup(48)).toBe('fog')
    })

    it('translates drizzle atmospheric codes correctly', () => {
      expect(getWmoWeatherDescription(51)).toBe('Light drizzle')
      expect(getWmoWeatherGroup(51)).toBe('drizzle')

      expect(getWmoWeatherDescription(53)).toBe('Moderate drizzle')
      expect(getWmoWeatherGroup(53)).toBe('drizzle')

      expect(getWmoWeatherDescription(55)).toBe('Dense drizzle')
      expect(getWmoWeatherGroup(55)).toBe('drizzle')

      expect(getWmoWeatherDescription(56)).toBe('Light freezing drizzle')
      expect(getWmoWeatherGroup(56)).toBe('drizzle')

      expect(getWmoWeatherDescription(57)).toBe('Dense freezing drizzle')
      expect(getWmoWeatherGroup(57)).toBe('drizzle')
    })

    it('translates rain atmospheric codes correctly', () => {
      expect(getWmoWeatherDescription(61)).toBe('Slight rain')
      expect(getWmoWeatherGroup(61)).toBe('rain')

      expect(getWmoWeatherDescription(63)).toBe('Moderate rain')
      expect(getWmoWeatherGroup(63)).toBe('rain')

      expect(getWmoWeatherDescription(65)).toBe('Heavy rain')
      expect(getWmoWeatherGroup(65)).toBe('rain')

      expect(getWmoWeatherDescription(66)).toBe('Light freezing rain')
      expect(getWmoWeatherGroup(66)).toBe('rain')

      expect(getWmoWeatherDescription(67)).toBe('Heavy freezing rain')
      expect(getWmoWeatherGroup(67)).toBe('rain')
    })

    it('translates snow atmospheric codes correctly', () => {
      expect(getWmoWeatherDescription(71)).toBe('Slight snow fall')
      expect(getWmoWeatherGroup(71)).toBe('snow')

      expect(getWmoWeatherDescription(73)).toBe('Moderate snow fall')
      expect(getWmoWeatherGroup(73)).toBe('snow')

      expect(getWmoWeatherDescription(75)).toBe('Heavy snow fall')
      expect(getWmoWeatherGroup(75)).toBe('snow')

      expect(getWmoWeatherDescription(77)).toBe('Snow grains')
      expect(getWmoWeatherGroup(77)).toBe('snow')
    })

    it('translates rain and snow shower codes correctly', () => {
      expect(getWmoWeatherDescription(80)).toBe('Slight rain showers')
      expect(getWmoWeatherGroup(80)).toBe('showers')

      expect(getWmoWeatherDescription(81)).toBe('Moderate rain showers')
      expect(getWmoWeatherGroup(81)).toBe('showers')

      expect(getWmoWeatherDescription(82)).toBe('Violent rain showers')
      expect(getWmoWeatherGroup(82)).toBe('showers')

      expect(getWmoWeatherDescription(85)).toBe('Slight snow showers')
      expect(getWmoWeatherGroup(85)).toBe('showers')

      expect(getWmoWeatherDescription(86)).toBe('Heavy snow showers')
      expect(getWmoWeatherGroup(86)).toBe('showers')
    })

    it('translates thunderstorm codes correctly', () => {
      expect(getWmoWeatherDescription(95)).toBe('Thunderstorm')
      expect(getWmoWeatherGroup(95)).toBe('thunderstorm')

      expect(getWmoWeatherDescription(96)).toBe('Thunderstorm with slight hail')
      expect(getWmoWeatherGroup(96)).toBe('thunderstorm')

      expect(getWmoWeatherDescription(99)).toBe('Thunderstorm with heavy hail')
      expect(getWmoWeatherGroup(99)).toBe('thunderstorm')
    })

    it('handles unknown, missing, and invalid weather codes gracefully', () => {
      expect(getWmoWeatherDescription(undefined)).toBe('Unknown conditions')
      expect(getWmoWeatherDescription(null)).toBe('Unknown conditions')
      expect(getWmoWeatherDescription(Number.NaN)).toBe('Unknown conditions')
      expect(getWmoWeatherDescription(999)).toBe('Unknown conditions')
      expect(getWmoWeatherDescription(-5)).toBe('Unknown conditions')

      expect(getWmoWeatherDescription(999, 'Custom fallback')).toBe('Custom fallback')

      expect(getWmoWeatherGroup(undefined)).toBe('unknown')
      expect(getWmoWeatherGroup(null)).toBe('unknown')
      expect(getWmoWeatherGroup(Number.NaN)).toBe('unknown')
      expect(getWmoWeatherGroup(999)).toBe('unknown')
      expect(getWmoWeatherGroup(-1)).toBe('unknown')
    })
  })

  describe('2. Relative Timestamp Formatting', () => {
    const fixedNow = new Date('2026-11-20T12:00:00.000Z')

    it('handles invalid or missing timestamps safely', () => {
      expect(formatRelativeTime(undefined, fixedNow)).toBe('Never')
      expect(formatRelativeTime(null, fixedNow)).toBe('Never')
      expect(formatRelativeTime('', fixedNow)).toBe('Never')
      expect(formatRelativeTime('not-a-date', fixedNow)).toBe('Never')
      expect(formatRelativeTime(null, { now: fixedNow, fallback: 'N/A' })).toBe('N/A')
      expect(formatRelativeTime('2026-11-20T12:00:00.000Z', { now: Number.NaN })).toBe('Never')
    })

    it('permits minor future clock skew within tolerance as "Just now" (FIX M-2)', () => {
      // 15 seconds in future (minor clock skew)
      const minorFuture = new Date('2026-11-20T12:00:15.000Z').toISOString()
      expect(formatRelativeTime(minorFuture, fixedNow)).toBe('Just now')

      // Exactly at clock skew tolerance boundary (59s ahead)
      const nearBoundary = new Date('2026-11-20T12:00:59.000Z').toISOString()
      expect(formatRelativeTime(nearBoundary, fixedNow)).toBe('Just now')

      // Exactly at 60s ahead boundary
      const boundaryAhead = new Date('2026-11-20T12:01:00.000Z').toISOString()
      expect(formatRelativeTime(boundaryAhead, fixedNow)).toBe('Just now')
    })

    it('formats distant future timestamps beyond clock skew as calendar dates (FIX M-2)', () => {
      // 2 minutes in the future (beyond 60s clock skew)
      const twoMinAhead = new Date('2026-11-20T12:02:00.000Z').toISOString()
      expect(formatRelativeTime(twoMinAhead, { now: fixedNow, timeZone: 'UTC' })).toBe('Nov 20, 2026')

      // Tomorrow in the future
      const tomorrow = new Date('2026-11-21T12:00:00.000Z').toISOString()
      expect(formatRelativeTime(tomorrow, { now: fixedNow, timeZone: 'UTC' })).toBe('Nov 21, 2026')

      // Next year in the future
      const nextYear = new Date('2027-04-15T00:00:00.000Z').toISOString()
      expect(formatRelativeTime(nextYear, { now: fixedNow, timeZone: 'UTC' })).toBe('Apr 15, 2027')

      // Custom clock skew tolerance
      expect(
        formatRelativeTime(twoMinAhead, {
          now: fixedNow,
          clockSkewToleranceMs: 180_000, // 3 minutes tolerance
        })
      ).toBe('Just now')
    })

    it('formats past timestamps under 60 seconds as "Just now"', () => {
      // 10 seconds ago
      const tenSecAgo = new Date('2026-11-20T11:59:50.000Z').toISOString()
      expect(formatRelativeTime(tenSecAgo, fixedNow)).toBe('Just now')

      // 59 seconds ago
      const fiftyNineSecAgo = new Date('2026-11-20T11:59:01.000Z').toISOString()
      expect(formatRelativeTime(fiftyNineSecAgo, fixedNow)).toBe('Just now')
    })

    it('formats minutes ago properly (singular and plural)', () => {
      // Exactly 1 minute ago
      const oneMinAgo = new Date('2026-11-20T11:59:00.000Z').toISOString()
      expect(formatRelativeTime(oneMinAgo, fixedNow)).toBe('1 minute ago')

      // 1 minute 30s ago
      const oneAndHalfMinAgo = new Date('2026-11-20T11:58:30.000Z').toISOString()
      expect(formatRelativeTime(oneAndHalfMinAgo, fixedNow)).toBe('1 minute ago')

      // 5 minutes ago
      const fiveMinAgo = new Date('2026-11-20T11:55:00.000Z').toISOString()
      expect(formatRelativeTime(fiveMinAgo, fixedNow)).toBe('5 minutes ago')

      // 59 minutes ago
      const fiftyNineMinAgo = new Date('2026-11-20T11:01:00.000Z').toISOString()
      expect(formatRelativeTime(fiftyNineMinAgo, fixedNow)).toBe('59 minutes ago')
    })

    it('formats hours ago properly (singular and plural)', () => {
      // Exactly 1 hour ago
      const oneHourAgo = new Date('2026-11-20T11:00:00.000Z').toISOString()
      expect(formatRelativeTime(oneHourAgo, fixedNow)).toBe('1 hour ago')

      // 2 hours ago
      const twoHoursAgo = new Date('2026-11-20T10:00:00.000Z').toISOString()
      expect(formatRelativeTime(twoHoursAgo, fixedNow)).toBe('2 hours ago')

      // 23 hours ago
      const twentyThreeHoursAgo = new Date('2026-11-19T13:00:00.000Z').toISOString()
      expect(formatRelativeTime(twentyThreeHoursAgo, fixedNow)).toBe('23 hours ago')
    })

    it('formats 24+ hours as formatted calendar dates', () => {
      // Exactly 24 hours ago
      const twentyFourHoursAgo = new Date('2026-11-19T12:00:00.000Z').toISOString()
      expect(formatRelativeTime(twentyFourHoursAgo, { now: fixedNow, timeZone: 'UTC' })).toBe('Nov 19, 2026')

      // 3 days ago
      const threeDaysAgo = new Date('2026-11-17T12:00:00.000Z').toISOString()
      expect(formatRelativeTime(threeDaysAgo, { now: fixedNow, timeZone: 'UTC' })).toBe('Nov 17, 2026')

      // Months ago
      const pastDate = new Date('2026-06-15T08:30:00.000Z').toISOString()
      expect(formatRelativeTime(pastDate, { now: fixedNow, timeZone: 'UTC' })).toBe('Jun 15, 2026')
    })

    it('accepts epoch number for now reference', () => {
      const past = new Date('2026-11-20T11:50:00.000Z').toISOString()
      expect(formatRelativeTime(past, fixedNow.getTime())).toBe('10 minutes ago')
    })
  })

  describe('3. AQI Presentation (US EPA Standard)', () => {
    it('classifies EPA standard tiers accurately across all boundaries', () => {
      // Good (0 - 50)
      expect(getAqiCategory(0)).toMatchObject({ category: 'good', label: 'Good' })
      expect(getAqiCategory(25)).toMatchObject({ category: 'good', label: 'Good' })
      expect(getAqiCategory(50)).toMatchObject({ category: 'good', label: 'Good' })

      // Moderate (51 - 100)
      expect(getAqiCategory(51)).toMatchObject({ category: 'moderate', label: 'Moderate' })
      expect(getAqiCategory(75)).toMatchObject({ category: 'moderate', label: 'Moderate' })
      expect(getAqiCategory(100)).toMatchObject({ category: 'moderate', label: 'Moderate' })

      // Unhealthy for Sensitive Groups (101 - 150)
      expect(getAqiCategory(101)).toMatchObject({
        category: 'unhealthy_sensitive',
        label: 'Unhealthy for Sensitive Groups',
      })
      expect(getAqiCategory(125)).toMatchObject({ category: 'unhealthy_sensitive' })
      expect(getAqiCategory(150)).toMatchObject({ category: 'unhealthy_sensitive' })

      // Unhealthy (151 - 200)
      expect(getAqiCategory(151)).toMatchObject({ category: 'unhealthy', label: 'Unhealthy' })
      expect(getAqiCategory(175)).toMatchObject({ category: 'unhealthy' })
      expect(getAqiCategory(200)).toMatchObject({ category: 'unhealthy' })

      // Very Unhealthy (201 - 300)
      expect(getAqiCategory(201)).toMatchObject({
        category: 'very_unhealthy',
        label: 'Very Unhealthy',
      })
      expect(getAqiCategory(250)).toMatchObject({ category: 'very_unhealthy' })
      expect(getAqiCategory(300)).toMatchObject({ category: 'very_unhealthy' })

      // Hazardous (301+)
      expect(getAqiCategory(301)).toMatchObject({ category: 'hazardous', label: 'Hazardous' })
      expect(getAqiCategory(450)).toMatchObject({ category: 'hazardous', label: 'Hazardous' })
      expect(getAqiCategory(999)).toMatchObject({ category: 'hazardous', label: 'Hazardous' })
    })

    it('handles decimal values by rounding according to EPA reporting conventions', () => {
      expect(getAqiCategory(50.4)?.category).toBe('good')
      expect(getAqiCategory(50.6)?.category).toBe('moderate')
      expect(getAqiCategory(100.2)?.category).toBe('moderate')
      expect(getAqiCategory(100.8)?.category).toBe('unhealthy_sensitive')
    })

    it('handles missing, null, NaN, and negative values without fabricating measurements', () => {
      expect(getAqiCategory(undefined)).toBeNull()
      expect(getAqiCategory(null)).toBeNull()
      expect(getAqiCategory(Number.NaN)).toBeNull()
      expect(getAqiCategory(-1)).toBeNull()
      expect(getAqiCategory(-50)).toBeNull()
    })

    it('formats AQI strings with formatted category labels', () => {
      expect(formatAqi(42)).toBe('42 (Good)')
      expect(formatAqi(85)).toBe('85 (Moderate)')
      expect(formatAqi(120)).toBe('120 (Unhealthy for Sensitive Groups)')
      expect(formatAqi(180)).toBe('180 (Unhealthy)')
      expect(formatAqi(250)).toBe('250 (Very Unhealthy)')
      expect(formatAqi(350)).toBe('350 (Hazardous)')

      expect(formatAqi(null)).toBe('Unavailable')
      expect(formatAqi(undefined)).toBe('Unavailable')
      expect(formatAqi(Number.NaN)).toBe('Unavailable')
      expect(formatAqi(-5, 'No Data')).toBe('No Data')
    })
  })

  describe('4. Independent Intelligence Status Classification', () => {
    describe('classifyWeatherStatus', () => {
      it('classifies resolving and failed lifecycle states', () => {
        expect(classifyWeatherStatus({ resolutionStatus: 'resolving' })).toMatchObject({
          status: 'resolving',
          isLive: false,
        })

        expect(classifyWeatherStatus({ resolutionStatus: 'failed' })).toMatchObject({
          status: 'failed',
          isLive: false,
        })
      })

      it('classifies idle state when context is missing', () => {
        expect(classifyWeatherStatus({ resolutionStatus: 'idle', environment: null })).toMatchObject({
          status: 'idle',
          isLive: false,
        })
      })

      it('classifies outside forecast horizon correctly when all dates are outside horizon (FIX C-2: ContextBuilder fixture shape)', () => {
        // Real ContextBuilder output: top-level API provenance is 'available' because network fetch succeeded,
        // but all daily measurements are marked 'outside_forecast_horizon' because trip is in distant future.
        const distantFutureEnv: EnvironmentalContext = {
          daily: [
            {
              date: '2027-04-01',
              weatherProvenance: {
                provider: 'none',
                retrievalMethod: 'offline_fallback',
                source: 'none',
                availability: 'outside_forecast_horizon',
                confidence: 'unavailable',
              },
              aqiProvenance: {
                provider: 'none',
                retrievalMethod: 'offline_fallback',
                source: 'none',
                availability: 'outside_forecast_horizon',
                confidence: 'unavailable',
              },
            },
            {
              date: '2027-04-02',
              weatherProvenance: {
                provider: 'none',
                retrievalMethod: 'offline_fallback',
                source: 'none',
                availability: 'outside_forecast_horizon',
                confidence: 'unavailable',
              },
              aqiProvenance: {
                provider: 'none',
                retrievalMethod: 'offline_fallback',
                source: 'none',
                availability: 'outside_forecast_horizon',
                confidence: 'unavailable',
              },
            },
          ],
          summary: {},
          hasFullForecastCoverage: false,
          hasPartialForecastCoverage: false,
          contextProvenance: {
            provider: 'open_meteo',
            retrievalMethod: 'network',
            source: 'open_meteo_forecast',
            availability: 'available', // API call itself was available
            confidence: 'forecast',
          },
          attribution: 'Weather data by Open-Meteo.com',
        }

        const result = classifyWeatherStatus({ environment: distantFutureEnv })
        expect(result.status).toBe('outside_horizon')
        expect(result.label).toBe('Outside Forecast Horizon')
        expect(result.isLive).toBe(false)
        expect(result.isFallback).toBe(false)
      })

      it('classifies mixed forecast and outside-horizon dates as partial', () => {
        const partialEnv: EnvironmentalContext = {
          daily: [
            {
              date: '2026-11-25',
              weatherProvenance: {
                provider: 'open_meteo',
                retrievalMethod: 'network',
                source: 'open_meteo_forecast',
                availability: 'available',
                confidence: 'forecast',
              },
              aqiProvenance: {
                provider: 'open_meteo',
                retrievalMethod: 'network',
                source: 'open_meteo_forecast',
                availability: 'available',
                confidence: 'forecast',
              },
            },
            {
              date: '2026-12-10',
              weatherProvenance: {
                provider: 'none',
                retrievalMethod: 'offline_fallback',
                source: 'none',
                availability: 'outside_forecast_horizon',
                confidence: 'unavailable',
              },
              aqiProvenance: {
                provider: 'none',
                retrievalMethod: 'offline_fallback',
                source: 'none',
                availability: 'outside_forecast_horizon',
                confidence: 'unavailable',
              },
            },
          ],
          summary: {},
          hasFullForecastCoverage: false,
          hasPartialForecastCoverage: true,
          contextProvenance: {
            provider: 'open_meteo',
            retrievalMethod: 'network',
            availability: 'available',
            source: 'open_meteo_forecast',
            confidence: 'forecast',
          },
          attribution: 'Open-Meteo',
        }

        const result = classifyWeatherStatus({ environment: partialEnv })
        expect(result.status).toBe('partial')
        expect(result.label).toBe('Partial Forecast')
        expect(result.isLive).toBe(false)
      })

      it('preserves partial coverage and horizon limits for cached forecasts (FIX H-1)', () => {
        const cachedPartialEnv: EnvironmentalContext = {
          daily: [
            {
              date: '2026-11-25',
              weatherProvenance: {
                provider: 'open_meteo',
                retrievalMethod: 'cache',
                source: 'open_meteo_forecast',
                availability: 'available',
                confidence: 'forecast',
              },
              aqiProvenance: {
                provider: 'open_meteo',
                retrievalMethod: 'cache',
                source: 'open_meteo_forecast',
                availability: 'available',
                confidence: 'forecast',
              },
            },
            {
              date: '2026-12-15',
              weatherProvenance: {
                provider: 'none',
                retrievalMethod: 'offline_fallback',
                source: 'none',
                availability: 'outside_forecast_horizon',
                confidence: 'unavailable',
              },
              aqiProvenance: {
                provider: 'none',
                retrievalMethod: 'offline_fallback',
                source: 'none',
                availability: 'outside_forecast_horizon',
                confidence: 'unavailable',
              },
            },
          ],
          summary: {},
          hasFullForecastCoverage: false,
          hasPartialForecastCoverage: true,
          contextProvenance: {
            provider: 'open_meteo',
            retrievalMethod: 'cache',
            availability: 'available',
            source: 'open_meteo_forecast',
            confidence: 'forecast',
          },
          attribution: 'Open-Meteo',
        }

        const result = classifyWeatherStatus({ environment: cachedPartialEnv })
        expect(result.status).toBe('partial')
        expect(result.label).toBe('Partial Cached Forecast')
        expect(result.isCached).toBe(true)
        expect(result.isLive).toBe(false)
      })

      it('classifies cached forecast with full coverage as cached', () => {
        const cachedFullEnv: EnvironmentalContext = {
          daily: [
            {
              date: '2026-11-20',
              weatherProvenance: {
                provider: 'open_meteo',
                retrievalMethod: 'cache',
                source: 'open_meteo_forecast',
                availability: 'available',
                confidence: 'forecast',
              },
              aqiProvenance: {
                provider: 'open_meteo',
                retrievalMethod: 'cache',
                source: 'open_meteo_forecast',
                availability: 'available',
                confidence: 'forecast',
              },
            },
          ],
          summary: {},
          hasFullForecastCoverage: true,
          hasPartialForecastCoverage: false,
          contextProvenance: {
            provider: 'open_meteo',
            retrievalMethod: 'cache',
            availability: 'available',
            source: 'open_meteo_forecast',
            confidence: 'forecast',
            fetchedAt: '2026-11-20T10:00:00.000Z',
          },
          attribution: 'Open-Meteo',
        }

        const result = classifyWeatherStatus({ environment: cachedFullEnv })
        expect(result.status).toBe('cached')
        expect(result.label).toBe('Cached Forecast')
        expect(result.isCached).toBe(true)
        expect(result.isLive).toBe(false)
      })

      it('classifies provider error as failed', () => {
        const errorEnv: EnvironmentalContext = {
          daily: [],
          summary: {},
          hasFullForecastCoverage: false,
          hasPartialForecastCoverage: false,
          contextProvenance: {
            provider: 'open_meteo',
            retrievalMethod: 'network',
            availability: 'provider_error',
            source: 'none',
            confidence: 'unavailable',
          },
          attribution: 'Open-Meteo',
        }

        const result = classifyWeatherStatus({ environment: errorEnv })
        expect(result.status).toBe('failed')
        expect(result.isLive).toBe(false)
      })

      it('classifies offline fallback and unresolved location correctly', () => {
        const unresolvedEnv: EnvironmentalContext = {
          daily: [],
          summary: {},
          hasFullForecastCoverage: false,
          hasPartialForecastCoverage: false,
          contextProvenance: {
            provider: 'none',
            retrievalMethod: 'offline_fallback',
            availability: 'unresolved_location',
            source: 'none',
            confidence: 'unavailable',
          },
          attribution: 'Open-Meteo',
        }

        const result1 = classifyWeatherStatus({ environment: unresolvedEnv })
        expect(result1.status).toBe('offline_fallback')
        expect(result1.isFallback).toBe(true)
        expect(result1.isLive).toBe(false)

        const fallbackEnv: EnvironmentalContext = {
          daily: [],
          summary: {},
          hasFullForecastCoverage: false,
          hasPartialForecastCoverage: false,
          contextProvenance: {
            provider: 'open_meteo',
            retrievalMethod: 'offline_fallback',
            availability: 'available',
            source: 'none',
            confidence: 'unavailable',
          },
          attribution: 'Open-Meteo',
        }

        const result2 = classifyWeatherStatus({ environment: fallbackEnv })
        expect(result2.status).toBe('offline_fallback')
        expect(result2.isFallback).toBe(true)
        expect(result2.isLive).toBe(false)
      })
    })

    describe('classifyJourneyStatus', () => {
      it('classifies resolving and failed lifecycle states', () => {
        expect(classifyJourneyStatus({ resolutionStatus: 'resolving' })).toMatchObject({
          status: 'resolving',
          isLive: false,
        })

        expect(classifyJourneyStatus({ resolutionStatus: 'failed' })).toMatchObject({
          status: 'failed',
          isLive: false,
        })
      })

      it('classifies idle state when journey is missing', () => {
        expect(classifyJourneyStatus({ resolutionStatus: 'idle', journey: null })).toMatchObject({
          status: 'idle',
          isLive: false,
        })
      })

      it('classifies valid Haversine journey as available and notes road/rail distinction (FIX C-1: ContextBuilder shape)', () => {
        // Matches exact ContextBuilder contract: retrievalMethod is 'offline_fallback', availability is 'available'
        const realJourney: JourneyContext = {
          origin: {
            city: { id: 'paris', name: 'Paris', country: 'France', countryCode: 'FR' },
            coordinates: { latitude: 48.8566, longitude: 2.3522, isCentroid: false },
          },
          destination: {
            city: { id: 'london', name: 'London', country: 'United Kingdom', countryCode: 'GB' },
            coordinates: { latitude: 51.5074, longitude: -0.1278, isCentroid: false },
          },
          straightLineDistanceKm: 343.8,
          isHeuristicDistance: true,
          classification: 'intercity',
          overnightSelection: 'auto',
          isOvernightTransit: false,
          isOvernightResolved: true,
          primaryTransport: 'flight',
          destinationMobility: { isDrivingAtDestination: false, isPublicTransitFocused: true },
          secondaryTransportModes: [],
          provenance: {
            distanceMethod: 'haversine',
            retrievalMethod: 'offline_fallback', // As produced by ContextBuilder!
            availability: 'available',
          },
        }

        const result = classifyJourneyStatus({ journey: realJourney })
        expect(result.status).toBe('available')
        expect(result.label).toBe('Route Available')
        expect(result.isLive).toBe(true)
        expect(result.isFallback).toBe(false)
        expect(result.description).toContain('344 km')
        expect(result.description).toContain('actual road/rail travel distance may vary')
      })

      it('classifies unresolved origin as offline fallback and does not claim availability (FIX C-1)', () => {
        // Matches ContextBuilder contract when user omits origin
        const originlessJourney: JourneyContext = {
          destination: {
            city: { id: 'tokyo', name: 'Tokyo', country: 'Japan', countryCode: 'JP' },
            coordinates: { latitude: 35.6762, longitude: 139.6503, isCentroid: false },
          },
          straightLineDistanceKm: undefined,
          isHeuristicDistance: true,
          classification: 'unknown',
          overnightSelection: 'auto',
          isOvernightTransit: false,
          isOvernightResolved: false,
          primaryTransport: 'flight',
          destinationMobility: { isDrivingAtDestination: false, isPublicTransitFocused: false },
          secondaryTransportModes: [],
          provenance: {
            distanceMethod: 'none',
            retrievalMethod: 'offline_fallback',
            availability: 'unresolved_location',
          },
        }

        const result = classifyJourneyStatus({ journey: originlessJourney })
        expect(result.status).toBe('offline_fallback')
        expect(result.label).toBe('Location Unresolved')
        expect(result.isFallback).toBe(true)
        expect(result.isLive).toBe(false)
      })

      it('classifies cached journey distance correctly', () => {
        const cachedJourney: JourneyContext = {
          destination: {
            city: { id: 'osaka', name: 'Osaka', country: 'Japan', countryCode: 'JP' },
            coordinates: { latitude: 34.6937, longitude: 135.5023, isCentroid: false },
          },
          straightLineDistanceKm: 400.2,
          isHeuristicDistance: true,
          classification: 'intercity',
          overnightSelection: 'auto',
          isOvernightTransit: false,
          isOvernightResolved: true,
          primaryTransport: 'train',
          destinationMobility: { isDrivingAtDestination: false, isPublicTransitFocused: true },
          secondaryTransportModes: [],
          provenance: {
            distanceMethod: 'haversine',
            retrievalMethod: 'cache',
            availability: 'available',
          },
        }

        const result = classifyJourneyStatus({ journey: cachedJourney })
        expect(result.status).toBe('cached')
        expect(result.label).toBe('Cached Route')
        expect(result.isCached).toBe(true)
        expect(result.isLive).toBe(false)
      })
    })

    describe('classifyTripIntelligence (composite & failure precedence)', () => {
      const liveJourney: JourneyContext = {
        origin: {
          city: { id: 'a', name: 'City A', country: 'Country', countryCode: 'C1' },
          coordinates: { latitude: 10, longitude: 20, isCentroid: false },
        },
        destination: {
          city: { id: 'b', name: 'City B', country: 'Country', countryCode: 'C2' },
          coordinates: { latitude: 12, longitude: 22, isCentroid: false },
        },
        straightLineDistanceKm: 300,
        isHeuristicDistance: true,
        classification: 'intercity',
        overnightSelection: 'auto',
        isOvernightTransit: false,
        isOvernightResolved: true,
        primaryTransport: 'train',
        destinationMobility: {},
        secondaryTransportModes: [],
        provenance: {
          distanceMethod: 'haversine',
          retrievalMethod: 'offline_fallback',
          availability: 'available',
        },
      }

      const fallbackJourney: JourneyContext = {
        destination: {
          city: { id: 'b', name: 'City B', country: 'Country', countryCode: 'C2' },
        },
        isHeuristicDistance: true,
        classification: 'unknown',
        overnightSelection: 'auto',
        isOvernightTransit: false,
        isOvernightResolved: false,
        primaryTransport: 'flight',
        destinationMobility: {},
        secondaryTransportModes: [],
        provenance: {
          distanceMethod: 'none',
          retrievalMethod: 'offline_fallback',
          availability: 'unresolved_location',
        },
      }

      const failedJourney: JourneyContext = {
        destination: {
          city: { id: 'b', name: 'City B', country: 'Country', countryCode: 'C2' },
        },
        isHeuristicDistance: true,
        classification: 'unknown',
        overnightSelection: 'auto',
        isOvernightTransit: false,
        isOvernightResolved: false,
        primaryTransport: 'flight',
        destinationMobility: {},
        secondaryTransportModes: [],
        provenance: {
          distanceMethod: 'none',
          retrievalMethod: 'offline_fallback',
          availability: 'provider_error',
        },
      }

      const fullLiveWeather: EnvironmentalContext = {
        daily: [
          {
            date: '2026-11-20',
            weatherProvenance: {
              provider: 'open_meteo',
              retrievalMethod: 'network',
              source: 'open_meteo_forecast',
              availability: 'available',
              confidence: 'forecast',
            },
            aqiProvenance: {
              provider: 'open_meteo',
              retrievalMethod: 'network',
              source: 'open_meteo_forecast',
              availability: 'available',
              confidence: 'forecast',
            },
          },
        ],
        summary: {},
        hasFullForecastCoverage: true,
        hasPartialForecastCoverage: false,
        contextProvenance: {
          provider: 'open_meteo',
          retrievalMethod: 'network',
          availability: 'available',
          source: 'open_meteo_forecast',
          confidence: 'forecast',
        },
        attribution: 'Open-Meteo',
      }

      const failedWeather: EnvironmentalContext = {
        daily: [],
        summary: {},
        hasFullForecastCoverage: false,
        hasPartialForecastCoverage: false,
        contextProvenance: {
          provider: 'open_meteo',
          retrievalMethod: 'network',
          availability: 'provider_error',
          source: 'none',
          confidence: 'unavailable',
        },
        attribution: 'Open-Meteo',
      }

      const fallbackWeather: EnvironmentalContext = {
        daily: [],
        summary: {},
        hasFullForecastCoverage: false,
        hasPartialForecastCoverage: false,
        contextProvenance: {
          provider: 'none',
          retrievalMethod: 'offline_fallback',
          availability: 'unresolved_location',
          source: 'none',
          confidence: 'unavailable',
        },
        attribution: 'Open-Meteo',
      }

      it('returns available when both live weather and Haversine distance heuristics are active (FIX C-1)', () => {
        const context = {
          environment: fullLiveWeather,
          journey: liveJourney,
        } as unknown as NormalizedTripContext

        const result = classifyTripIntelligence({
          resolutionStatus: 'resolved',
          context,
        })
        expect(result.overallStatus).toBe('available')
        expect(result.weather.status).toBe('available')
        expect(result.journey.status).toBe('available')
      })

      it('returns cached when both services are cached or weather is cached with active journey heuristics (FIX L-1)', () => {
        const cachedWeather: EnvironmentalContext = {
          ...fullLiveWeather,
          contextProvenance: {
            ...fullLiveWeather.contextProvenance,
            retrievalMethod: 'cache',
          },
        }

        const context = {
          environment: cachedWeather,
          journey: liveJourney,
        } as unknown as NormalizedTripContext

        const result = classifyTripIntelligence({
          resolutionStatus: 'resolved',
          context,
        })
        expect(result.overallStatus).toBe('cached')
        expect(result.weather.status).toBe('cached')
        expect(result.journey.status).toBe('available')
      })

      it('does NOT mask weather failure behind journey offline fallback (FIX M-1)', () => {
        // Open-Meteo failed with 500/timeout, origin was omitted (so journey is fallback)
        const context = {
          environment: failedWeather,
          journey: fallbackJourney,
        } as unknown as NormalizedTripContext

        const result = classifyTripIntelligence({
          resolutionStatus: 'resolved',
          context,
        })
        expect(result.overallStatus).toBe('failed')
        expect(result.weather.status).toBe('failed')
        expect(result.journey.status).toBe('offline_fallback')
      })

      it('does NOT mask journey failure behind weather offline fallback (FIX M-1)', () => {
        const context = {
          environment: fallbackWeather,
          journey: failedJourney,
        } as unknown as NormalizedTripContext

        const result = classifyTripIntelligence({
          resolutionStatus: 'resolved',
          context,
        })
        expect(result.overallStatus).toBe('failed')
        expect(result.weather.status).toBe('offline_fallback')
        expect(result.journey.status).toBe('failed')
      })

      it('returns partial when one service is live available while the other has an explicit failure', () => {
        // Weather succeeded, journey route calculation failed
        const context = {
          environment: fullLiveWeather,
          journey: failedJourney,
        } as unknown as NormalizedTripContext

        const result = classifyTripIntelligence({
          resolutionStatus: 'resolved',
          context,
        })
        expect(result.overallStatus).toBe('partial')
        expect(result.weather.status).toBe('available')
        expect(result.journey.status).toBe('failed')
      })

      it('returns outside_horizon when weather is outside horizon and journey is fallback', () => {
        const distantWeather: EnvironmentalContext = {
          daily: [
            {
              date: '2027-05-01',
              weatherProvenance: {
                provider: 'none',
                retrievalMethod: 'offline_fallback',
                source: 'none',
                availability: 'outside_forecast_horizon',
                confidence: 'unavailable',
              },
              aqiProvenance: {
                provider: 'none',
                retrievalMethod: 'offline_fallback',
                source: 'none',
                availability: 'outside_forecast_horizon',
                confidence: 'unavailable',
              },
            } as DailyEnvironmentalMeasurement,
          ],
          summary: {},
          hasFullForecastCoverage: false,
          hasPartialForecastCoverage: false,
          contextProvenance: {
            provider: 'open_meteo',
            retrievalMethod: 'network',
            availability: 'available',
            source: 'open_meteo_forecast',
            confidence: 'forecast',
          },
          attribution: 'Open-Meteo',
        }

        const context = {
          environment: distantWeather,
          journey: fallbackJourney,
        } as unknown as NormalizedTripContext

        const result = classifyTripIntelligence({
          resolutionStatus: 'resolved',
          context,
        })
        expect(result.overallStatus).toBe('outside_horizon')
        expect(result.weather.status).toBe('outside_horizon')
        expect(result.journey.status).toBe('offline_fallback')
      })
    })
  })
})
