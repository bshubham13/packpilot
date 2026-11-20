/**
 * PackPilot — Pure Journey Intelligence Recommendation Rules (Milestone 7.2B-1)
 *
 * Evaluates transit dynamics based on:
 * - Overnight transit status (reliable auto or explicit override)
 * - Journey distance & duration envelopes (local, regional, intercity)
 * - Explicit destination mobility preferences (isDrivingAtDestination, isPublicTransitFocused)
 *
 * Domain Guarantees:
 * - Pure, synchronous, deterministic function of (JourneyContext, TravellerComposition).
 * - Never fabricates route distance; treats Haversine distance as straight-line distance.
 * - Unknown classification or unresolved overnight status never generates speculative items.
 * - Destination mobility is NEVER inferred from intercity transport modes.
 * - No duplicate recommendations with baseRules or transportRules.
 */

import type {
  RecommendationCandidate,
  JourneyContext,
  TravellerComposition,
} from '../../types'
import { getReferenceWeight } from '../referenceWeights'

export function evaluateJourneyRules(
  journey: JourneyContext,
  travellers?: TravellerComposition
): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = []

  if (!journey) {
    return candidates
  }

  // Adult eligibility verification for legal vehicle operation
  const hasAdultDrivers = travellers ? travellers.adults > 0 : true

  // --- 1. Overnight Transit Essentials ---
  // Only generate when overnight transit is reliably resolved as true.
  // If unresolved (isOvernightResolved === false) or false, do NOT assume overnight.
  const isOvernightConfirmed = Boolean(journey.isOvernightTransit && journey.isOvernightResolved)

  if (isOvernightConfirmed) {
    // Canonical sleep mask & earplugs slug shared with accommodation rules
    candidates.push(
      {
        itemSlug: 'wear-dorm-earplugs',
        name: 'Contoured Sleep Mask & Soft Earplugs',
        category: 'clothing',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('wear-dorm-earplugs'),
        isShared: false,
        reasons: ['Light-blocking rest comfort and ambient noise reduction during confirmed overnight transit'],
      },
      {
        itemSlug: 'wear-travel-blanket',
        name: 'Compact Travel Wrap / Light Blanket',
        category: 'clothing',
        priority: 'recommended',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('wear-travel-blanket'),
        isShared: false,
        reasons: ['Warmth and temperature regulation during confirmed overnight transit'],
      }
    )
  }

  // --- 2. Journey Distance & Duration Dynamics ---
  // Respects journey classification: local (<50km), regional (50-300km), intercity (>300km), unknown.
  // Unknown or local classification does NOT trigger long-distance or heavy transit recommendations.
  const classification = journey.classification || 'unknown'
  const primaryTransport = journey.primaryTransport || 'other'
  const secondaryModes = journey.secondaryTransportModes || []
  const durationMinHours = journey.durationRangeHours?.min

  // Regional (50–300 km) and Intercity (>300 km) hydration
  if (classification === 'regional' || classification === 'intercity') {
    candidates.push({
      itemSlug: 'gear-reusable-bottle',
      name: 'Reusable Travel Water Bottle',
      category: 'gear',
      priority: 'recommended',
      quantityStrategy: 'per_person',
      targetAgeGroup: 'all',
      weightGrams: getReferenceWeight('gear-reusable-bottle'),
      isShared: false,
      reasons: [
        classification === 'intercity'
          ? 'Hydration during extended intercity transit (>300 km)'
          : 'Hydration during regional journey transit (50–300 km)',
      ],
    })

    // Motion relief wristbands restricted strictly to bus/coach travel
    const isBusTransit = primaryTransport === 'bus' || secondaryModes.includes('bus')
    if (isBusTransit) {
      candidates.push({
        itemSlug: 'health-motion-relief',
        name: 'Acupressure Motion Relief Wristbands',
        category: 'health',
        priority: 'optional',
        quantityStrategy: 'per_person',
        targetAgeGroup: 'all',
        weightGrams: getReferenceWeight('health-motion-relief'),
        isShared: false,
        reasons: ['Non-medicinal motion comfort for regional and long-distance coach/bus transit'],
      })
    }
  }

  // Long-duration comfort items (strictly durationMinHours >= 4.0; flight does NOT bypass this threshold)
  if (durationMinHours !== undefined && durationMinHours >= 4.0) {
    candidates.push({
      itemSlug: 'misc-transit-snacks',
      name: 'Compact Transit Snacks & Energy Bars',
      category: 'miscellaneous',
      priority: 'optional',
      quantityStrategy: 'per_person',
      targetAgeGroup: 'all',
      weightGrams: undefined, // Variable composite bundle: unweighted / unknown
      isShared: false,
      reasons: ['Sustained energy between transit terminals and meal stops (estimated journey ≥ 4 hours)'],
    })
  }

  // Neck pillow for non-flight journeys only (transportRules owns flight comfort wear-flight-comfort)
  const isNonFlight = primaryTransport !== 'flight'
  const hasLongGroundDurationOrOvernight =
    (durationMinHours !== undefined && durationMinHours >= 4.0) || isOvernightConfirmed

  if (isNonFlight && hasLongGroundDurationOrOvernight && (classification === 'intercity' || isOvernightConfirmed)) {
    candidates.push({
      itemSlug: 'wear-neck-pillow',
      name: 'Ergonomic Travel Neck Pillow',
      category: 'clothing',
      priority: 'optional',
      quantityStrategy: 'per_person',
      targetAgeGroup: 'adults_and_teens',
      weightGrams: getReferenceWeight('wear-neck-pillow'),
      isShared: false,
      reasons: [
        isOvernightConfirmed
          ? 'Cervical support for seated rest during confirmed overnight transit'
          : 'Neck support during extended ground transit (heuristic duration estimate ≥ 4 hours)',
      ],
    })
  }

  // --- 3. Destination Mobility Preferences ---
  // Only evaluate when explicit preference is true. Never infer from intercity transport modes.
  // Undefined means unknown, not false.
  const mobility = journey.destinationMobility

  if (mobility?.isDrivingAtDestination === true && hasAdultDrivers) {
    // Single shared driving credential requirement until individual drivers can be selected
    candidates.push(
      {
        itemSlug: 'doc-driver-licence',
        name: 'Valid Driver’s Licence',
        category: 'documents',
        priority: 'critical',
        quantityStrategy: 'fixed',
        quantityParams: { minQuantity: 1 },
        targetAgeGroup: 'adults',
        weightGrams: getReferenceWeight('doc-driver-licence'),
        isShared: true,
        reasons: ['Mandatory driver verification for legal vehicle operation at destination'],
      },
      {
        itemSlug: 'elec-car-mount',
        name: 'Smartphone Dashboard Mount & Car Charger',
        category: 'electronics',
        priority: 'recommended',
        quantityStrategy: 'fixed',
        quantityParams: { minQuantity: 1 },
        weightGrams: getReferenceWeight('elec-car-mount'),
        isShared: true,
        reasons: ['Hands-free GPS navigation and mobile charging while driving at destination'],
      }
    )
  }

  if (mobility?.isPublicTransitFocused === true) {
    candidates.push({
      itemSlug: 'doc-transit-pass',
      name: 'City Transit Card / Contactless Travel Pass',
      category: 'documents',
      priority: 'recommended',
      quantityStrategy: 'per_person',
      targetAgeGroup: 'all',
      weightGrams: getReferenceWeight('doc-transit-pass'),
      isShared: false,
      reasons: ['Fare payment card for municipal buses, trams, and metro networks at destination'],
    })
  }

  return candidates
}
