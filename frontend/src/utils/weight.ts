/**
 * PackPilot — Pure Luggage Weight Calculation Utilities
 * Computes runtime-derived weights and evaluates dual-baggage limits (cabin and checked).
 * Strictly avoids persisting derived weights.
 */

import type {
  PackingItem,
  BaggageConfig,
  WeightEstimate,
  BagWeightSummary,
  UnassignedWeightSummary,
  CombinedWeightSummary,
} from '../types'
import { DEFAULT_BAGGAGE_CONFIG } from '../types'

const LBS_PER_KG = 2.20462

/**
 * Derives the total weight in grams for a single item at runtime.
 * Returns undefined if the item's unit weight is unknown.
 */
export function deriveItemTotalWeightGrams(item: PackingItem): number | undefined {
  if (item.weightGrams === undefined || item.weightGrams === null || Number.isNaN(item.weightGrams)) {
    return undefined
  }
  const qty = Math.max(0, item.effectiveQuantity)
  return Math.max(0, item.weightGrams) * qty
}

/**
 * Aggregates runtime luggage weights across all active checklist items
 * partitioned into cabin, checked, and unassigned groups.
 * Evaluates cabin and checked baggage limits independently.
 * Strictly avoids evaluating combined baggage limits or inventing fallback weights.
 */
export function calculateLuggageWeight(
  items: PackingItem[] = [],
  baggageConfig: Partial<BaggageConfig> = {}
): WeightEstimate {
  const config: BaggageConfig = {
    ...DEFAULT_BAGGAGE_CONFIG,
    ...baggageConfig,
  }

  const isCabinConfigured = Boolean(config.hasCabinBaggage)
  const isCheckedConfigured = Boolean(config.hasCheckedBaggage)

  const cabinLimitKg = Math.max(
    0,
    typeof config.cabinWeightLimitKg === 'number' && Number.isFinite(config.cabinWeightLimitKg)
      ? config.cabinWeightLimitKg
      : 7.0
  )
  const checkedLimitKg = Math.max(
    0,
    typeof config.checkedWeightLimitKg === 'number' && Number.isFinite(config.checkedWeightLimitKg)
      ? config.checkedWeightLimitKg
      : 23.0
  )

  let cabinGrams = 0
  let cabinKnownCount = 0
  let cabinUnknownCount = 0

  let checkedGrams = 0
  let checkedKnownCount = 0
  let checkedUnknownCount = 0

  let unassignedGrams = 0
  let unassignedKnownCount = 0
  let unassignedUnknownCount = 0

  for (const item of items) {
    // If effectiveQuantity is 0 or item invalid, skip
    if (!item || item.effectiveQuantity <= 0) {
      continue
    }

    const itemTotalWeight = deriveItemTotalWeightGrams(item)
    const isKnown = itemTotalWeight !== undefined

    if (item.bagAssignment === 'cabin') {
      if (isKnown) {
        cabinGrams += itemTotalWeight
        cabinKnownCount += 1
      } else {
        cabinUnknownCount += 1
      }
    } else if (item.bagAssignment === 'checked') {
      if (isKnown) {
        checkedGrams += itemTotalWeight
        checkedKnownCount += 1
      } else {
        checkedUnknownCount += 1
      }
    } else {
      if (isKnown) {
        unassignedGrams += itemTotalWeight
        unassignedKnownCount += 1
      } else {
        unassignedUnknownCount += 1
      }
    }
  }

  // Cabin calculations
  const cabinKnownKg = Math.round((cabinGrams / 1000) * 10) / 10
  const cabinKnownLbs = Math.round((cabinKnownKg * LBS_PER_KG) * 10) / 10
  const cabinRemainingKg = isCabinConfigured
    ? Math.max(0, Math.round((cabinLimitKg - cabinKnownKg) * 10) / 10)
    : 0
  const cabinExceededAmountKg =
    isCabinConfigured && cabinKnownKg > cabinLimitKg
      ? Math.round((cabinKnownKg - cabinLimitKg) * 10) / 10
      : 0
  const cabinPercentageUsed =
    isCabinConfigured && cabinLimitKg > 0 ? Math.round((cabinKnownKg / cabinLimitKg) * 100) : 0
  const isExceedingCabinLimit =
    isCabinConfigured && (cabinLimitKg > 0 ? cabinKnownKg > cabinLimitKg : cabinKnownKg > 0)

  const cabinSummary: BagWeightSummary = {
    bagType: 'cabin',
    isConfigured: isCabinConfigured,
    limitKg: cabinLimitKg,
    knownWeightGrams: cabinGrams,
    knownWeightKg: cabinKnownKg,
    knownWeightLbs: cabinKnownLbs,
    remainingCapacityKg: cabinRemainingKg,
    exceededAmountKg: cabinExceededAmountKg,
    percentageUsed: cabinPercentageUsed,
    itemsWithKnownWeightCount: cabinKnownCount,
    itemsWithUnknownWeightCount: cabinUnknownCount,
    hasUnknownWeights: cabinUnknownCount > 0,
    isLimitExceeded: isExceedingCabinLimit,
  }

  // Checked calculations
  const checkedKnownKg = Math.round((checkedGrams / 1000) * 10) / 10
  const checkedKnownLbs = Math.round((checkedKnownKg * LBS_PER_KG) * 10) / 10
  const checkedRemainingKg = isCheckedConfigured
    ? Math.max(0, Math.round((checkedLimitKg - checkedKnownKg) * 10) / 10)
    : 0
  const checkedExceededAmountKg =
    isCheckedConfigured && checkedKnownKg > checkedLimitKg
      ? Math.round((checkedKnownKg - checkedLimitKg) * 10) / 10
      : 0
  const checkedPercentageUsed =
    isCheckedConfigured && checkedLimitKg > 0 ? Math.round((checkedKnownKg / checkedLimitKg) * 100) : 0
  const isExceedingCheckedLimit =
    isCheckedConfigured && (checkedLimitKg > 0 ? checkedKnownKg > checkedLimitKg : checkedKnownKg > 0)

  const checkedSummary: BagWeightSummary = {
    bagType: 'checked',
    isConfigured: isCheckedConfigured,
    limitKg: checkedLimitKg,
    knownWeightGrams: checkedGrams,
    knownWeightKg: checkedKnownKg,
    knownWeightLbs: checkedKnownLbs,
    remainingCapacityKg: checkedRemainingKg,
    exceededAmountKg: checkedExceededAmountKg,
    percentageUsed: checkedPercentageUsed,
    itemsWithKnownWeightCount: checkedKnownCount,
    itemsWithUnknownWeightCount: checkedUnknownCount,
    hasUnknownWeights: checkedUnknownCount > 0,
    isLimitExceeded: isExceedingCheckedLimit,
  }

  // Unassigned calculations
  const unassignedKnownKg = Math.round((unassignedGrams / 1000) * 10) / 10
  const unassignedKnownLbs = Math.round((unassignedKnownKg * LBS_PER_KG) * 10) / 10
  const unassignedSummary: UnassignedWeightSummary = {
    knownWeightGrams: unassignedGrams,
    knownWeightKg: unassignedKnownKg,
    knownWeightLbs: unassignedKnownLbs,
    itemsWithKnownWeightCount: unassignedKnownCount,
    itemsWithUnknownWeightCount: unassignedUnknownCount,
    totalItemCount: unassignedKnownCount + unassignedUnknownCount,
    hasUnknownWeights: unassignedUnknownCount > 0,
  }

  // Combined informational summary (strictly informational; never compared to a combined limit)
  const totalGrams = cabinGrams + checkedGrams + unassignedGrams
  const totalKnownKg = Math.round((totalGrams / 1000) * 10) / 10
  const totalKnownLbs = Math.round((totalKnownKg * LBS_PER_KG) * 10) / 10
  const totalKnownCount = cabinKnownCount + checkedKnownCount + unassignedKnownCount
  const totalUnknownCount = cabinUnknownCount + checkedUnknownCount + unassignedUnknownCount

  const combinedSummary: CombinedWeightSummary = {
    totalKnownWeightGrams: totalGrams,
    totalKnownWeightKg: totalKnownKg,
    totalKnownWeightLbs: totalKnownLbs,
    totalItemsWithKnownWeightCount: totalKnownCount,
    totalItemsWithUnknownWeightCount: totalUnknownCount,
    hasUnknownWeights: totalUnknownCount > 0,
  }

  return {
    cabin: cabinSummary,
    checked: checkedSummary,
    unassigned: unassignedSummary,
    combined: combinedSummary,

    // Backward-compatible accessors
    totalKnownWeightGrams: totalGrams,
    totalKnownWeightKg: totalKnownKg,
    totalKnownWeightLbs: totalKnownLbs,
    itemsWithKnownWeightCount: totalKnownCount,
    itemsWithUnknownWeightCount: totalUnknownCount,
    hasUnknownWeights: totalUnknownCount > 0,
    cabinLimitKg,
    checkedLimitKg,
    isCabinConfigured,
    isCheckedConfigured,
    isExceedingCabinLimit,
    isExceedingCheckedLimit,
  }
}

/**
 * Formats a weight in grams into a clean human-readable string (e.g. "450 g" or "3.5 kg" or "7.7 lbs").
 */
export function formatWeightDisplay(
  grams: number | undefined,
  unit: 'kg' | 'lbs' = 'kg'
): string {
  if (grams === undefined || grams === null || Number.isNaN(grams)) {
    return 'Unknown'
  }

  if (unit === 'lbs') {
    const lbs = (grams / 1000) * LBS_PER_KG
    return `${(Math.round(lbs * 10) / 10).toFixed(1)} lbs`
  }

  if (grams < 1000) {
    return `${Math.round(grams)} g`
  }

  const kg = grams / 1000
  return `${(Math.round(kg * 10) / 10).toFixed(1)} kg`
}
