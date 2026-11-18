/**
 * PackPilot — Pure Quantity Calculation Engine
 * Implements strategy-driven formulas, item-specific laundry rules,
 * age-group eligibility, and parameter clamping.
 */

import type {
  QuantityStrategy,
  QuantityStrategyParams,
  TravellerComposition,
  TargetAgeGroup,
} from '../types'
import { getTotalTravellers } from '../types'

export interface QuantityCalculationContext {
  durationDays: number
  hasLaundry: boolean
  travellers: TravellerComposition
  targetAgeGroup?: TargetAgeGroup
}

/**
 * Resolves the count of eligible travellers for a specific rule based on its target age group.
 */
export function getEligibleTravellerCount(
  travellers: TravellerComposition,
  targetAgeGroup: TargetAgeGroup = 'all'
): number {
  if (!travellers || typeof travellers !== 'object') {
    return 0
  }

  const safeCount = (n: unknown): number => {
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return 0
    return Math.floor(n)
  }

  const adults = safeCount(travellers.adults)
  const children = safeCount(travellers.children)
  const teens = safeCount(travellers.teens)
  const infants = safeCount(travellers.infants)
  const seniors = safeCount(travellers.seniors)

  switch (targetAgeGroup) {
    case 'infants':
      return infants
    case 'children':
      return children
    case 'teens':
      return teens
    case 'adults':
      return adults
    case 'seniors':
      return seniors
    case 'adults_and_teens':
      return adults + teens
    case 'all':
    default:
      return getTotalTravellers(travellers)
  }
}

/**
 * Pure calculator executing the designated quantity strategy.
 */
export function calculateItemQuantity(
  strategy: QuantityStrategy,
  params: QuantityStrategyParams = {},
  context: QuantityCalculationContext
): number {
  // Validate and sanitize duration (defaults to 1 day for 0 or negative/NaN)
  const rawDuration = typeof context.durationDays === 'number' && Number.isFinite(context.durationDays)
    ? context.durationDays
    : 1
  const D = Math.max(1, Math.round(rawDuration))

  const eligibleTravellers = getEligibleTravellerCount(context.travellers, context.targetAgeGroup)

  // Zero-traveller handling:
  // For traveller-dependent strategies, if there are 0 eligible travellers, return 0 immediately.
  // Minimum quantity clamping must never create artificial items when no travellers exist.
  // Fixed and user-defined strategies are preserved regardless of traveller count.
  if (strategy !== 'fixed' && strategy !== 'user_defined' && eligibleTravellers === 0) {
    return 0
  }

  let calculatedQty = 0

  switch (strategy) {
    case 'per_person': {
      const unitsPerPerson = typeof params.unitsPerPerson === 'number' && Number.isFinite(params.unitsPerPerson) && params.unitsPerPerson > 0
        ? Math.floor(params.unitsPerPerson)
        : 1
      calculatedQty = eligibleTravellers * unitsPerPerson
      break
    }

    case 'per_day': {
      const unitsPerDay = typeof params.baseUnitsPerDay === 'number' && Number.isFinite(params.baseUnitsPerDay) && params.baseUnitsPerDay > 0
        ? Math.floor(params.baseUnitsPerDay)
        : 1
      calculatedQty = D * unitsPerDay
      break
    }

    case 'per_person_per_day': {
      const unitsPerDay = typeof params.baseUnitsPerDay === 'number' && Number.isFinite(params.baseUnitsPerDay) && params.baseUnitsPerDay > 0
        ? Math.floor(params.baseUnitsPerDay)
        : 1
      const buffer = typeof params.bufferUnits === 'number' && Number.isFinite(params.bufferUnits) && params.bufferUnits > 0
        ? Math.floor(params.bufferUnits)
        : 0

      // Item-specific laundry cycle rotation
      if (context.hasLaundry) {
        const rotationCap = typeof params.laundryRotationDays === 'number' && Number.isFinite(params.laundryRotationDays) && params.laundryRotationDays > 0
          ? Math.floor(params.laundryRotationDays)
          : 7
        const effectiveDays = Math.min(D, rotationCap)
        const perPerson = Math.max(1, (effectiveDays * unitsPerDay) + buffer)
        calculatedQty = perPerson * eligibleTravellers
      } else {
        // Item-specific no-laundry cap (e.g. 21 days for underwear, 10 for shirts)
        const maxUncapped = typeof params.noLaundryMaxCap === 'number' && Number.isFinite(params.noLaundryMaxCap) && params.noLaundryMaxCap > 0
          ? Math.floor(params.noLaundryMaxCap)
          : 14
        const effectiveDays = Math.min(D, maxUncapped)
        const perPerson = Math.max(1, (effectiveDays * unitsPerDay) + buffer)
        calculatedQty = perPerson * eligibleTravellers
      }
      break
    }

    case 'shared_capacity': {
      // Safe capacity handling (minimum 1 to avoid division by zero)
      const capacity = typeof params.capacityPerUnit === 'number' && Number.isFinite(params.capacityPerUnit)
        ? Math.max(1, Math.floor(params.capacityPerUnit))
        : 3
      const unitsForGroup = Math.ceil(eligibleTravellers / capacity)

      if (typeof params.baseUnitsPerDay === 'number' && Number.isFinite(params.baseUnitsPerDay) && params.baseUnitsPerDay > 0) {
        // Replenishment consumption cycle (e.g. 1 bottle per N days)
        const replenishmentCycleDays = Math.max(1, Math.floor(params.baseUnitsPerDay))
        const cycles = Math.ceil(D / replenishmentCycleDays)
        calculatedQty = unitsForGroup * cycles
      } else {
        // Durable shared gear (e.g. 1 tent per 2 persons, regardless of days)
        calculatedQty = unitsForGroup
      }
      break
    }

    case 'fixed': {
      const minQ = typeof params.minQuantity === 'number' && Number.isFinite(params.minQuantity) && params.minQuantity > 0
        ? Math.floor(params.minQuantity)
        : 1
      calculatedQty = Math.max(1, minQ)
      break
    }

    case 'user_defined': {
      const minQ = typeof params.minQuantity === 'number' && Number.isFinite(params.minQuantity) && params.minQuantity > 0
        ? Math.floor(params.minQuantity)
        : 1
      calculatedQty = Math.max(1, minQ)
      break
    }

    default: {
      calculatedQty = 1
      break
    }
  }

  // Apply optional boundary clamping only to active quantities (>0)
  if (calculatedQty > 0) {
    if (typeof params.minQuantity === 'number' && Number.isFinite(params.minQuantity) && params.minQuantity > 0) {
      calculatedQty = Math.max(Math.floor(params.minQuantity), calculatedQty)
    }
    if (typeof params.maxQuantity === 'number' && Number.isFinite(params.maxQuantity) && params.maxQuantity >= 0) {
      calculatedQty = Math.min(Math.floor(params.maxQuantity), calculatedQty)
    }
  }

  if (!Number.isFinite(calculatedQty) || Number.isNaN(calculatedQty) || calculatedQty < 0) {
    return 0
  }

  return Math.round(calculatedQty)
}
