/**
 * PackPilot — Context & Environmental Domain Contracts
 * Specification Version: 2.0.0 (Milestone 7.1)
 *
 * Provides strongly typed contracts for:
 * - City identity and resolved coordinates
 * - Journey heuristics and transport adaptation
 * - Independent per-day weather and AQI provenance
 * - Explicit overnight transit selections
 * - Context versioning distinguishing legacy trips from current trips
 */

import type {
  TransportMode,
  TripActivity,
  AccommodationType,
  BaggageConfig,
  TravellerComposition,
  ClimateType,
} from './index'

// --- 1. City Identity & Coordinates ---

export interface CityIdentity {
  id: string                    // Stable unique key (e.g. "pune_maharashtra_in" or GeoNames ID)
  name: string                  // Normalized name: "Pune"
  region?: string               // State/Province: "Maharashtra"
  country: string               // Country name: "India"
  countryCode: string           // ISO-3166-1 alpha-2: "IN"
  rawInput?: string             // Original user string if unselected from dropdown
}

export interface Coordinates {
  latitude: number
  longitude: number
  elevationMeters?: number
  isCentroid: boolean           // True if administrative municipality centroid
}

export interface ResolvedLocation {
  city: CityIdentity
  coordinates?: Coordinates     // Undefined if geocoding failed or offline
}

// --- 2. Provenance & Availability Tracking ---

export type DataRetrievalMethod = 'network' | 'cache' | 'offline_fallback'

export type DataAvailability =
  | 'available'
  | 'outside_forecast_horizon'  // e.g. Weather > 16 days, AQI > 7 days
  | 'provider_error'
  | 'unresolved_location'

export type EnvironmentalSource =
  | 'open_meteo_forecast'
  | 'user_manual_override'
  | 'none'

export interface MetricProvenance {
  provider: 'open_meteo' | 'none'
  retrievalMethod: DataRetrievalMethod
  fetchedAt?: string            // ISO 8601
  source: EnvironmentalSource
  availability: DataAvailability
  confidence: 'forecast' | 'user_override' | 'unavailable'
}

// --- 3. Per-Day Environmental Measurements ---

export interface DailyEnvironmentalMeasurement {
  date: string                  // YYYY-MM-DD
  temperatureMinC?: number
  temperatureMaxC?: number
  precipitationProbabilityMax?: number // Present ONLY when within forecast horizon (never fabricated)
  precipitationSumMm?: number
  windSpeedMaxKmh?: number
  uvIndexMax?: number
  weatherCode?: number
  usAqi?: number                // US EPA standard AQI (0–500+)
  pm25Ugm3?: number             // Raw PM2.5 in ug/m3
  weatherProvenance: MetricProvenance
  aqiProvenance: MetricProvenance
}

export interface EnvironmentalSummary {
  periodMinTempC?: number       // Lowest min temp across available forecast days
  periodMaxTempC?: number       // Highest max temp across available forecast days
  maxDiurnalRangeC?: number     // Max (Tmax - Tmin) across days
  maxPrecipitationProbability?: number
  totalPrecipitationMm?: number
  maxUvIndex?: number
  elevationMeters?: number
  isHighAltitude?: boolean      // true if elevation >= 2500m; undefined if elevation unknown
  isExtremeUv?: boolean         // true if maxUvIndex >= 8; undefined if UV unknown
  isSubZero?: boolean           // true if periodMinTempC < 0; undefined if temperature unknown
}

export interface EnvironmentalContext {
  daily: DailyEnvironmentalMeasurement[]
  summary: EnvironmentalSummary
  hasFullForecastCoverage: boolean   // 100% of trip dates have live forecast
  hasPartialForecastCoverage: boolean// Trip crosses 16-day forecast horizon
  contextProvenance: MetricProvenance
  attribution: string                // Mandatory Open-Meteo attribution
}

// --- 4. Journey & Transport Adaptation ---

export type OvernightSelection = 'auto' | 'yes' | 'no'

export type JourneyClassification =
  | 'local'       // < 50 km or same city identity
  | 'regional'    // 50 – 300 km
  | 'intercity'   // > 300 km
  | 'unknown'     // Origin not provided or coordinates unresolvable

export interface DurationRangeHours {
  min: number
  max: number
  method: 'speed_envelope_heuristic' | 'user_override'
}

export interface DestinationMobility {
  isDrivingAtDestination: boolean
  isPublicTransitFocused: boolean
}

export interface JourneyContext {
  origin?: ResolvedLocation
  destination: ResolvedLocation
  straightLineDistanceKm?: number
  isHeuristicDistance: boolean   // True for Haversine
  classification: JourneyClassification
  durationRangeHours?: DurationRangeHours

  // Overnight transit state (Guardrail 5)
  overnightSelection: OvernightSelection  // Preserves user selection
  isOvernightTransit: boolean             // Resolved transit state
  isOvernightResolved: boolean            // False when auto cannot resolve due to unknown duration

  primaryTransport: TransportMode
  destinationMobility: DestinationMobility
  secondaryTransportModes: TransportMode[] // Preserved from legacy multi-select (Guardrail 1)

  provenance: {
    distanceMethod: 'haversine' | 'none'
    retrievalMethod: DataRetrievalMethod
    availability: DataAvailability
  }
}

// --- 5. Normalized Trip Context ---

export type ContextState =
  | 'legacy'    // Saved under engineVersion < 2.0.0 without origin/environmental fields
  | 'current'   // Modern trip structure (even if origin omitted or offline)

export interface NormalizedTripContext {
  contextVersion: '2.0.0'
  contextState: ContextState
  tripId: string
  name: string
  startDate: string
  endDate: string
  durationDays: number
  travellers: TravellerComposition
  hasLaundryAccess: boolean
  activities: TripActivity[]
  accommodationType?: AccommodationType
  personalPreferences: string[]
  specialRequirements?: string
  baggageConfig: BaggageConfig
  legacyClimateEnum?: ClimateType // Preserved for legacy fallback

  journey: JourneyContext
  environment: EnvironmentalContext

  contextGeneratedAt: string
}
