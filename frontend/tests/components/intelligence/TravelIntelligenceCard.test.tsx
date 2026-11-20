import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import {
  TravelIntelligenceCard,
  IntelligenceStatusBadge,
} from '../../../src/components/intelligence'
import type { NormalizedTripContext } from '../../../src/types/context'

describe('Travel Intelligence Components (Slice 2C-2)', () => {
  describe('IntelligenceStatusBadge', () => {
    it('renders all supported status values with accessible role and labels', () => {
      const statuses = [
        'resolving',
        'available',
        'cached',
        'partial',
        'outside_horizon',
        'offline_fallback',
        'failed',
        'idle',
      ] as const

      for (const status of statuses) {
        const html = renderToString(<IntelligenceStatusBadge status={status} />)
        expect(html).toContain('role="status"')
        expect(html).toContain('aria-label=')
      }
    })

    it('supports custom label overrides', () => {
      const html = renderToString(
        <IntelligenceStatusBadge status="available" label="Live 16-Day Forecast" />
      )
      expect(html).toContain('Live 16-Day Forecast')
      expect(html).toContain('aria-label="Intelligence status: Live 16-Day Forecast"')
    })

    it('can suppress icon rendering when showIcon is false', () => {
      const htmlWithIcon = renderToString(<IntelligenceStatusBadge status="available" showIcon={true} />)
      const htmlWithoutIcon = renderToString(<IntelligenceStatusBadge status="available" showIcon={false} />)

      expect(htmlWithIcon).toContain('<svg')
      expect(htmlWithoutIcon).not.toContain('<svg')
    })
  })

  describe('TravelIntelligenceCard', () => {
    // Standard mock base context
    const baseContext: NormalizedTripContext = {
      contextVersion: '2.0.0',
      contextState: 'current',
      tripId: 'trip-test-1',
      name: 'Alpine Expedition',
      startDate: '2026-07-10',
      endDate: '2026-07-18',
      durationDays: 9,
      travellers: { adults: 2, teens: 0, children: 0, infants: 0 },
      hasLaundryAccess: true,
      activities: ['sightseeing'],
      personalPreferences: [],
      baggageConfig: { bags: [] },
      contextGeneratedAt: '2026-07-01T10:00:00.000Z',
      environment: {
        daily: [
          {
            date: '2026-07-10',
            weatherCode: 0, // Clear sky
            usAqi: 35, // Good
            temperatureMinC: 14,
            temperatureMaxC: 26,
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
        summary: {
          periodMinTempC: 12,
          periodMaxTempC: 28,
          maxPrecipitationProbability: 25,
          totalPrecipitationMm: 4.5,
          maxUvIndex: 6.2,
          elevationMeters: 450,
        },
        hasFullForecastCoverage: true,
        hasPartialForecastCoverage: false,
        contextProvenance: {
          provider: 'open_meteo',
          retrievalMethod: 'network',
          source: 'open_meteo_forecast',
          availability: 'available',
          confidence: 'forecast',
          fetchedAt: '2026-07-01T09:00:00.000Z',
        },
        attribution: 'Weather data by Open-Meteo.com (CC BY 4.0)',
      },
      journey: {
        origin: {
          city: { id: 'zurich', name: 'Zurich', country: 'Switzerland', countryCode: 'CH' },
          coordinates: { latitude: 47.3769, longitude: 8.5417, isCentroid: false },
        },
        destination: {
          city: { id: 'interlaken', name: 'Interlaken', country: 'Switzerland', countryCode: 'CH' },
          coordinates: { latitude: 46.6863, longitude: 7.8632, isCentroid: false },
        },
        straightLineDistanceKm: 85.3,
        isHeuristicDistance: true,
        classification: 'regional',
        overnightSelection: 'auto',
        isOvernightTransit: false,
        isOvernightResolved: true,
        primaryTransport: 'train',
        destinationMobility: { isDrivingAtDestination: false, isPublicTransitFocused: true },
        secondaryTransportModes: [],
        provenance: {
          distanceMethod: 'haversine',
          retrievalMethod: 'offline_fallback',
          availability: 'available',
        },
      },
    }

    it('renders full live available intelligence state with expected metrics', () => {
      const html = renderToString(
        <TravelIntelligenceCard
          context={baseContext}
          resolutionStatus="resolved"
        />
      )

      // Header
      expect(html).toContain('Travel Intelligence')
      expect(html).toContain('Live environmental forecasts &amp; route heuristics')
      expect(html).toContain('Available')

      // Weather Panel
      expect(html).toContain('Weather &amp; Climate')
      expect(html).toContain('Clear sky')
      expect(html).toContain('12° – 28°C')
      expect(html).toContain('25% rain')
      expect(html).toContain('4.5 mm')
      expect(html).toContain('UV 6.2')
      expect(html).toContain('AQI: 35 (Good)')
      expect(html).toContain('Weather data by Open-Meteo.com (CC BY 4.0)')

      // Journey Panel
      expect(html).toContain('Journey &amp; Mobility')
      expect(html).toContain('Zurich')
      expect(html).toContain('Interlaken')
      expect(html).toContain('85 km')
      expect(html).toContain('(Straight-line distance)')
      expect(html).toContain('Note: Actual road or rail travel distance will vary based on routes taken.')
      expect(html).toContain('train')
      expect(html).toContain('regional trip')
      expect(html).toContain('Public transit focused destination mobility')
    })

    it('renders resolving state properly during background execution', () => {
      const html = renderToString(
        <TravelIntelligenceCard
          context={null}
          resolutionStatus="resolving"
        />
      )

      expect(html).toContain('Updating...')
      expect(html).toContain('Gathering meteorological observations...')
      expect(html).toContain('Computing transit heuristics &amp; distance...')
    })

    it('renders cached intelligence state without falsely claiming live data', () => {
      const cachedContext: NormalizedTripContext = {
        ...baseContext,
        environment: {
          ...baseContext.environment,
          contextProvenance: {
            ...baseContext.environment.contextProvenance,
            retrievalMethod: 'cache',
            fetchedAt: '2026-07-01T08:00:00.000Z',
          },
        },
      }

      const html = renderToString(
        <TravelIntelligenceCard
          context={cachedContext}
          resolutionStatus="resolved"
        />
      )

      expect(html).toContain('Cached')
      expect(html).not.toContain('Live Forecast')
      expect(html).toContain('85 km')
    })

    it('renders outside forecast horizon without fabricating measurements', () => {
      const horizonContext: NormalizedTripContext = {
        ...baseContext,
        environment: {
          daily: [
            {
              date: '2027-04-10',
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
          summary: {}, // No temperature or precipitation measurements
          hasFullForecastCoverage: false,
          hasPartialForecastCoverage: false,
          contextProvenance: {
            provider: 'open_meteo',
            retrievalMethod: 'network',
            source: 'open_meteo_forecast',
            availability: 'available',
            confidence: 'forecast',
          },
          attribution: 'Weather data by Open-Meteo.com',
        },
        journey: {
          ...baseContext.journey,
          origin: undefined,
          straightLineDistanceKm: undefined,
          provenance: {
            distanceMethod: 'none',
            retrievalMethod: 'offline_fallback',
            availability: 'unresolved_location',
          },
        },
      }

      const html = renderToString(
        <TravelIntelligenceCard
          context={horizonContext}
          resolutionStatus="resolved"
        />
      )

      expect(html).toContain('Outside Horizon')
      expect(html).toContain('Outside Forecast Horizon')
      expect(html).toContain('Outside forecast horizon')
      expect(html).toContain('Temp pending')
      expect(html).toContain('Rain prob: --')
      expect(html).toContain('UV: --')
      expect(html).toContain('Air Quality: Not measured')
      // STRICT: Must not display 0°C or 0% when missing
      expect(html).not.toContain('0° – 0°C')
    })

    it('renders independent weather failure with retry callback while preserving journey availability', () => {
      const mockRefresh = vi.fn()
      const weatherFailedContext: NormalizedTripContext = {
        ...baseContext,
        environment: {
          ...baseContext.environment,
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
        },
      }

      const html = renderToString(
        <TravelIntelligenceCard
          context={weatherFailedContext}
          resolutionStatus="resolved"
          onRefresh={mockRefresh}
        />
      )

      // Weather panel shows failure & retry
      expect(html).toContain('Weather data unavailable')
      expect(html).toContain('Retry weather lookup')

      // Journey panel remains available and functional
      expect(html).toContain('Route Available')
      expect(html).toContain('85 km')
    })

    it('renders destination-only journey when origin is not specified without claiming route availability', () => {
      const originlessContext: NormalizedTripContext = {
        ...baseContext,
        journey: {
          ...baseContext.journey,
          origin: undefined,
          straightLineDistanceKm: undefined,
          classification: 'unknown',
          provenance: {
            distanceMethod: 'none',
            retrievalMethod: 'offline_fallback',
            availability: 'unresolved_location',
          },
        },
      }

      const html = renderToString(
        <TravelIntelligenceCard
          context={originlessContext}
          resolutionStatus="resolved"
        />
      )

      expect(html).toContain('Unspecified Origin')
      expect(html).toContain('Origin not specified — local mobility heuristics active for destination.')
      expect(html).toContain('Location Unresolved')
      expect(html).toContain('Local / In-destination')
    })

    it('renders refresh button with accessible label and disabled during refresh', () => {
      const onRefresh = vi.fn()

      const normalHtml = renderToString(
        <TravelIntelligenceCard
          context={baseContext}
          onRefresh={onRefresh}
          isRefreshing={false}
        />
      )
      expect(normalHtml).toContain('aria-label="Refresh intelligence insights"')
      expect(normalHtml).not.toContain('disabled=""')

      const refreshingHtml = renderToString(
        <TravelIntelligenceCard
          context={baseContext}
          onRefresh={onRefresh}
          isRefreshing={true}
        />
      )
      expect(refreshingHtml).toContain('disabled=""')
      expect(refreshingHtml).toContain('animate-spin')
    })

    it('renders partial status when weather forecast coverage is partial', () => {
      const partialContext: NormalizedTripContext = {
        ...baseContext,
        environment: {
          ...baseContext.environment,
          hasFullForecastCoverage: false,
          hasPartialForecastCoverage: true,
        },
      }

      const html = renderToString(
        <TravelIntelligenceCard
          context={partialContext}
          resolutionStatus="resolved"
        />
      )

      expect(html).toContain('Partial')
      expect(html).toContain('Partial Forecast')
      expect(html).toContain('Trip extends beyond the 16-day forecast horizon')
    })

    it('renders pure offline fallback state for both weather and journey without fabricating data', () => {
      const fallbackContext: NormalizedTripContext = {
        ...baseContext,
        environment: {
          ...baseContext.environment,
          daily: [],
          summary: {},
          hasFullForecastCoverage: false,
          hasPartialForecastCoverage: false,
          contextProvenance: {
            provider: 'none',
            retrievalMethod: 'offline_fallback',
            source: 'none',
            availability: 'unresolved_location',
            confidence: 'unavailable',
          },
        },
        journey: {
          ...baseContext.journey,
          origin: undefined,
          straightLineDistanceKm: undefined,
          provenance: {
            distanceMethod: 'none',
            retrievalMethod: 'offline_fallback',
            availability: 'unresolved_location',
          },
        },
      }

      const html = renderToString(
        <TravelIntelligenceCard
          context={fallbackContext}
          resolutionStatus="resolved"
        />
      )

      expect(html).toContain('Offline Baseline')
      expect(html).toContain('Location Unresolved')
      expect(html).toContain('Seasonal climate estimate')
      expect(html).toContain('Temp pending')
      expect(html).toContain('Rain prob: --')
      expect(html).toContain('Air Quality: Not measured')
      expect(html).not.toContain('0° – 0°C')
    })

    it('renders idle pending state when resolution has not run and context is null', () => {
      const html = renderToString(
        <TravelIntelligenceCard
          context={null}
          resolutionStatus="idle"
        />
      )

      expect(html).toContain('Pending')
      expect(html).toContain('Weather Pending')
      expect(html).toContain('Route Pending')
    })

    it('renders overnight transit and driving mobility badges when configured', () => {
      const overnightContext: NormalizedTripContext = {
        ...baseContext,
        journey: {
          ...baseContext.journey,
          primaryTransport: 'car',
          isOvernightTransit: true,
          destinationMobility: {
            isDrivingAtDestination: true,
            isPublicTransitFocused: false,
          },
        },
      }

      const html = renderToString(
        <TravelIntelligenceCard
          context={overnightContext}
          resolutionStatus="resolved"
        />
      )

      expect(html).toContain('car')
      expect(html).toContain('Overnight transit selection resolved')
      expect(html).toContain('Driving mobility prioritized at destination')
    })
  })
})
