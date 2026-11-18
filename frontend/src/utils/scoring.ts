/**
 * PackPilot — Pure Readiness Scoring Utilities
 * Implements the 3/2/1 weighted readiness score with partial packing support
 * and critical item safety guardrails.
 */

import type { PackingItem, ItemPriority, ReadinessScore, DismissedItemRecord } from '../types'

export const PRIORITY_WEIGHTS: Record<ItemPriority, number> = {
  critical: 3,
  recommended: 2,
  optional: 1,
}

/**
 * Calculates the weighted packing readiness score for a trip.
 *
 * Weight allocation:
 * - Critical items: 3 points
 * - Recommended items: 2 points
 * - Optional items: 1 point
 *
 * Rules:
 * 1. Partial packing contributes proportionally: (packedQuantity / effectiveQuantity) * weight.
 * 2. An empty checklist yields 0% readiness.
 * 3. Dismissed optional items do not penalize the score (they are absent from active items).
 * 4. Dismissed critical items trigger an outstanding critical alert and prevent the isFullyReady flag.
 */
export function calculateReadinessScore(
  items: PackingItem[] = [],
  dismissedItems: DismissedItemRecord[] = []
): ReadinessScore {
  const dismissedCriticalCount = dismissedItems.filter((d) => d.priority === 'critical').length

  if (!items || items.length === 0) {
    return {
      percentage: 0,
      packedPoints: 0,
      totalPossiblePoints: 0,
      unpackedCriticalCount: 0,
      dismissedCriticalCount,
      hasOutstandingCritical: dismissedCriticalCount > 0,
      isFullyReady: false,
    }
  }

  let packedPointsSum = 0
  let totalPossiblePointsSum = 0
  let unpackedCriticalCount = 0

  for (const item of items) {
    const weight = PRIORITY_WEIGHTS[item.priority] || PRIORITY_WEIGHTS.optional
    const effectiveQty = Math.max(0, item.effectiveQuantity)
    const packedQty = Math.max(0, item.packedQuantity)

    // Only consider items with positive effective quantity
    if (effectiveQty > 0) {
      totalPossiblePointsSum += weight

      const packingRatio = Math.min(1, packedQty / effectiveQty)
      packedPointsSum += packingRatio * weight

      if (item.priority === 'critical' && packedQty < effectiveQty) {
        unpackedCriticalCount += 1
      }
    }
  }

  const percentage =
    totalPossiblePointsSum > 0
      ? Math.round((packedPointsSum / totalPossiblePointsSum) * 100)
      : 0

  const hasOutstandingCritical = unpackedCriticalCount > 0 || dismissedCriticalCount > 0
  const isFullyReady = percentage === 100 && !hasOutstandingCritical && items.length > 0

  return {
    percentage,
    packedPoints: Math.round(packedPointsSum * 10) / 10,
    totalPossiblePoints: totalPossiblePointsSum,
    unpackedCriticalCount,
    dismissedCriticalCount,
    hasOutstandingCritical,
    isFullyReady,
  }
}
