/**
 * PackPilot — Pure Template Application & Reconciliation Helper
 * Milestone 9B: Reconciles a reusable PackingTemplate with an existing trip checklist.
 *
 * Core Principles & Reconciliation Invariants:
 * 1. Pure Functional Transformation:
 *    - Pure, deterministic calculation.
 *    - Performs zero side effects (no database, storage, network, or Zustand mutations).
 * 2. Non-Destructive to Existing Items:
 *    - Existing checklist items that are not part of the template remain 100% intact.
 *    - Existing items are never deleted, orphaned, or un-packed by applying a template.
 * 3. User Override Sovereignty:
 *    - If an item was manually adjusted by the user (userAdjustedQuantity !== undefined),
 *      the user's explicit override is strictly preserved.
 *    - For automatically calculated items (userAdjustedQuantity === undefined),
 *      quantity is reconciled to Math.max(existing.generatedQuantity, templateItem.defaultQuantity)
 *      so that template baselines raise required quantities (e.g. extra towels for a beach trip)
 *      without truncating longer duration calculations (e.g. 7 shirts for a 7-day trip).
 * 4. Priority Promotion Hierarchy:
 *    - Item priority is never downgraded.
 *    - Evaluated as critical (3) > recommended (2) > optional (1).
 * 5. Packing State Integrity:
 *    - Neither isPacked nor packedQuantity is ever reset to zero.
 *    - If effectiveQuantity increases beyond packedQuantity, packedQuantity is preserved intact
 *      while isPacked accurately reflects whether the new total requirement is satisfied.
 * 6. Dismissal Suppression:
 *    - Items previously dismissed by the user for this trip remain permanently suppressed
 *      and are never resurrected silently by applying a template.
 * 7. Custom Item Preservation & Uniqueness:
 *    - Template items representing custom user items (slugs starting with 'custom-')
 *      are safely re-instantiated with brand-new unique item IDs and isCustom: true.
 * 8. User Customization Preservation:
 *    - Existing item names, categories, notes, and bag assignments are preserved as-is.
 * 9. Idempotency:
 *    - Applying the exact same template repeatedly produces identical results without duplicates.
 */

import type {
  PackingTemplate,
  TemplateItemConfig,
  PackingItem,
  DismissedItemRecord,
} from '../types'
import { comparePriority } from './deduplication'
import { generateUUID } from '../utils/uuid'

export interface ApplyTemplateOptions {
  /**
   * Target trip ID for newly instantiated checklist items.
   */
  tripId: string
  /**
   * Existing checklist items for the trip.
   */
  existingItems?: PackingItem[]
  /**
   * Dismissed item records for the trip (to suppress resurrection).
   */
  dismissedRecords?: DismissedItemRecord[]
  /**
   * Optional timestamp override for deterministic testing and snapshots.
   */
  now?: string
}

export interface ApplyTemplateResult {
  /**
   * The reconciled checklist items.
   */
  items: PackingItem[]
  /**
   * Number of brand-new items added from the template.
   */
  addedCount: number
  /**
   * Number of existing items updated or merged with template attributes.
   */
  mergedCount: number
  /**
   * Number of template items skipped because they were previously dismissed.
   */
  skippedDismissedCount: number
}

/**
 * Reconciles a PackingTemplate into a trip checklist non-destructively.
 */
export function applyTemplateToChecklist(
  template: PackingTemplate,
  tripIdOrOptions: string | ApplyTemplateOptions,
  existingItemsArg?: PackingItem[],
  dismissedRecordsArg?: DismissedItemRecord[]
): ApplyTemplateResult {
  // Normalize polymorphic input arguments
  let tripId: string
  let existingItems: PackingItem[] = []
  let dismissedRecords: DismissedItemRecord[] = []
  let now = new Date().toISOString()

  if (typeof tripIdOrOptions === 'object') {
    tripId = tripIdOrOptions.tripId
    existingItems = tripIdOrOptions.existingItems || []
    dismissedRecords = tripIdOrOptions.dismissedRecords || []
    now = tripIdOrOptions.now || now
  } else {
    tripId = tripIdOrOptions
    existingItems = existingItemsArg || []
    dismissedRecords = dismissedRecordsArg || []
  }

  // Handle empty or invalid template gracefully
  if (!template || !Array.isArray(template.items) || template.items.length === 0) {
    return {
      items: [...existingItems],
      addedCount: 0,
      mergedCount: 0,
      skippedDismissedCount: 0,
    }
  }

  const dismissedSlugs = new Set(dismissedRecords.map((r) => r.itemSlug))

  // 1. Defensively deduplicate items inside the template itself if duplicates share a slug
  const templateItemMap = new Map<string, TemplateItemConfig>()
  for (const item of template.items) {
    if (!item || !item.itemSlug) continue

    const existingInTemplate = templateItemMap.get(item.itemSlug)
    if (existingInTemplate) {
      // Merge multiple entries of the same item within the template:
      // Promote priority, take maximum default quantity, union reasons
      templateItemMap.set(item.itemSlug, {
        ...existingInTemplate,
        priority: comparePriority(existingInTemplate.priority, item.priority),
        defaultQuantity: Math.max(
          existingInTemplate.defaultQuantity || 1,
          item.defaultQuantity || 1
        ),
        weightGrams: existingInTemplate.weightGrams ?? item.weightGrams,
        isShared: existingInTemplate.isShared || item.isShared,
        reasons: Array.from(new Set([...(existingInTemplate.reasons || []), ...(item.reasons || [])])),
      })
    } else {
      templateItemMap.set(item.itemSlug, item)
    }
  }

  // 2. Build index of existing items by canonical itemSlug
  const existingMap = new Map<string, PackingItem>()
  for (const item of existingItems) {
    existingMap.set(item.itemSlug, item)
  }

  const resultItems: PackingItem[] = []
  const processedTemplateSlugs = new Set<string>()
  let addedCount = 0
  let mergedCount = 0
  let skippedDismissedCount = 0

  const templateReason = `Template: ${template.name}`

  // 3. Process existing items (maintaining their existing visual display order)
  for (const existing of existingItems) {
    const templateItem = templateItemMap.get(existing.itemSlug)

    if (!templateItem) {
      // Item is not mentioned in the template: preserve 100% untouched
      resultItems.push(existing)
      continue
    }

    // Mark as processed so we don't duplicate when iterating new template items
    processedTemplateSlugs.add(existing.itemSlug)
    mergedCount++

    // Quantity Reconciliation Policy:
    // - If the user explicitly adjusted the quantity, preserve their manual override.
    // - If automatically calculated, take max(existing.generatedQuantity, templateItem.defaultQuantity)
    //   so template requirements raise minimum gear floors without truncating long-trip calculations.
    const isUserAdjusted = existing.userAdjustedQuantity !== undefined
    const templateDefaultQty = Math.max(1, Math.round(templateItem.defaultQuantity || 1))

    let effectiveQuantity: number
    let generatedQuantity: number

    if (isUserAdjusted) {
      effectiveQuantity = existing.userAdjustedQuantity!
      generatedQuantity = Math.max(existing.generatedQuantity, templateDefaultQty)
    } else {
      generatedQuantity = Math.max(existing.generatedQuantity, templateDefaultQty)
      effectiveQuantity = generatedQuantity
    }

    // Packed State Integrity:
    // - Clamp packedQuantity to the valid range between 0 and effectiveQuantity.
    // - If effectiveQuantity increased beyond packedQuantity, packedQuantity stays intact
    //   while isPacked updates to reflect whether the new requirement is fully satisfied.
    const rawPacked = Math.max(0, existing.packedQuantity || 0)
    const packedQuantity = Math.min(rawPacked, effectiveQuantity)
    const isPacked = effectiveQuantity > 0 && packedQuantity >= effectiveQuantity

    // Priority Promotion: Never downgrade priority (critical > recommended > optional)
    const promotedPriority = comparePriority(existing.priority, templateItem.priority)

    // Weight Reconciliation: Preserve existing known weight; adopt template weight if currently unknown
    const weightGrams = existing.weightGrams ?? templateItem.weightGrams

    // Shared Attribution: If either marks item as shared, it is considered shared
    const isShared = existing.isShared || Boolean(templateItem.isShared)

    // Reasons Union: Union existing reasons with template reference
    const mergedReasons = Array.from(new Set([...(existing.reasons || []), templateReason]))

    resultItems.push({
      ...existing,
      // Name & Category Preservation: Preserve existing user customizations
      name: existing.name || templateItem.name,
      category: existing.category || templateItem.category,
      priority: promotedPriority,
      generatedQuantity,
      userAdjustedQuantity: existing.userAdjustedQuantity,
      effectiveQuantity,
      packedQuantity,
      isPacked,
      weightGrams,
      isShared,
      reasons: mergedReasons,
      // User-specific notes and bag assignments remain untouched
      notes: existing.notes,
      bagAssignment: existing.bagAssignment,
      isCustom: existing.isCustom,
      // Clear stale orphan status and obsolete advisory now that template supplies/reaffirms the item
      isOrphaned: false,
      advisory: undefined,
      updatedAt: now,
    })
  }

  // 4. Process new template items that were not present in existing checklist
  for (const templateItem of templateItemMap.values()) {
    if (processedTemplateSlugs.has(templateItem.itemSlug)) {
      continue
    }

    // Dismissal Suppression: Respect user's prior dismissal of this item for this trip
    if (dismissedSlugs.has(templateItem.itemSlug)) {
      skippedDismissedCount++
      continue
    }

    addedCount++

    // Determine custom item status: items with 'custom-' slug are treated as user-defined custom items
    const isCustom = Boolean(templateItem.itemSlug.startsWith('custom-'))

    const itemDefaultQty = Math.max(1, Math.round(templateItem.defaultQuantity || 1))

    const reasons =
      templateItem.reasons && templateItem.reasons.length > 0
        ? Array.from(new Set([...templateItem.reasons, templateReason]))
        : [templateReason]

    const newItem: PackingItem = {
      id: generateUUID(),
      tripId,
      name: templateItem.name,
      itemSlug: templateItem.itemSlug,
      category: templateItem.category,
      priority: templateItem.priority,
      quantityStrategy: templateItem.quantityStrategy || 'fixed',
      quantityParams: templateItem.quantityParams,
      generatedQuantity: itemDefaultQty,
      userAdjustedQuantity: undefined,
      effectiveQuantity: itemDefaultQty,
      packedQuantity: 0,
      isPacked: false,
      weightGrams: templateItem.weightGrams,
      isShared: Boolean(templateItem.isShared),
      isCustom,
      reasons,
      createdAt: now,
      updatedAt: now,
      isOrphaned: false,
      advisory: undefined,
    }

    resultItems.push(newItem)
  }

  return {
    items: resultItems,
    addedCount,
    mergedCount,
    skippedDismissedCount,
  }
}
