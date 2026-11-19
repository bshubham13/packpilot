/**
 * PackPilot — Pure Journey Calculations Service
 * Implements Haversine distance, heuristic journey classification, duration range estimation,
 * overnight transit resolution, and legacy TransportMode[] adaptation.
 */

import type {
  Coordinates,
  CityIdentity,
  JourneyClassification,
  DurationRangeHours,
  OvernightSelection,
  TransportMode,
  DestinationMobility,
} from '../types'

export const EARTH_RADIUS_KM = 6371.0

/**
 * Calculates straight-line distance in kilometers between two WGS84 coordinate pairs
 * using the great-circle Haversine formula. Pure, synchronous, deterministic.
 */
export function calculateHaversineDistanceKm(
  coord1: Coordinates | { latitude: number; longitude: number },
  coord2: Coordinates | { latitude: number; longitude: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180.0

  const lat1 = toRad(coord1.latitude)
  const lon1 = toRad(coord1.longitude)
  const lat2 = toRad(coord2.latitude)
  const lon2 = toRad(coord2.longitude)

  const dLat = lat2 - lat1
  const dLon = lon2 - lon1

  const sinHalfDlat = Math.sin(dLat / 2)
  const sinHalfDlon = Math.sin(dLon / 2)

  const a =
    sinHalfDlat * sinHalfDlat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfDlon * sinHalfDlon

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = EARTH_RADIUS_KM * c

  // Return rounded to 1 decimal place
  return Math.round(distance * 10) / 10
}

/**
 * Classifies a journey into local (<50 km), regional (50-300 km), or intercity (>300 km).
 * Respects stable city identity and administrative context. Heuristic only.
 */
export function classifyJourney(
  straightLineDistanceKm?: number,
  originCity?: CityIdentity,
  destCity?: CityIdentity
): JourneyClassification {
  // If stable identities match identically, it is a local trip regardless of centroid drift
  if (originCity?.id && destCity?.id && originCity.id === destCity.id) {
    return 'local'
  }

  // If distance is known, use explicit distance bands
  if (typeof straightLineDistanceKm === 'number' && Number.isFinite(straightLineDistanceKm)) {
    if (straightLineDistanceKm < 50) {
      return 'local'
    }
    if (straightLineDistanceKm <= 300) {
      return 'regional'
    }
    return 'intercity'
  }

  // If distance is undefined, check structured city name + region + country match
  if (originCity && destCity) {
    const origKey = `${originCity.name.toLowerCase().trim()}_${(originCity.region || '').toLowerCase().trim()}_${originCity.countryCode}`
    const destKey = `${destCity.name.toLowerCase().trim()}_${(destCity.region || '').toLowerCase().trim()}_${destCity.countryCode}`
    if (origKey === destKey) {
      return 'local'
    }
  }

  return 'unknown'
}

/**
 * Calculates an estimated transit duration range using modal speed envelopes.
 * Clearly labeled as heuristic speed envelopes; never claimed as confirmed transit times.
 */
export function calculateDurationRangeHours(
  distanceKm: number | undefined,
  mode: TransportMode
): DurationRangeHours | undefined {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm) || distanceKm <= 0) {
    return undefined
  }

  const round1 = (val: number) => Math.round(val * 10) / 10

  switch (mode) {
    case 'flight': {
      // 1.5h airport check-in/security buffer + 750 km/h cruising
      const flightHours = 1.5 + distanceKm / 750
      return {
        min: round1(Math.max(1.5, flightHours * 0.9)),
        max: round1(Math.max(2.0, flightHours * 1.25)),
        method: 'speed_envelope_heuristic',
      }
    }
    case 'train': {
      // 1.25x rail circuity factor; 50 - 65 km/h average schedule speed
      const railDist = distanceKm * 1.25
      return {
        min: round1(railDist / 65),
        max: round1(railDist / 50),
        method: 'speed_envelope_heuristic',
      }
    }
    case 'car': {
      // 1.20x road circuity factor; 50 - 65 km/h highway speed
      const roadDist = distanceKm * 1.2
      return {
        min: round1(roadDist / 65),
        max: round1(roadDist / 50),
        method: 'speed_envelope_heuristic',
      }
    }
    case 'bus': {
      // 1.20x road circuity factor; 40 - 50 km/h coach speed
      const roadDist = distanceKm * 1.2
      return {
        min: round1(roadDist / 50),
        max: round1(roadDist / 40),
        method: 'speed_envelope_heuristic',
      }
    }
    case 'bike': {
      const roadDist = distanceKm * 1.2
      return {
        min: round1(roadDist / 50),
        max: round1(roadDist / 40),
        method: 'speed_envelope_heuristic',
      }
    }
    case 'other':
    default: {
      const dist = distanceKm * 1.2
      return {
        min: round1(dist / 50),
        max: round1(dist / 30),
        method: 'speed_envelope_heuristic',
      }
    }
  }
}

/**
 * Resolves overnight transit status.
 * Preserves user's manual override; if 'auto', derives from ground transit duration threshold (>= 8h).
 * Represents unresolved automatic status separately when duration is unknown.
 */
export function resolveOvernightTransit(
  preference: OvernightSelection = 'auto',
  durationRangeHours?: DurationRangeHours,
  mode?: TransportMode
): { isOvernightTransit: boolean; isOvernightResolved: boolean } {
  if (preference === 'yes') {
    return { isOvernightTransit: true, isOvernightResolved: true }
  }
  if (preference === 'no') {
    return { isOvernightTransit: false, isOvernightResolved: true }
  }

  // Preference is 'auto'
  if (!durationRangeHours) {
    return { isOvernightTransit: false, isOvernightResolved: false }
  }

  // For ground transit (train, bus, car), 8+ hours suggests overnight travel
  if (mode !== 'flight' && durationRangeHours.min >= 8.0) {
    return { isOvernightTransit: true, isOvernightResolved: true }
  }

  return { isOvernightTransit: false, isOvernightResolved: true }
}

/**
 * Guardrail 1: Explicitly adapts legacy TransportMode[] to the new primary transport model
 * without silently losing any selections.
 */
export function adaptTransportModes(modes: TransportMode[] = []): {
  primaryTransport: TransportMode
  destinationMobility: DestinationMobility
  secondaryTransportModes: TransportMode[]
} {
  const safeModes: TransportMode[] = modes.length > 0 ? modes : ['flight']

  // Precedence order for intercity primary transit
  const precedence: TransportMode[] = ['flight', 'train', 'bus', 'car', 'bike', 'other']
  let primaryTransport: TransportMode = 'other'

  for (const candidate of precedence) {
    if (safeModes.includes(candidate)) {
      primaryTransport = candidate
      break
    }
  }

  const secondaryTransportModes = safeModes.filter((m) => m !== primaryTransport)

  // Derive destination mobility without dropping secondary modes
  const isDrivingAtDestination =
    safeModes.includes('car') || safeModes.includes('bike')
      ? primaryTransport !== 'car' && primaryTransport !== 'bike'
      : false

  const isPublicTransitFocused =
    safeModes.includes('bus') || safeModes.includes('train')
      ? primaryTransport !== 'bus' && primaryTransport !== 'train'
      : false

  return {
    primaryTransport,
    destinationMobility: {
      isDrivingAtDestination,
      isPublicTransitFocused,
    },
    secondaryTransportModes,
  }
}
