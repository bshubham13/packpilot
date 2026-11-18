import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Compass,
  AlertCircle,
  RefreshCw,
  Luggage,
  Check,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
  FileText,
  Shirt,
  Sparkles,
  Smartphone,
  Backpack,
  HeartPulse,
  Package,
} from 'lucide-react'
import { useTripStore } from '../stores/tripStore'
import { useChecklistStore } from '../stores/checklistStore'
import { Card, Button, Badge } from '../components/ui'
import { formatDisplayDate } from '../utils/dates'
import type { PackingCategory, PackingItem, ItemPriority, Trip } from '../types'

interface CategoryMeta {
  key: PackingCategory
  label: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  description: string
}

const CATEGORIES: CategoryMeta[] = [
  {
    key: 'documents',
    label: 'Travel Documents & Identification',
    icon: FileText,
    description: 'Passports, tickets, permits, and reservations',
  },
  {
    key: 'clothing',
    label: 'Clothing & Apparel',
    icon: Shirt,
    description: 'Outfits, layers, weatherwear, and footwear',
  },
  {
    key: 'toiletries',
    label: 'Toiletries & Personal Care',
    icon: Sparkles,
    description: 'Hygiene, skincare, grooming, and liquids',
  },
  {
    key: 'electronics',
    label: 'Electronics & Connectivity',
    icon: Smartphone,
    description: 'Devices, chargers, cables, and adapters',
  },
  {
    key: 'gear',
    label: 'Outdoor & Activity Gear',
    icon: Backpack,
    description: 'Trail, beach, camping, and expedition gear',
  },
  {
    key: 'health',
    label: 'Health & Safety',
    icon: HeartPulse,
    description: 'Medications, first aid, and sun protection',
  },
  {
    key: 'miscellaneous',
    label: 'Miscellaneous & Travel Comfort',
    icon: Package,
    description: 'Comfort accessories, laundry aids, and notes',
  },
]

function PriorityBadge({ priority }: { priority: ItemPriority }) {
  switch (priority) {
    case 'critical':
      return (
        <Badge
          variant="terracotta"
          size="sm"
          icon={<AlertCircle className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />}
          className="font-bold tracking-wider"
        >
          Critical
        </Badge>
      )
    case 'recommended':
      return (
        <Badge
          variant="forest"
          size="sm"
          icon={<Check className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />}
        >
          Recommended
        </Badge>
      )
    case 'optional':
    default:
      return (
        <Badge variant="sand" size="sm">
          Optional
        </Badge>
      )
  }
}

interface ItemRowProps {
  item: PackingItem
  onTogglePacked: (itemId: string) => void
  onSetPackedQuantity: (itemId: string, qty: number) => void
}

function ChecklistItemRow({ item, onTogglePacked, onSetPackedQuantity }: ItemRowProps) {
  const isMulti = item.effectiveQuantity > 1
  const isFullyPacked = item.isPacked
  const isPartial = !isFullyPacked && item.packedQuantity > 0

  const handleCheckboxClick = () => {
    onTogglePacked(item.id)
  }

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (item.packedQuantity > 0) {
      onSetPackedQuantity(item.id, item.packedQuantity - 1)
    }
  }

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (item.packedQuantity < item.effectiveQuantity) {
      onSetPackedQuantity(item.id, item.packedQuantity + 1)
    }
  }

  // Row background styles based on packing status
  const rowBgClass = isFullyPacked
    ? 'bg-forest-green/5 border-forest-green/25'
    : isPartial
    ? 'bg-sunshine-yellow/10 border-sunshine-yellow/40'
    : 'bg-warm-white border-sand/40 hover:border-sand/70'

  return (
    <div
      data-testid={`checklist-item-${item.id}`}
      className={`p-3 sm:p-3.5 rounded-card border transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${rowBgClass}`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Toggle / Quick Pack Checkbox Button */}
        <button
          type="button"
          onClick={handleCheckboxClick}
          role="checkbox"
          aria-checked={isFullyPacked ? 'true' : isPartial ? 'mixed' : 'false'}
          aria-label={
            isFullyPacked
              ? `Mark ${item.name} as unpacked`
              : `Mark ${item.name} as packed`
          }
          className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-all border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta ${
            isFullyPacked
              ? 'bg-forest-green text-warm-white border-forest-green shadow-xs'
              : isPartial
              ? 'bg-sunshine-yellow/20 text-terracotta border-terracotta/50'
              : 'bg-warm-white border-sand/60 hover:border-terracotta text-transparent'
          }`}
        >
          {isFullyPacked ? (
            <Check className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
          ) : isPartial ? (
            <div className="w-2.5 h-2.5 rounded-xs bg-terracotta" aria-hidden="true" />
          ) : null}
        </button>

        {/* Item Information */}
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-sans text-sm font-medium leading-snug break-words ${
                isFullyPacked
                  ? 'line-through text-ink-black/50'
                  : 'text-ink-black'
              }`}
            >
              {item.name}
            </span>
            <PriorityBadge priority={item.priority} />
            {isPartial && (
              <Badge variant="sunshine" size="sm">
                {`Partial (${item.packedQuantity}/${item.effectiveQuantity})`}
              </Badge>
            )}
          </div>

          {/* Rationale & Reasons */}
          {item.reasons && item.reasons.length > 0 && (
            <p className="font-sans text-xs text-ink-black/60 leading-relaxed">
              {item.reasons[0]}
            </p>
          )}

          {/* Quantity adjustment indicator if customized */}
          {item.userAdjustedQuantity !== undefined &&
            item.userAdjustedQuantity !== item.generatedQuantity && (
              <p className="text-[11px] font-sans text-terracotta">
                {`Customized: ${item.effectiveQuantity} (Recommended: ${item.generatedQuantity})`}
              </p>
            )}
        </div>
      </div>

      {/* Stepper Controls & Quantity Display */}
      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-sand/30">
        {isMulti ? (
          <div className="flex items-center gap-1.5 bg-warm-white/80 border border-sand/50 rounded-card p-1 shadow-2xs">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={item.packedQuantity <= 0}
              aria-label={`Decrease packed count for ${item.name}`}
              className="w-7 h-7 rounded-sm flex items-center justify-center text-ink-black/70 hover:text-ink-black hover:bg-sand/20 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta"
            >
              <Minus className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            <span
              data-testid={`packed-count-${item.id}`}
              className="font-mono text-xs font-semibold px-1.5 text-ink-black min-w-[3.5rem] text-center"
            >
              {`${item.packedQuantity} / ${item.effectiveQuantity}`}
            </span>

            <button
              type="button"
              onClick={handleIncrement}
              disabled={item.packedQuantity >= item.effectiveQuantity}
              aria-label={`Increase packed count for ${item.name}`}
              className="w-7 h-7 rounded-sm flex items-center justify-center text-ink-black/70 hover:text-ink-black hover:bg-sand/20 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <span className="font-mono text-xs font-medium text-ink-black/60 px-2 py-1">
            {isFullyPacked ? '1 of 1 packed' : '0 of 1 packed'}
          </span>
        )}
      </div>
    </div>
  )
}

export function ChecklistPage() {
  const { id } = useParams<{ id: string }>()

  const [pageError, setPageError] = useState<string | null>(null)
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})

  const isTripStoreLoading = useTripStore((state) => state.isLoading)
  const activeTripFromStore = useTripStore((state) => state.activeTrip)
  const tripsFromStore = useTripStore((state) => state.trips)
  const selectTrip = useTripStore((state) => state.selectTrip)

  const currentTripIdInChecklistStore = useChecklistStore((state) => state.tripId)
  const itemsInChecklistStore = useChecklistStore((state) => state.items)
  const isChecklistLoading = useChecklistStore((state) => state.isLoading)
  const checklistStoreError = useChecklistStore((state) => state.error)
  const loadItems = useChecklistStore((state) => state.loadItems)
  const togglePacked = useChecklistStore((state) => state.togglePacked)
  const setPackedQuantity = useChecklistStore((state) => state.setPackedQuantity)

  // Load trip and checklist data safely
  const loadTripData = useCallback(async () => {
    if (!id) return
    setPageError(null)

    try {
      await Promise.all([
        selectTrip(id),
        loadItems(id),
      ])
    } catch (err: unknown) {
      setPageError(
        err instanceof Error
          ? err.message
          : `Failed to load trip and checklist for journey: ${id}`
      )
    }
  }, [id, selectTrip, loadItems])

  useEffect(() => {
    loadTripData()
  }, [loadTripData])

  // Resolve trip object from either activeTrip or trips list
  const currentTrip: Trip | null = useMemo(() => {
    if (activeTripFromStore && activeTripFromStore.id === id) return activeTripFromStore
    const found = tripsFromStore.find((t) => t.id === id)
    return found || null
  }, [activeTripFromStore, tripsFromStore, id])

  // Ensure stale async responses cannot display another trip's items
  const activeItems: PackingItem[] = useMemo(() => {
    if (currentTripIdInChecklistStore !== id) return []
    return itemsInChecklistStore
  }, [currentTripIdInChecklistStore, itemsInChecklistStore, id])

  // Group items by category
  const categorizedItems = useMemo(() => {
    const groups: Partial<Record<PackingCategory, PackingItem[]>> = {}
    for (const item of activeItems) {
      if (!groups[item.category]) {
        groups[item.category] = []
      }
      groups[item.category]!.push(item)
    }
    return groups
  }, [activeItems])

  const toggleCategory = (categoryKey: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryKey]: !prev[categoryKey],
    }))
  }

  const totalItemsCount = activeItems.length
  const totalPackedCount = useMemo(() => {
    return activeItems.filter((i) => i.isPacked).length
  }, [activeItems])

  const totalProgressPercentage =
    totalItemsCount > 0 ? Math.round((totalPackedCount / totalItemsCount) * 100) : 0

  const isLoading = isTripStoreLoading || isChecklistLoading

  // 1. Loading State
  if (isLoading && !currentTrip && activeItems.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-card bg-terracotta text-warm-white flex items-center justify-center mx-auto shadow-md animate-pulse">
          <Compass className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="font-serif font-bold text-xl text-ink-black">
            Opening Packing Journal...
          </h2>
          <p className="font-sans text-xs text-ink-black/60">
            Retrieving journey details and checklist items.
          </p>
        </div>
      </div>
    )
  }

  // 2. Storage / Loading Error State
  const activeError = pageError || checklistStoreError
  if (activeError && !currentTrip) {
    return (
      <div className="max-w-xl mx-auto space-y-5 py-8">
        <Card variant="polaroid" hasTape className="p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-serif font-bold text-xl text-ink-black">
              Checklist Storage Error
            </h2>
            <p className="font-sans text-xs sm:text-sm text-ink-black/70 leading-relaxed">
              {activeError}
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={loadTripData}
            >
              Retry Loading
            </Button>
            <Link to="/trips">
              <Button variant="secondary" size="sm">
                Back to My Trips
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  // 3. Missing Trip State (404)
  if (!currentTrip) {
    return (
      <div className="max-w-xl mx-auto space-y-5 py-8">
        <Card variant="polaroid" hasTape className="p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-sand/30 text-ink-black/60 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <Badge variant="terracotta" size="sm">
              Journey Not Found
            </Badge>
            <h2 className="font-serif font-bold text-xl text-ink-black">
              Trip Record Unavailable
            </h2>
            <p className="font-sans text-xs sm:text-sm text-ink-black/70 leading-relaxed">
              The journey you are looking for does not exist or may have been removed.
            </p>
          </div>
          <div className="pt-2">
            <Link to="/trips">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              >
                Back to My Trips
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  // 4. Empty Checklist State
  if (totalItemsCount === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="space-y-1.5 border-b border-sand/40 pb-3">
          <Link
            to="/trips"
            className="inline-flex items-center gap-1.5 text-xs font-sans text-ink-black/60 hover:text-terracotta transition-colors mb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta rounded-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to My Trips</span>
          </Link>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-ink-black">
            {currentTrip.name}
          </h1>
          <p className="font-sans text-xs text-ink-black/70 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-terracotta" aria-hidden="true" />
            <span>{currentTrip.destination}</span>
          </p>
        </div>

        <Card variant="polaroid" hasTape className="p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-sand/20 text-ink-black/60 flex items-center justify-center mx-auto">
            <Luggage className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-serif font-bold text-xl text-ink-black">
              Packing Checklist is Empty
            </h2>
            <p className="font-sans text-xs sm:text-sm text-ink-black/70 leading-relaxed">
              There are currently no packing items recorded for this trip.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link to="/trips">
              <Button variant="secondary" size="sm">
                Back to My Trips
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  // 5. Normal Populated Checklist View
  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 pb-16">
      {/* Top Editorial Breadcrumb & Trip Summary Header */}
      <div className="space-y-3 border-b border-sand/40 pb-4">
        <Link
          to="/trips"
          className="inline-flex items-center gap-1.5 text-xs font-sans text-ink-black/60 hover:text-terracotta transition-colors mb-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta rounded-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to My Trips</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="terracotta" size="sm">
                Trip Checklist
              </Badge>
              <Badge variant="outline" size="sm">
                {`${totalPackedCount} of ${totalItemsCount} Packed (${totalProgressPercentage}%)`}
              </Badge>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-ink-black">
              {currentTrip.name}
            </h1>
            <div className="flex items-center gap-3 flex-wrap text-xs font-sans text-ink-black/75 pt-0.5">
              <span className="inline-flex items-center gap-1 font-medium text-ink-black">
                <MapPin className="w-3.5 h-3.5 text-terracotta shrink-0" aria-hidden="true" />
                <span>{currentTrip.destination}</span>
              </span>
              <span className="text-sand/70">&bull;</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-ink-black/60 shrink-0" aria-hidden="true" />
                <span>
                  {`${formatDisplayDate(currentTrip.startDate)} – ${formatDisplayDate(
                    currentTrip.endDate
                  )}`}
                </span>
                <span className="text-ink-black/50">{`(${currentTrip.durationDays} days)`}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="pt-2">
          <div
            role="progressbar"
            aria-valuenow={totalProgressPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Overall packing progress"
            className="w-full bg-sand/30 rounded-full h-2 overflow-hidden"
          >
            <div
              className="bg-forest-green h-full transition-all duration-300 rounded-full"
              style={{ width: `${totalProgressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Categorized Accordion Groups */}
      <div className="space-y-4 sm:space-y-5">
        {CATEGORIES.map((cat) => {
          const catItems = categorizedItems[cat.key]
          if (!catItems || catItems.length === 0) return null

          const isCollapsed = Boolean(collapsedCategories[cat.key])
          const catPackedCount = catItems.filter((i) => i.isPacked).length
          const catTotalCount = catItems.length
          const isCategoryComplete = catPackedCount === catTotalCount && catTotalCount > 0

          const IconComponent = cat.icon

          return (
            <Card
              key={cat.key}
              variant="scrapbook"
              className="p-4 sm:p-5 space-y-3.5 transition-shadow"
            >
              {/* Category Header */}
              <button
                type="button"
                onClick={() => toggleCategory(cat.key)}
                aria-expanded={!isCollapsed}
                aria-controls={`category-panel-${cat.key}`}
                className="w-full flex items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta rounded-card p-1 -m-1 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-card bg-sand/25 text-terracotta flex items-center justify-center shrink-0">
                    <IconComponent className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-serif font-bold text-base sm:text-lg text-ink-black truncate">
                        {cat.label}
                      </h2>
                      {isCategoryComplete && (
                        <Badge variant="forest" size="sm">
                          Complete
                        </Badge>
                      )}
                    </div>
                    <p className="font-sans text-[11px] sm:text-xs text-ink-black/60 truncate">
                      {cat.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={isCategoryComplete ? 'forest' : 'sand'} size="sm">
                    {`${catPackedCount} / ${catTotalCount} packed`}
                  </Badge>
                  <div className="text-ink-black/50">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="w-4 h-4" aria-hidden="true" />
                    )}
                  </div>
                </div>
              </button>

              {/* Category Items List */}
              {!isCollapsed && (
                <div
                  id={`category-panel-${cat.key}`}
                  className="space-y-2 pt-1 border-t border-sand/30"
                >
                  {catItems.map((item) => (
                    <ChecklistItemRow
                      key={item.id}
                      item={item}
                      onTogglePacked={togglePacked}
                      onSetPackedQuantity={setPackedQuantity}
                    />
                  ))}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
