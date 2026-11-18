/**
 * PackPilot — Pure Checklist Reconciliation & Diffing Engine
 * Non-destructively merges existing user checklist items with new recommendations:
 * - Preserves user-adjusted quantities and custom user items
 * - Preserves packed quantities with safe clamping when required quantity decreases
 * - Suppresses dismissed items permanently using snapshot records
 * - Retains removed-activity items in an advisory state rather than silently deleting them
 * - Provides lossless restoration of dismissed items
 */

import type { PackingItem, DismissedItemRecord } from '../types'
import { comparePriority } from './deduplication'

/**
 * Result of checklist reconciliation, providing updated items and diff statistics.
 */
export interface MergeChecklistsResult {
  items: PackingItem[]
  addedCount: number
  updatedCount: number
  orphanedCount: number
  preservedCustomCount: number
  suppressedDismissedCount: number
}

/**
 * Reconciles an existing checklist with a newly computed set of items for a trip.
 * Guarantees idempotency: running repeatedly with identical inputs produces identical results.
 */
export function mergeChecklists(
  existingItems: PackingItem[] = [],
  incomingItems: PackingItem[] = [],
  dismissedRecords: DismissedItemRecord[] = []
): PackingItem[] {
  const dismissedSlugs = new Set(dismissedRecords.map((r) => r.itemSlug))
  const existingMap = new Map<string, PackingItem>()
  for (const item of existingItems) {
    existingMap.set(item.itemSlug, item)
  }

  const result: PackingItem[] = []
  const processedSlugs = new Set<string>()

  // 1. Process all incoming recommended items
  for (const incoming of incomingItems) {
    const slug = incoming.itemSlug
    processedSlugs.add(slug)

    // Suppress dismissed items: never resurrect items the user intentionally removed
    if (dismissedSlugs.has(slug)) {
      continue
    }

    const existing = existingMap.get(slug)

    if (existing) {
      // Reconcile existing item with incoming updates
      const userAdjusted = existing.userAdjustedQuantity
      const newGenerated = incoming.generatedQuantity

      // effectiveQuantity: user override takes precedence over engine calculation
      const effectiveQuantity = userAdjusted !== undefined ? userAdjusted : newGenerated

      // packedQuantity clamping: preserve already packed items, but clamp if required quantity dropped
      const rawPacked = Math.max(0, existing.packedQuantity || 0)
      const packedQuantity = Math.min(rawPacked, effectiveQuantity)
      const isPacked = effectiveQuantity > 0 && packedQuantity >= effectiveQuantity

      // Union recommendation reasons
      const mergedReasons = Array.from(
        new Set([...(existing.reasons || []), ...(incoming.reasons || [])])
      )

      // Priority promotion: never downgrade an existing priority
      const promotedPriority = comparePriority(existing.priority, incoming.priority)

      result.push({
        ...existing,
        name: existing.name || incoming.name,
        category: existing.category,
        priority: promotedPriority,
        quantityStrategy: incoming.quantityStrategy,
        quantityParams: incoming.quantityParams,
        generatedQuantity: newGenerated,
        userAdjustedQuantity: userAdjusted,
        effectiveQuantity,
        packedQuantity,
        isPacked,
        weightGrams: existing.weightGrams ?? incoming.weightGrams,
        isShared: existing.isShared || incoming.isShared,
        reasons: mergedReasons,
        notes: existing.notes,
        isCustom: false,
        isOrphaned: false,
        advisory: undefined,
        updatedAt: existing.updatedAt,
      })
    } else {
      // New recommendation not previously in the checklist
      result.push({
        ...incoming,
        packedQuantity: 0,
        isPacked: false,
        isOrphaned: false,
        advisory: undefined,
      })
    }
  }

  // 2. Process existing items that were NOT part of incoming recommendations
  for (const existing of existingItems) {
    if (processedSlugs.has(existing.itemSlug)) {
      continue
    }

    if (existing.isCustom) {
      // Custom user items: 100% preserved untouched
      result.push({ ...existing })
    } else {
      // Item from a removed activity/mode:
      // Do not silently delete! Retain item with an advisory state for user review.
      result.push({
        ...existing,
        isOrphaned: true,
        advisory:
          'Activity or transport condition is no longer active in trip parameters. Retained for your review.',
      })
    }
  }

  return result
}

/**
 * Dismisses an active item from the checklist and records a complete snapshot.
 */
export function dismissItem(
  checklist: PackingItem[] = [],
  itemSlugToDismiss: string
): { updatedChecklist: PackingItem[]; dismissedRecord: DismissedItemRecord | null } {
  const targetItem = checklist.find((item) => item.itemSlug === itemSlugToDismiss)

  if (!targetItem) {
    return { updatedChecklist: [...checklist], dismissedRecord: null }
  }

  const dismissedRecord: DismissedItemRecord = {
    itemSlug: targetItem.itemSlug,
    name: targetItem.name,
    category: targetItem.category,
    priority: targetItem.priority,
    reasons: [...targetItem.reasons],
    dismissedAt: new Date().toISOString(),
    originalItemSnapshot: { ...targetItem },
  }

  const updatedChecklist = checklist.filter((item) => item.itemSlug !== itemSlugToDismiss)

  return { updatedChecklist, dismissedRecord }
}

/**
 * Restores a previously dismissed item from its original snapshot.
 */
export function restoreDismissedItem(
  checklist: PackingItem[] = [],
  dismissedRecords: DismissedItemRecord[] = [],
  itemSlugToRestore: string
): { updatedChecklist: PackingItem[]; remainingDismissed: DismissedItemRecord[] } {
  const record = dismissedRecords.find((r) => r.itemSlug === itemSlugToRestore)

  if (!record) {
    return { updatedChecklist: [...checklist], remainingDismissed: [...dismissedRecords] }
  }

  // If already present, don't duplicate
  const alreadyExists = checklist.some((i) => i.itemSlug === itemSlugToRestore)
  const updatedChecklist = alreadyExists
    ? [...checklist]
    : [...checklist, { ...record.originalItemSnapshot }]

  const remainingDismissed = dismissedRecords.filter((r) => r.itemSlug !== itemSlugToRestore)

  return { updatedChecklist, remainingDismissed }
}
