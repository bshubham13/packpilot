/**
 * PackPilot — Pure Fallback Journey Context Resolver
 * Assembles a synchronous, pure JourneyContext for trips evaluated without pre-resolved NormalizedTripContext.
 * Strictly avoids I/O, network services, and database dependencies.
 */

import type {
  TripConfig,
  JourneyContext,
} from '../types'
import {
  adaptTransportModes,
  calculateHaversineDistanceKm,
  classifyJourney,
  calculateDurationRangeHours,
  resolveOvernightTransit,
} from '../services/journeyService'

export function resolveFallbackJourneyContext(config: TripConfig): JourneyContext {
  const adapted = adaptTransportModes(config.transportModes, config.destinationMobility)
  const primaryTransport = config.primaryTransport || adapted.primaryTransport
  const secondaryTransportModes = adapted.secondaryTransportModes
  const destinationMobility = adapted.destinationMobility

  let straightLineDistanceKm: number | undefined = undefined
  if (config.originLocation?.coordinates && config.destinationLocation?.coordinates) {
    straightLineDistanceKm = calculateHaversineDistanceKm(
      config.originLocation.coordinates,
      config.destinationLocation.coordinates
    )
  }

  const classification = classifyJourney(
    straightLineDistanceKm,
    config.originLocation?.city,
    config.destinationLocation?.city
  )

  const durationRangeHours = calculateDurationRangeHours(
    straightLineDistanceKm,
    primaryTransport
  )

  const overnightResult = resolveOvernightTransit(
    config.overnightSelection,
    durationRangeHours,
    primaryTransport
  )

  return {
    origin: config.originLocation,
    destination: config.destinationLocation || {
      city: {
        id: `manual_${(config.destination || 'destination').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        name: config.destination || 'Destination',
        country: 'Unknown',
        countryCode: 'UN',
      },
    },
    straightLineDistanceKm,
    isHeuristicDistance: straightLineDistanceKm !== undefined,
    classification,
    durationRangeHours,
    overnightSelection: config.overnightSelection || 'auto',
    isOvernightTransit: overnightResult.isOvernightTransit,
    isOvernightResolved: overnightResult.isOvernightResolved,
    primaryTransport,
    destinationMobility,
    secondaryTransportModes,
    provenance: {
      distanceMethod: straightLineDistanceKm !== undefined ? 'haversine' : 'none',
      retrievalMethod: 'offline_fallback',
      availability: straightLineDistanceKm !== undefined ? 'available' : 'unresolved_location',
    },
  }
}
