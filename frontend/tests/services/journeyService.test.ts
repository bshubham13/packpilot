import { describe, it, expect } from 'vitest'
import {
  calculateHaversineDistanceKm,
  classifyJourney,
  calculateDurationRangeHours,
  resolveOvernightTransit,
  adaptTransportModes,
} from '../../src/services/journeyService'
import type { CityIdentity, Coordinates } from '../../src/types'

describe('JourneyService — Pure Journey & Transport Calculations', () => {
  const puneCoords: Coordinates = {
    latitude: 18.5204,
    longitude: 73.8567,
    isCentroid: true,
  }

  const delhiCoords: Coordinates = {
    latitude: 28.6139,
    longitude: 77.209,
    isCentroid: true,
  }

  const noidaCoords: Coordinates = {
    latitude: 28.5355,
    longitude: 77.391,
    isCentroid: true,
  }

  const puneCity: CityIdentity = {
    id: 'geoname_pune',
    name: 'Pune',
    region: 'Maharashtra',
    country: 'India',
    countryCode: 'IN',
  }

  const delhiCity: CityIdentity = {
    id: 'geoname_delhi',
    name: 'Delhi',
    region: 'Delhi',
    country: 'India',
    countryCode: 'IN',
  }

  const noidaCity: CityIdentity = {
    id: 'geoname_noida',
    name: 'Noida',
    region: 'Uttar Pradesh',
    country: 'India',
    countryCode: 'IN',
  }

  describe('Haversine Distance & City Scenarios', () => {
    it('calculates accurate straight-line distance for Pune -> Delhi (~1173 km)', () => {
      const distance = calculateHaversineDistanceKm(puneCoords, delhiCoords)
      expect(distance).toBeGreaterThan(1170)
      expect(distance).toBeLessThan(1180)
    })

    it('calculates accurate straight-line distance for Noida -> Delhi (~20 km)', () => {
      const distance = calculateHaversineDistanceKm(noidaCoords, delhiCoords)
      expect(distance).toBeGreaterThan(18)
      expect(distance).toBeLessThan(25)
    })

    it('classifies Pune -> Delhi as intercity (> 300 km)', () => {
      const distance = calculateHaversineDistanceKm(puneCoords, delhiCoords)
      const classification = classifyJourney(distance, puneCity, delhiCity)
      expect(classification).toBe('intercity')
    })

    it('classifies Noida -> Delhi as local (< 50 km)', () => {
      const distance = calculateHaversineDistanceKm(noidaCoords, delhiCoords)
      const classification = classifyJourney(distance, noidaCity, delhiCity)
      expect(classification).toBe('local')
    })

    it('classifies identical city identities as local regardless of distance', () => {
      const classification = classifyJourney(undefined, delhiCity, delhiCity)
      expect(classification).toBe('local')
    })

    it('returns unknown classification when origin or distance is missing', () => {
      const classification = classifyJourney(undefined, undefined, delhiCity)
      expect(classification).toBe('unknown')
    })
  })

  describe('Duration Range Estimation', () => {
    it('returns undefined duration range when distance is undefined', () => {
      expect(calculateDurationRangeHours(undefined, 'flight')).toBeUndefined()
      expect(calculateDurationRangeHours(0, 'train')).toBeUndefined()
    })

    it('calculates speed envelope ranges for train', () => {
      const range = calculateDurationRangeHours(1173, 'train')
      expect(range).toBeDefined()
      expect(range?.method).toBe('speed_envelope_heuristic')
      // 1173 * 1.25 = 1466.25km / 65 ~ 22.6h, / 50 ~ 29.3h
      expect(range?.min).toBeGreaterThanOrEqual(22)
      expect(range?.max).toBeGreaterThanOrEqual(28)
      expect(range?.max).toBeGreaterThan(range?.min || 0)
    })

    it('calculates speed envelope ranges for flight including airport buffers', () => {
      const range = calculateDurationRangeHours(1173, 'flight')
      expect(range).toBeDefined()
      // 1.5h buffer + 1173 / 750 ~ 1.56h = 3.06h
      expect(range?.min).toBeGreaterThanOrEqual(2.5)
      expect(range?.max).toBeLessThanOrEqual(4.5)
    })
  })

  describe('Overnight Transit Resolution (Guardrail 5)', () => {
    it('respects explicit "yes" override regardless of duration', () => {
      const result = resolveOvernightTransit('yes', { min: 2, max: 3, method: 'speed_envelope_heuristic' }, 'car')
      expect(result).toEqual({ isOvernightTransit: true, isOvernightResolved: true })
    })

    it('respects explicit "no" override regardless of duration', () => {
      const result = resolveOvernightTransit('no', { min: 24, max: 28, method: 'speed_envelope_heuristic' }, 'train')
      expect(result).toEqual({ isOvernightTransit: false, isOvernightResolved: true })
    })

    it('resolves auto to true for long ground transit (min >= 8h)', () => {
      const result = resolveOvernightTransit('auto', { min: 9, max: 12, method: 'speed_envelope_heuristic' }, 'train')
      expect(result).toEqual({ isOvernightTransit: true, isOvernightResolved: true })
    })

    it('resolves auto to false for short ground transit (< 8h)', () => {
      const result = resolveOvernightTransit('auto', { min: 3, max: 5, method: 'speed_envelope_heuristic' }, 'train')
      expect(result).toEqual({ isOvernightTransit: false, isOvernightResolved: true })
    })

    it('marks auto as unresolved when duration is missing', () => {
      const result = resolveOvernightTransit('auto', undefined, 'train')
      expect(result).toEqual({ isOvernightTransit: false, isOvernightResolved: false })
    })

    it('resolves auto on flight to false (flights not assumed overnight by default)', () => {
      const result = resolveOvernightTransit('auto', { min: 8, max: 10, method: 'speed_envelope_heuristic' }, 'flight')
      expect(result).toEqual({ isOvernightTransit: false, isOvernightResolved: true })
    })
  })

  describe('TransportMode[] Adaptation (Guardrail 1)', () => {
    it('adapts legacy multi-mode array [flight, car] preserving secondary modes and destination mobility', () => {
      const adapted = adaptTransportModes(['flight', 'car'])
      expect(adapted.primaryTransport).toBe('flight')
      expect(adapted.secondaryTransportModes).toEqual(['car'])
      expect(adapted.destinationMobility.isDrivingAtDestination).toBe(true)
      expect(adapted.destinationMobility.isPublicTransitFocused).toBe(false)
    })

    it('adapts single train mode correctly', () => {
      const adapted = adaptTransportModes(['train'])
      expect(adapted.primaryTransport).toBe('train')
      expect(adapted.secondaryTransportModes).toEqual([])
      expect(adapted.destinationMobility.isDrivingAtDestination).toBe(false)
      expect(adapted.destinationMobility.isPublicTransitFocused).toBe(false)
    })

    it('adapts empty transport modes array to flight fallback', () => {
      const adapted = adaptTransportModes([])
      expect(adapted.primaryTransport).toBe('flight')
      expect(adapted.secondaryTransportModes).toEqual([])
    })
  })
})
