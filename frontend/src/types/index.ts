/**
 * PackPilot — Official Domain Data Models & Types
 * Specification Version: 1.4.0
 */

export type TransportMode =
  | 'flight'
  | 'train'
  | 'car'
  | 'bike'
  | 'bus'
  | 'other'

export type TripActivity =
  | 'beach'
  | 'sightseeing'
  | 'trekking'
  | 'adventure'
  | 'business'
  | 'camping'
  | 'family'
  | 'relaxation'

export type ClimateType =
  | 'warm'
  | 'cold'
  | 'rainy'
  | 'mixed'
  | 'unknown'

export type AccommodationType =
  | 'hotel'
  | 'hostel'
  | 'rental'
  | 'camping'
  | 'friends_family'

export type PackingCategory =
  | 'documents'
  | 'clothing'
  | 'toiletries'
  | 'electronics'
  | 'gear'
  | 'health'
  | 'miscellaneous'

export type ItemPriority =
  | 'critical'    // Weight = 3 (Passport, Meds, Tickets)
  | 'recommended' // Weight = 2 (Chargers, Sunscreen, Rainwear)
  | 'optional'    // Weight = 1 (Books, Eye mask, Travel pillow)

export type BagAssignment = 'cabin' | 'checked'

/**
 * Strategy-driven quantity calculation methodology
 */
export type QuantityStrategy =
  | 'per_person'           // 1 per person (Toothbrush, boots, jacket)
  | 'per_day'              // Daily rate (Trail snacks, daily disposable contacts)
  | 'per_person_per_day'   // Wearables scaled by duration & item-specific laundry rules
  | 'shared_capacity'      // 1 item per N persons (Tent for 2, Sunscreen for 3)
  | 'fixed'                // Constant count (Universal adapter, car roadside kit)
  | 'user_defined'         // Custom item or manual user-locked override

export interface QuantityStrategyParams {
  baseUnitsPerDay?: number
  unitsPerPerson?: number      // Multiplier per eligible person (e.g. 2 feeding bottles per infant)
  capacityPerUnit?: number
  laundryRotationDays?: number // Item-specific rotation (e.g. 7 days for underwear)
  noLaundryMaxCap?: number     // Item-specific cap without laundry (e.g. 21 days)
  bufferUnits?: number         // +1 extra buffer
  minQuantity?: number
  maxQuantity?: number
}

export type TargetAgeGroup =
  | 'all'
  | 'adults'
  | 'teens'
  | 'children'
  | 'infants'
  | 'seniors'
  | 'adults_and_teens'

export interface RecommendationCandidate {
  itemSlug: string
  name: string
  category: PackingCategory
  priority: ItemPriority
  quantityStrategy: QuantityStrategy
  quantityParams?: QuantityStrategyParams
  targetAgeGroup?: TargetAgeGroup
  weightGrams?: number
  isShared: boolean
  reasons: string[]
}

/**
 * Contiguous, non-overlapping traveller age groups
 */
export interface TravellerComposition {
  adults: number      // 18–64 years (min 1 for unaccompanied, default 1)
  teens: number       // 13–17 years (default 0)
  children: number    // 3–12 years (default 0)
  infants: number     // 0–2 years (default 0)
  seniors: number     // 65+ years (default 0)
}

export function getTotalTravellers(t: TravellerComposition): number {
  if (!t || typeof t !== 'object') return 0
  const safeCount = (n: unknown): number => {
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return 0
    return Math.floor(n)
  }
  return (
    safeCount(t.adults) +
    safeCount(t.teens) +
    safeCount(t.children) +
    safeCount(t.infants) +
    safeCount(t.seniors)
  )
}

/**
 * Dual baggage configuration supporting cabin and checked luggage independently
 */
export interface BaggageConfig {
  hasCabinBaggage: boolean          // Default: true
  cabinWeightLimitKg: number        // Default: 7.0 kg (presets: 7.0, 8.0, 10.0, custom)
  hasCheckedBaggage: boolean        // Default: false
  checkedWeightLimitKg: number      // Default: 23.0 kg (presets: 20.0, 23.0, 32.0, custom)
}

export const DEFAULT_BAGGAGE_CONFIG: BaggageConfig = {
  hasCabinBaggage: true,
  cabinWeightLimitKg: 7.0,
  hasCheckedBaggage: false,
  checkedWeightLimitKg: 23.0,
}

/**
 * Snapshot of a dismissed item to prevent zombie resurrection and allow lossless restoration
 */
export interface DismissedItemRecord {
  itemSlug: string
  name: string
  category: PackingCategory
  priority: ItemPriority
  reasons: string[]
  dismissedAt: string
  originalItemSnapshot: PackingItem  // Complete state snapshot for lossless restoration
}

export interface TripConfig {
  name: string
  destination: string
  startDate: string                  // ISO 8601 YYYY-MM-DD
  endDate: string                    // ISO 8601 YYYY-MM-DD
  transportModes: TransportMode[]
  activities: TripActivity[]
  climate?: ClimateType
  accommodationType?: AccommodationType
  hasLaundryAccess?: boolean         // Explicit user confirmation of laundry facility access
  travellers: TravellerComposition
  personalPreferences?: string[]
  specialRequirements?: string
  baggageConfig?: Partial<BaggageConfig>
}

export interface Trip extends TripConfig {
  id: string
  durationDays: number
  climate: ClimateType
  accommodationType?: AccommodationType
  travellers: TravellerComposition
  totalTravellerCount: number
  personalPreferences: string[]
  baggageConfig: BaggageConfig
  dismissedItems: DismissedItemRecord[] // Preserves full snapshots preventing resurrection
  engineVersion: string
  createdAt: string
  updatedAt: string
}

export interface PackingItem {
  id: string                     // UUID v4
  tripId: string                 // Foreign Key -> Trip.id
  name: string                   // "Underwear (Clean pairs)"
  itemSlug: string               // Canonical identifier (e.g. "wear-underwear")
  category: PackingCategory
  
  // Strategy-Driven Quantities & Partial Packing State
  quantityStrategy: QuantityStrategy
  quantityParams?: QuantityStrategyParams
  generatedQuantity: number      // Calculated by recommendation engine
  userAdjustedQuantity?: number  // Non-null if user explicitly changed quantity
  effectiveQuantity: number      // userAdjustedQuantity ?? generatedQuantity
  packedQuantity: number         // 0 <= packedQuantity <= effectiveQuantity
  isPacked: boolean              // packedQuantity >= effectiveQuantity && effectiveQuantity > 0
  
  priority: ItemPriority
  
  // Physical Weight Metadata (Stored per unit only; Total is derived at runtime)
  weightGrams?: number           // Unit weight in grams (undefined if unknown)
  
  // Bag Assignment (undefined indicates unassigned)
  bagAssignment?: BagAssignment

  // Multi-Traveller & Attribution
  isShared: boolean              // True if item is shared across travellers
  assignedTo?: string            // Specific traveller tag (e.g., "Infant", "Teen")
  isCustom: boolean              // True if user created manually
  reasons: string[]              // Rationale: ["5-day duration", "Beach activity"]
  notes?: string                 // Custom user note for item
  isOrphaned?: boolean           // True if item is no longer recommended due to removed trip parameters
  advisory?: string              // Advisory warning/explanation for user review
  
  createdAt: string
  updatedAt: string
}

export interface TemplateItemConfig {
  name: string
  itemSlug: string
  category: PackingCategory
  quantityStrategy: QuantityStrategy
  quantityParams?: QuantityStrategyParams
  defaultQuantity: number
  priority: ItemPriority
  weightGrams?: number
  isShared: boolean
  reasons: string[]
}

export interface PackingTemplate {
  id: string
  name: string
  description: string
  isSystem: boolean
  defaultTransport?: TransportMode[]
  defaultActivities?: TripActivity[]
  defaultClimate?: ClimateType
  defaultAccommodation?: AccommodationType
  items: TemplateItemConfig[]
  createdAt: string
  updatedAt: string
}

export interface ReadinessScore {
  percentage: number                 // 0 to 100
  packedPoints: number               // Sum of (packedRatio * weight)
  totalPossiblePoints: number        // Sum of weights of active items
  unpackedCriticalCount: number      // Critical items in checklist with packedQuantity < effectiveQuantity
  dismissedCriticalCount: number     // Critical items that were dismissed by user
  hasOutstandingCritical: boolean    // True if unpackedCriticalCount > 0 OR dismissedCriticalCount > 0
  isFullyReady: boolean              // True if percentage === 100 AND !hasOutstandingCritical
}

export interface BagWeightSummary {
  bagType: 'cabin' | 'checked'
  isConfigured: boolean
  limitKg: number
  knownWeightGrams: number
  knownWeightKg: number
  knownWeightLbs: number
  remainingCapacityKg: number
  exceededAmountKg: number
  percentageUsed: number
  itemsWithKnownWeightCount: number
  itemsWithUnknownWeightCount: number
  hasUnknownWeights: boolean
  isLimitExceeded: boolean
}

export interface UnassignedWeightSummary {
  knownWeightGrams: number
  knownWeightKg: number
  knownWeightLbs: number
  itemsWithKnownWeightCount: number
  itemsWithUnknownWeightCount: number
  totalItemCount: number
  hasUnknownWeights: boolean
}

export interface CombinedWeightSummary {
  totalKnownWeightGrams: number
  totalKnownWeightKg: number
  totalKnownWeightLbs: number
  totalItemsWithKnownWeightCount: number
  totalItemsWithUnknownWeightCount: number
  hasUnknownWeights: boolean
}

export interface WeightEstimate {
  // Independent Bag Breakdowns
  cabin: BagWeightSummary
  checked: BagWeightSummary
  unassigned: UnassignedWeightSummary

  // Combined Informational Summary (No combined limit evaluation)
  combined: CombinedWeightSummary

  // Backward-compatible accessors for existing consumers
  totalKnownWeightGrams: number
  totalKnownWeightKg: number
  totalKnownWeightLbs: number
  itemsWithKnownWeightCount: number
  itemsWithUnknownWeightCount: number
  hasUnknownWeights: boolean
  cabinLimitKg: number
  checkedLimitKg: number
  isCabinConfigured: boolean
  isCheckedConfigured: boolean
  isExceedingCabinLimit: boolean
  isExceedingCheckedLimit: boolean
}
