/**
 * PackPilot — Pure Luggage Weight Calculation Utilities
 * Computes runtime-derived weights and evaluates dual-baggage limits (cabin and checked).
 * Strictly avoids persisting derived weights.
 */

import type { PackingItem, BaggageConfig, WeightEstimate } from '../types'
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
 * and evaluates against active cabin and checked baggage thresholds.
 */
export function calculateLuggageWeight(
  items: PackingItem[] = [],
  baggageConfig: Partial<BaggageConfig> = {}
): WeightEstimate {
  const config: BaggageConfig = {
    ...DEFAULT_BAGGAGE_CONFIG,
    ...baggageConfig,
  }

  let totalGrams = 0
  let knownCount = 0
  let unknownCount = 0

  for (const item of items) {
    // If effectiveQuantity is 0, skip
    if (item.effectiveQuantity <= 0) {
      continue
    }

    const itemTotalWeight = deriveItemTotalWeightGrams(item)
    if (itemTotalWeight !== undefined) {
      totalGrams += itemTotalWeight
      knownCount += 1
    } else {
      unknownCount += 1
    }
  }

  const totalKnownWeightKg = Math.round((totalGrams / 1000) * 10) / 10
  const totalKnownWeightLbs = Math.round((totalKnownWeightKg * LBS_PER_KG) * 10) / 10

  const isCabinConfigured = Boolean(config.hasCabinBaggage)
  const isCheckedConfigured = Boolean(config.hasCheckedBaggage)

  const cabinLimitKg = Math.max(0, config.cabinWeightLimitKg || 7.0)
  const checkedLimitKg = Math.max(0, config.checkedWeightLimitKg || 23.0)
  const combinedLimitKg = (isCabinConfigured ? cabinLimitKg : 0) + (isCheckedConfigured ? checkedLimitKg : 0)

  const isExceedingCabinLimit = isCabinConfigured && totalKnownWeightKg > cabinLimitKg
  const isExceedingCheckedLimit = isCheckedConfigured && totalKnownWeightKg > checkedLimitKg
  const isExceedingCombinedLimit = combinedLimitKg > 0 && totalKnownWeightKg > combinedLimitKg

  return {
    totalKnownWeightGrams: totalGrams,
    totalKnownWeightKg,
    totalKnownWeightLbs,
    itemsWithKnownWeightCount: knownCount,
    itemsWithUnknownWeightCount: unknownCount,
    hasUnknownWeights: unknownCount > 0,
    cabinLimitKg,
    checkedLimitKg,
    isCabinConfigured,
    isCheckedConfigured,
    isExceedingCabinLimit,
    isExceedingCheckedLimit,
    isExceedingCombinedLimit,
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
