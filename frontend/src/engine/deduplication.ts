/**
 * PackPilot — Pure Candidate Deduplication Engine
 * Merges recommendation candidates sharing canonical item slugs:
 * - Promotes priority (critical > recommended > optional)
 * - Unions and deduplicates recommendation reasons
 * - Resolves strategy & parameter conflicts deterministically
 * - Retains metadata (weight, target age group, shared indicator)
 */

import type {
  RecommendationCandidate,
  ItemPriority,
  QuantityStrategy,
  QuantityStrategyParams,
} from '../types'

/**
 * Priority rank hierarchy for promotion: critical (3) > recommended (2) > optional (1)
 */
export const PRIORITY_RANK: Record<ItemPriority, number> = {
  critical: 3,
  recommended: 2,
  optional: 1,
}

/**
 * Strategy specificity hierarchy used as tie-breaker when candidates have equal priority
 */
const STRATEGY_RANK: Record<QuantityStrategy, number> = {
  per_person_per_day: 6,
  per_day: 5,
  shared_capacity: 4,
  per_person: 3,
  fixed: 2,
  user_defined: 1,
}

export function comparePriority(a: ItemPriority, b: ItemPriority): ItemPriority {
  return PRIORITY_RANK[a] >= PRIORITY_RANK[b] ? a : b
}

/**
 * Conservatively merges parameters for two candidates sharing the same strategy.
 */
function mergeStrategyParams(
  p1: QuantityStrategyParams = {},
  p2: QuantityStrategyParams = {}
): QuantityStrategyParams {
  const merged: QuantityStrategyParams = {}

  // minQuantity: take the higher floor
  if (p1.minQuantity !== undefined || p2.minQuantity !== undefined) {
    merged.minQuantity = Math.max(p1.minQuantity ?? 0, p2.minQuantity ?? 0)
  }

  // maxQuantity: take the higher ceiling to avoid artificial capping
  if (p1.maxQuantity !== undefined || p2.maxQuantity !== undefined) {
    merged.maxQuantity = Math.max(p1.maxQuantity ?? 0, p2.maxQuantity ?? 0)
  }

  // unitsPerPerson: take the higher multiplier
  if (p1.unitsPerPerson !== undefined || p2.unitsPerPerson !== undefined) {
    merged.unitsPerPerson = Math.max(p1.unitsPerPerson ?? 1, p2.unitsPerPerson ?? 1)
  }

  // baseUnitsPerDay: take the higher daily consumption rate
  if (p1.baseUnitsPerDay !== undefined || p2.baseUnitsPerDay !== undefined) {
    merged.baseUnitsPerDay = Math.max(p1.baseUnitsPerDay ?? 1, p2.baseUnitsPerDay ?? 1)
  }

  // bufferUnits: take the higher buffer
  if (p1.bufferUnits !== undefined || p2.bufferUnits !== undefined) {
    merged.bufferUnits = Math.max(p1.bufferUnits ?? 0, p2.bufferUnits ?? 0)
  }

  // capacityPerUnit: take the more conservative (lower capacity = more units packed)
  if (p1.capacityPerUnit !== undefined || p2.capacityPerUnit !== undefined) {
    const c1 = p1.capacityPerUnit ?? 3
    const c2 = p2.capacityPerUnit ?? 3
    merged.capacityPerUnit = Math.min(c1, c2)
  }

  // laundryRotationDays: take the higher rotation allowance
  if (p1.laundryRotationDays !== undefined || p2.laundryRotationDays !== undefined) {
    merged.laundryRotationDays = Math.max(p1.laundryRotationDays ?? 7, p2.laundryRotationDays ?? 7)
  }

  // noLaundryMaxCap: take the higher cap
  if (p1.noLaundryMaxCap !== undefined || p2.noLaundryMaxCap !== undefined) {
    merged.noLaundryMaxCap = Math.max(p1.noLaundryMaxCap ?? 14, p2.noLaundryMaxCap ?? 14)
  }

  return merged
}

/**
 * Deduplicates an array of recommendation candidates by canonical `itemSlug`.
 * Guarantees 100% deterministic, idempotent outputs.
 */
export function deduplicateCandidates(
  candidates: RecommendationCandidate[] = []
): RecommendationCandidate[] {
  if (!candidates || candidates.length === 0) {
    return []
  }

  const map = new Map<string, RecommendationCandidate>()

  for (const candidate of candidates) {
    const slug = candidate.itemSlug
    if (!slug) continue

    const existing = map.get(slug)
    if (!existing) {
      // First occurrence: clone cleanly
      map.set(slug, {
        ...candidate,
        reasons: Array.from(new Set(candidate.reasons || [])),
        quantityParams: candidate.quantityParams ? { ...candidate.quantityParams } : undefined,
      })
      continue
    }

    // Determine priority promotion
    const existingRank = PRIORITY_RANK[existing.priority] || 1
    const incomingRank = PRIORITY_RANK[candidate.priority] || 1
    const promotedPriority = incomingRank > existingRank ? candidate.priority : existing.priority

    // Determine strategy and parameters
    let winningStrategy: QuantityStrategy
    let winningParams: QuantityStrategyParams | undefined

    if (existing.quantityStrategy === candidate.quantityStrategy) {
      winningStrategy = existing.quantityStrategy
      winningParams = mergeStrategyParams(existing.quantityParams, candidate.quantityParams)
    } else {
      // Strategy conflict resolution:
      // 1. The candidate with higher priority dictates strategy.
      // 2. If priorities are equal, use strategy rank.
      // Preserves the winning strategy's parameters to avoid cross-strategy parameter dimension conflicts.
      if (incomingRank > existingRank) {
        winningStrategy = candidate.quantityStrategy
        winningParams = candidate.quantityParams ? { ...candidate.quantityParams } : undefined
      } else if (existingRank > incomingRank) {
        winningStrategy = existing.quantityStrategy
        winningParams = existing.quantityParams ? { ...existing.quantityParams } : undefined
      } else {
        const existingStratRank = STRATEGY_RANK[existing.quantityStrategy] || 1
        const incomingStratRank = STRATEGY_RANK[candidate.quantityStrategy] || 1
        if (incomingStratRank > existingStratRank) {
          winningStrategy = candidate.quantityStrategy
          winningParams = candidate.quantityParams ? { ...candidate.quantityParams } : undefined
        } else {
          winningStrategy = existing.quantityStrategy
          winningParams = existing.quantityParams ? { ...existing.quantityParams } : undefined
        }
      }

      // Merge compatible minimum floor clamp if present
      const minFloor = Math.max(
        existing.quantityParams?.minQuantity ?? 0,
        candidate.quantityParams?.minQuantity ?? 0
      )
      if (minFloor > 0) {
        winningParams = { ...(winningParams || {}), minQuantity: minFloor }
      }
    }

    // Merge reasons without duplicates, preserving insertion order
    const mergedReasons = Array.from(
      new Set([...(existing.reasons || []), ...(candidate.reasons || [])])
    )

    // Name: prefer higher priority candidate's name or existing
    const preferredName = incomingRank > existingRank ? candidate.name : existing.name

    // isShared: true if either candidate marked it shared
    const isShared = existing.isShared || candidate.isShared

    // weightGrams: prefer existing if defined, otherwise incoming
    const weightGrams = existing.weightGrams ?? candidate.weightGrams

    // targetAgeGroup: prefer specific age group over 'all'
    let targetAgeGroup = existing.targetAgeGroup
    if (!targetAgeGroup || targetAgeGroup === 'all') {
      targetAgeGroup = candidate.targetAgeGroup || 'all'
    }

    map.set(slug, {
      itemSlug: slug,
      name: preferredName,
      category: existing.category, // Canonical category is slug-bound
      priority: promotedPriority,
      quantityStrategy: winningStrategy,
      quantityParams: Object.keys(winningParams || {}).length > 0 ? winningParams : undefined,
      targetAgeGroup,
      weightGrams,
      isShared,
      reasons: mergedReasons,
    })
  }

  // Return deterministically sorted by priority descending (critical -> recommended -> optional),
  // then category, then itemSlug
  return Array.from(map.values()).sort((a, b) => {
    const pDiff = (PRIORITY_RANK[b.priority] || 1) - (PRIORITY_RANK[a.priority] || 1)
    if (pDiff !== 0) return pDiff
    const catDiff = a.category.localeCompare(b.category)
    if (catDiff !== 0) return catDiff
    return a.itemSlug.localeCompare(b.itemSlug)
  })
}
