import React, { useMemo } from 'react'
import {
  Compass,
  RefreshCw,
  Sun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  Snowflake,
  CloudLightning,
  Thermometer,
  Droplets,
  ShieldAlert,
  Wind,
  Plane,
  Train,
  Car,
  Bus,
  Bike,
  Moon,
  AlertCircle,
  Loader2,
  Navigation,
} from 'lucide-react'
import type { NormalizedTripContext } from '../../types/context'
import type { TransportMode } from '../../types'
import type { TripResolutionStatus } from '../../stores/tripStore'
import {
  classifyTripIntelligence,
  getWmoWeatherDescription,
  getWmoWeatherGroup,
  formatAqi,
  type WeatherGroup,
} from '../../utils/intelligence'
import { Card } from '../ui/Card'
import { IntelligenceStatusBadge } from './IntelligenceStatusBadge'

export interface TravelIntelligenceCardProps {
  /**
   * The resolved NormalizedTripContext, or null/undefined if not yet resolved.
   */
  context?: NormalizedTripContext | null
  /**
   * Reactive resolution status from TripStore (e.g. 'idle' | 'resolving' | 'resolved' | 'failed').
   */
  resolutionStatus?: TripResolutionStatus
  /**
   * Optional callback to trigger manual insights refresh.
   */
  onRefresh?: () => void | Promise<void>
  /**
   * Whether a refresh operation is currently in flight.
   */
  isRefreshing?: boolean
  /**
   * Additional container classes.
   */
  className?: string
}

/**
 * Returns the matching Lucide icon for a canonical atmospheric weather group.
 */
function getWeatherGroupIcon(group: WeatherGroup, className = 'w-6 h-6'): React.ReactNode {
  switch (group) {
    case 'clear':
      return <Sun className={`${className} text-sunshine-yellow`} aria-hidden="true" />
    case 'cloudy':
      return <Cloud className={`${className} text-sand`} aria-hidden="true" />
    case 'fog':
      return <CloudFog className={`${className} text-sand`} aria-hidden="true" />
    case 'drizzle':
      return <CloudDrizzle className={`${className} text-forest-green`} aria-hidden="true" />
    case 'rain':
    case 'showers':
      return <CloudRain className={`${className} text-forest-green`} aria-hidden="true" />
    case 'snow':
      return <Snowflake className={`${className} text-sand`} aria-hidden="true" />
    case 'thunderstorm':
      return <CloudLightning className={`${className} text-terracotta`} aria-hidden="true" />
    case 'unknown':
    default:
      return <Cloud className={`${className} text-sand/60`} aria-hidden="true" />
  }
}

/**
 * Returns the matching transport icon.
 */
function getTransportIcon(mode?: TransportMode, className = 'w-4 h-4'): React.ReactNode {
  switch (mode) {
    case 'flight':
      return <Plane className={className} aria-hidden="true" />
    case 'train':
      return <Train className={className} aria-hidden="true" />
    case 'car':
      return <Car className={className} aria-hidden="true" />
    case 'bus':
      return <Bus className={className} aria-hidden="true" />
    case 'bike':
      return <Bike className={className} aria-hidden="true" />
    case 'other':
    default:
      return <Compass className={className} aria-hidden="true" />
  }
}

/**
 * TravelIntelligenceCard
 *
 * Travel Scrapbook + Adventure Editorial card presenting environmental forecasts,
 * atmospheric measurements, route distance heuristics, and transit mobility.
 */
export const TravelIntelligenceCard: React.FC<TravelIntelligenceCardProps> = ({
  context,
  resolutionStatus,
  onRefresh,
  isRefreshing = false,
  className = '',
}) => {
  const tripIntelligence = useMemo(
    () => classifyTripIntelligence({ resolutionStatus, context }),
    [resolutionStatus, context]
  )

  const { weather, journey, overallStatus } = tripIntelligence

  // --- Weather Intelligence Extracted State ---
  const env = context?.environment
  const summary = env?.summary

  // Find first day weather code and AQI
  const firstDay = env?.daily?.[0]
  const weatherCode = firstDay?.weatherCode
  const weatherGroup = getWmoWeatherGroup(weatherCode)
  const weatherConditionText = weatherCode !== undefined
    ? getWmoWeatherDescription(weatherCode)
    : weather.status === 'outside_horizon'
      ? 'Outside forecast horizon'
      : weather.status === 'offline_fallback'
        ? 'Seasonal climate estimate'
        : 'Condition pending'

  const minTemp = summary?.periodMinTempC
  const maxTemp = summary?.periodMaxTempC
  const hasTempRange = typeof minTemp === 'number' && typeof maxTemp === 'number'

  const rainProb = summary?.maxPrecipitationProbability
  const rainMm = summary?.totalPrecipitationMm
  const uvMax = summary?.maxUvIndex
  const aqiVal = firstDay?.usAqi

  const attributionText = env?.attribution || 'Weather data by Open-Meteo.com (CC BY 4.0)'

  // --- Journey Intelligence Extracted State ---
  const journeyCtx = context?.journey
  const originName = journeyCtx?.origin?.city?.name || 'Unspecified Origin'
  const destName = journeyCtx?.destination?.city?.name || 'Destination'
  const distanceKm = journeyCtx?.straightLineDistanceKm
  const hasDistance = typeof distanceKm === 'number' && Number.isFinite(distanceKm) && distanceKm >= 0

  const primaryTransport = journeyCtx?.primaryTransport || 'flight'
  const classification = journeyCtx?.classification || 'unknown'

  const isResolving = resolutionStatus === 'resolving' || overallStatus === 'resolving'

  return (
    <Card
      variant="scrapbook"
      padding="none"
      className={`overflow-hidden border border-sand/40 bg-warm-white text-ink-black shadow-card ${className}`.trim()}
    >
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand/30 bg-warm-cream/40 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-terracotta/15 text-terracotta">
            <Compass className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-serif text-base sm:text-lg font-bold tracking-tight text-ink-black">
              Travel Intelligence
            </h3>
            <p className="text-[11px] sm:text-xs text-ink-muted">
              Live environmental forecasts & route heuristics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <IntelligenceStatusBadge status={overallStatus} size="sm" />

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing || isResolving}
              aria-label="Refresh intelligence insights"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sand/40 bg-warm-white text-ink-muted transition-colors hover:border-sand hover:bg-sand/15 hover:text-ink-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing || isResolving ? 'animate-spin text-terracotta' : ''}`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Content Panels (Mobile-first vertical stack, 2-col on tablet/desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 sm:p-6">
        {/* --- WEATHER PANEL --- */}
        <div className="flex flex-col justify-between rounded-card border border-sand/30 bg-warm-white/70 p-4 transition-all">
          <div>
            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-sand/20 pb-2.5">
              <span className="font-serif text-sm font-bold text-ink-black">
                Weather & Climate
              </span>
              <IntelligenceStatusBadge
                status={weather.status}
                label={weather.label}
                size="sm"
              />
            </div>

            {/* Panel Body */}
            {weather.status === 'resolving' ? (
              <div className="flex min-h-[140px] flex-col items-center justify-center gap-2 text-center text-ink-muted">
                <Loader2 className="h-5 w-5 animate-spin text-terracotta" />
                <p className="text-xs">Gathering meteorological observations...</p>
              </div>
            ) : weather.status === 'failed' ? (
              <div className="my-3 rounded-card border border-terracotta/25 bg-terracotta/10 p-3 text-xs text-terracotta">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" />
                  <div>
                    <p className="font-semibold text-terracotta">Weather data unavailable</p>
                    <p className="mt-0.5 text-ink-muted">
                      {weather.description || 'Could not connect to the weather service.'}
                    </p>
                    {onRefresh && (
                      <button
                        type="button"
                        onClick={onRefresh}
                        className="mt-2 text-xs font-semibold text-terracotta underline hover:text-terracotta-dark"
                      >
                        Retry weather lookup
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {/* Primary Metric Row: Weather Condition & Temperature Range */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-sand/15">
                      {getWeatherGroupIcon(weatherGroup, 'w-6 h-6')}
                    </div>
                    <div>
                      <p className="font-sans text-sm font-semibold text-ink-black">
                        {weatherConditionText}
                      </p>
                      <p className="text-[11px] text-ink-muted">
                        {weather.description}
                      </p>
                    </div>
                  </div>

                  {/* Temperature Range (Strictly guardrail: never show missing as 0) */}
                  <div className="text-right">
                    {hasTempRange ? (
                      <div>
                        <span className="font-serif text-lg font-bold text-ink-black">
                          {`${Math.round(minTemp as number)}° – ${Math.round(maxTemp as number)}°C`}
                        </span>
                        <p className="text-[10px] text-ink-muted uppercase tracking-wider">
                          Period Range
                        </p>
                      </div>
                    ) : typeof minTemp === 'number' ? (
                      <div>
                        <span className="font-serif text-lg font-bold text-ink-black">
                          {`~${Math.round(minTemp)}°C`}
                        </span>
                        <p className="text-[10px] text-ink-muted">Expected</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-ink-muted italic">
                        <Thermometer className="h-3 w-3" />
                        <span>Temp pending</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Secondary Atmospheric Grid */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-sand/20 text-xs">
                  {/* Rain Probability / Precipitation mm */}
                  <div className="flex items-center gap-1.5 text-ink-muted">
                    <Droplets className="h-3.5 w-3.5 text-forest-green shrink-0" />
                    <span>
                      {typeof rainProb === 'number' && Number.isFinite(rainProb) ? (
                        <span className="text-ink-black font-medium">{`${Math.round(rainProb)}% rain`}</span>
                      ) : (
                        <span>Rain prob: --</span>
                      )}
                      {typeof rainMm === 'number' && Number.isFinite(rainMm) && rainMm > 0 && (
                        <span className="ml-1 text-[11px] text-ink-muted">{`(${rainMm} mm)`}</span>
                      )}
                    </span>
                  </div>

                  {/* UV Index */}
                  <div className="flex items-center gap-1.5 text-ink-muted">
                    <ShieldAlert className="h-3.5 w-3.5 text-terracotta shrink-0" />
                    <span>
                      {typeof uvMax === 'number' && Number.isFinite(uvMax) ? (
                        <span className="text-ink-black font-medium">
                          {`UV ${Math.round(uvMax * 10) / 10}`}
                          {summary?.isExtremeUv && (
                            <span className="ml-1 text-[10px] text-terracotta font-bold uppercase">
                              Extreme
                            </span>
                          )}
                        </span>
                      ) : (
                        <span>UV: --</span>
                      )}
                    </span>
                  </div>

                  {/* Air Quality (AQI) */}
                  <div className="flex items-center gap-1.5 text-ink-muted col-span-2">
                    <Wind className="h-3.5 w-3.5 text-sand shrink-0" />
                    <span>
                      {typeof aqiVal === 'number' && Number.isFinite(aqiVal) ? (
                        <span className="text-ink-black font-medium">
                          {`AQI: ${formatAqi(aqiVal)}`}
                        </span>
                      ) : (
                        <span>Air Quality: Not measured</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mandatory Open-Meteo Attribution */}
          <div className="mt-3 border-t border-sand/20 pt-2 text-[10px] text-ink-muted/80">
            {attributionText}
          </div>
        </div>

        {/* --- JOURNEY & MOBILITY PANEL --- */}
        <div className="flex flex-col justify-between rounded-card border border-sand/30 bg-warm-white/70 p-4 transition-all">
          <div>
            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-sand/20 pb-2.5">
              <span className="font-serif text-sm font-bold text-ink-black">
                Journey & Mobility
              </span>
              <IntelligenceStatusBadge
                status={journey.status}
                label={journey.label}
                size="sm"
              />
            </div>

            {/* Panel Body */}
            {journey.status === 'resolving' ? (
              <div className="flex min-h-[140px] flex-col items-center justify-center gap-2 text-center text-ink-muted">
                <Loader2 className="h-5 w-5 animate-spin text-terracotta" />
                <p className="text-xs">Computing transit heuristics & distance...</p>
              </div>
            ) : journey.status === 'failed' ? (
              <div className="my-3 rounded-card border border-terracotta/25 bg-terracotta/10 p-3 text-xs text-terracotta">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" />
                  <div>
                    <p className="font-semibold text-terracotta">Journey heuristics unavailable</p>
                    <p className="mt-0.5 text-ink-muted">
                      {journey.description || 'Route calculations encountered an error.'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {/* Route Header (Origin -> Destination) */}
                <div className="flex items-center gap-2 text-sm font-semibold text-ink-black">
                  <span className="truncate max-w-[45%] text-ink-muted">{originName}</span>
                  <span className="text-terracotta font-bold">→</span>
                  <span className="truncate max-w-[45%] text-ink-black">{destName}</span>
                </div>

                {/* Distance Information & Mandatory Straight-Line Disclaimer */}
                <div className="rounded-card bg-sand/15 p-2.5">
                  {hasDistance ? (
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-serif text-lg font-bold text-ink-black">
                          {`${Math.round(distanceKm as number)} km`}
                        </span>
                        <span className="text-[11px] font-medium text-ink-muted">
                          (Straight-line distance)
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-ink-muted leading-tight">
                        Note: Actual road or rail travel distance will vary based on routes taken.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-muted italic">
                      Origin not specified — local mobility heuristics active for destination.
                    </p>
                  )}
                </div>

                {/* Classification & Transport Mode Chips */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  {/* Transport Mode */}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sand/40 bg-warm-white px-2.5 py-1 text-ink-black font-medium">
                    {getTransportIcon(primaryTransport)}
                    <span className="capitalize">{primaryTransport}</span>
                  </span>

                  {/* Journey Classification */}
                  <span className="inline-flex items-center rounded-full border border-sand/40 bg-warm-white px-2.5 py-1 text-ink-muted capitalize">
                    {classification === 'unknown' ? 'Local / In-destination' : `${classification} trip`}
                  </span>
                </div>

                {/* Overnight & Destination Mobility Notes */}
                <div className="space-y-1 pt-1 text-[11px] text-ink-muted">
                  {journeyCtx?.isOvernightTransit && (
                    <div className="flex items-center gap-1.5 font-medium text-forest-green">
                      <Moon className="h-3.5 w-3.5 text-forest-green shrink-0" />
                      <span>Overnight transit selection resolved</span>
                    </div>
                  )}

                  {journeyCtx?.destinationMobility?.isDrivingAtDestination && (
                    <div className="flex items-center gap-1.5">
                      <Car className="h-3.5 w-3.5 text-ink-muted shrink-0" />
                      <span>Driving mobility prioritized at destination</span>
                    </div>
                  )}

                  {journeyCtx?.destinationMobility?.isPublicTransitFocused && (
                    <div className="flex items-center gap-1.5">
                      <Navigation className="h-3.5 w-3.5 text-ink-muted shrink-0" />
                      <span>Public transit focused destination mobility</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
