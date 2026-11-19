/**
 * PackPilot — Main Recommendation Orchestration Pipeline
 * Pure, deterministic travel checklist generator integrating:
 * - 7 Modular Rule Engines (Base, Transport, Climate, Accommodation, Activity, Preference, Composition)
 * - Duration & Laundry Awareness
 * - Pure Candidate Deduplication & Priority Promotion
 * - Pure Strategy-Driven Quantity Calculations
 * - Reference Weight Attribution
 * - Non-Destructive Checklist Reconciliation
 */

import type {
  TripConfig,
  Trip,
  PackingItem,
  DismissedItemRecord,
  RecommendationCandidate,
  NormalizedTripContext,
  JourneyContext,
} from '../types'
import { calculateDurationDays } from '../utils/dates'
import { evaluateBaseRules } from './rules/baseRules'
import { evaluateTransportRules } from './rules/transportRules'
import { evaluateJourneyRules } from './rules/journeyRules'
import { evaluateClimateRules } from './rules/climateRules'
import { evaluateAccommodationRules } from './rules/accommodationRules'
import { evaluateActivityRules } from './rules/activityRules'
import { evaluatePreferenceRules } from './rules/preferenceRules'
import { evaluateCompositionRules } from './rules/compositionRules'
import { deduplicateCandidates } from './deduplication'
import { calculateItemQuantity } from './quantityCalculator'
import { mergeChecklists } from './reconciler'
import { resolveFallbackJourneyContext } from './fallbackContext'

export * from './deduplication'
export * from './reconciler'
export * from './quantityCalculator'
export * from './referenceWeights'
export * from './rules/journeyRules'
export * from './fallbackContext'

export interface RecommendationPipelineOptions {
  existingItems?: PackingItem[]
  dismissedRecords?: DismissedItemRecord[]
  tripId?: string
  now?: string
  normalizedContext?: NormalizedTripContext
}

export interface RecommendationResult {
  items: PackingItem[]
  durationDays: number
  hasLaundry: boolean
  dismissedRecords: DismissedItemRecord[]
  criticalDismissedWarnings: DismissedItemRecord[]
  orphanedItems: PackingItem[]
}

/**
 * Determines whether laundry access is available based on explicit trip configuration or preference.
 * Hotel, rental, and friends/family accommodation do NOT automatically imply laundry access.
 */
export function determineHasLaundry(config: TripConfig): boolean {
  if (config.hasLaundryAccess === true) {
    return true
  }
  if (config.hasLaundryAccess === false) {
    return false
  }
  if (config.personalPreferences && config.personalPreferences.includes('laundry')) {
    return true
  }
  return false
}

/**
 * Main pure orchestration pipeline.
 * Evaluates all modular rules, deduplicates candidates, calculates quantities,
 * and reconciles with existing user checklist state.
 */
export function generateRecommendations(
  tripConfig: TripConfig,
  optionsOrExisting?: PackingItem[] | RecommendationPipelineOptions,
  dismissedRecordsArg?: DismissedItemRecord[],
  tripIdArg = 'trip-default'
): RecommendationResult {
  // Normalize polymorphic arguments
  let existingItems: PackingItem[] = []
  let dismissedRecords: DismissedItemRecord[] = []
  let tripId = tripIdArg
  let now = new Date().toISOString()
  let normalizedContext: NormalizedTripContext | undefined = undefined

  if (Array.isArray(optionsOrExisting)) {
    existingItems = optionsOrExisting
    dismissedRecords = dismissedRecordsArg || []
    tripId = tripIdArg
  } else if (optionsOrExisting && typeof optionsOrExisting === 'object') {
    existingItems = optionsOrExisting.existingItems || []
    dismissedRecords = optionsOrExisting.dismissedRecords || []
    tripId = optionsOrExisting.tripId || tripIdArg
    now = optionsOrExisting.now || now
    normalizedContext = optionsOrExisting.normalizedContext
  }

  // 1. Calculate trip duration in days
  const durationDays = calculateDurationDays(tripConfig.startDate, tripConfig.endDate)

  // 2. Resolve laundry availability
  const hasLaundry = determineHasLaundry(tripConfig)

  // 3. Resolve Journey Context (prefer supplied normalizedContext, then trip.normalizedContext, then pure fallback)
  const journeyContext: JourneyContext =
    normalizedContext?.journey ??
    (tripConfig as Trip).normalizedContext?.journey ??
    resolveFallbackJourneyContext(tripConfig)

  // 4. Execute all modular recommendation rule engines
  const rawCandidates: RecommendationCandidate[] = [
    ...evaluateBaseRules(),
    ...evaluateTransportRules(tripConfig),
    ...evaluateJourneyRules(journeyContext, tripConfig.travellers),
    ...evaluateClimateRules(tripConfig),
    ...evaluateAccommodationRules(tripConfig),
    ...evaluateActivityRules(tripConfig),
    ...evaluatePreferenceRules(tripConfig),
    ...evaluateCompositionRules(tripConfig),
  ]

  // 4. Deduplicate candidates by canonical slug and promote priority
  const deduplicatedCandidates = deduplicateCandidates(rawCandidates)

  // 5. Calculate strategy-driven quantities
  const incomingItems: PackingItem[] = []
  const context = {
    durationDays,
    hasLaundry,
    travellers: tripConfig.travellers,
  }

  for (const candidate of deduplicatedCandidates) {
    const qty = calculateItemQuantity(
      candidate.quantityStrategy,
      candidate.quantityParams,
      {
        ...context,
        targetAgeGroup: candidate.targetAgeGroup,
      }
    )

    // Only include items with positive calculated quantity (or preserved fixed items)
    if (qty > 0) {
      incomingItems.push({
        id: `item-${tripId}-${candidate.itemSlug}`,
        tripId,
        name: candidate.name,
        itemSlug: candidate.itemSlug,
        category: candidate.category,
        priority: candidate.priority,
        quantityStrategy: candidate.quantityStrategy,
        quantityParams: candidate.quantityParams,
        generatedQuantity: qty,
        userAdjustedQuantity: undefined,
        effectiveQuantity: qty,
        packedQuantity: 0,
        isPacked: false,
        weightGrams: candidate.weightGrams,
        isShared: candidate.isShared,
        isCustom: false,
        reasons: candidate.reasons,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // 6. Reconcile with existing checklist state (preserving overrides, packed state, custom items)
  let reconciledItems: PackingItem[]

  if (existingItems && existingItems.length > 0) {
    reconciledItems = mergeChecklists(existingItems, incomingItems, dismissedRecords)
  } else {
    // Brand-new trip: filter out any items already in dismissed records
    const dismissedSlugs = new Set(dismissedRecords.map((r) => r.itemSlug))
    reconciledItems = incomingItems.filter((i) => !dismissedSlugs.has(i.itemSlug))
  }

  // 7. Extract critical dismissal warnings (guardrail preventing misleading 100% readiness)
  const criticalDismissedWarnings = dismissedRecords.filter((d) => d.priority === 'critical')

  // 8. Extract orphaned items (items from removed activities/modes retained for user review)
  const orphanedItems = reconciledItems.filter((i) => i.isOrphaned)

  return {
    items: reconciledItems,
    durationDays,
    hasLaundry,
    dismissedRecords,
    criticalDismissedWarnings,
    orphanedItems,
  }
}
