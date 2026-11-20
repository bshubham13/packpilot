import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Compass,
  Calendar,
  MapPin,
  Users,
  Copy,
  Trash2,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  HardDriveDownload,
} from 'lucide-react'
import { useTripStore } from '../stores/tripStore'
import { Card, Button, Badge, Modal } from '../components/ui'
import { BackupRestoreModal } from '../components/backup'
import { formatDisplayDate } from '../utils/dates'
import { calculateReadinessScore } from '../utils/scoring'
import { getStorageContext } from '../db/factory'
import type { Trip, PackingItem } from '../types'

export function TripDashboardPage() {
  const navigate = useNavigate()
  const trips = useTripStore((state) => state.trips)
  const isLoading = useTripStore((state) => state.isLoading)
  const error = useTripStore((state) => state.error)
  const loadTrips = useTripStore((state) => state.loadTrips)
  const deleteTrip = useTripStore((state) => state.deleteTrip)
  const duplicateTrip = useTripStore((state) => state.duplicateTrip)
  const clearError = useTripStore((state) => state.clearError)

  // Asynchronously fetched items per trip to compute real-time packing progress
  const [tripItemsMap, setTripItemsMap] = useState<Record<string, PackingItem[]>>({})
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false)

  // Modal dialog states
  const [duplicateTarget, setDuplicateTarget] = useState<Trip | null>(null)
  const [duplicateName, setDuplicateName] = useState<string>('')
  const [isDuplicating, setIsDuplicating] = useState<boolean>(false)

  const [deleteTarget, setDeleteTarget] = useState<Trip | null>(null)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)

  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false)

  // Ensure trips are fresh when visiting the dashboard
  useEffect(() => {
    loadTrips()
  }, [loadTrips])

  // Fetch packing items for all loaded trips to calculate readiness scores
  useEffect(() => {
    let isMounted = true

    const fetchItems = async () => {
      if (trips.length === 0) {
        if (isMounted) setTripItemsMap({})
        return
      }

      setIsLoadingItems(true)
      try {
        const storage = getStorageContext()
        const entries = await Promise.all(
          trips.map(async (t) => {
            const items = await storage.items.getItemsForTrip(t.id)
            return [t.id, items] as const
          })
        )
        if (isMounted) {
          setTripItemsMap(Object.fromEntries(entries))
        }
      } catch (err) {
        console.error('Failed to load checklist items for trips:', err)
      } finally {
        if (isMounted) {
          setIsLoadingItems(false)
        }
      }
    }

    fetchItems()
    return () => {
      isMounted = false
    }
  }, [trips])

  // Modal Action Handlers
  const openDuplicateModal = (trip: Trip) => {
    setDuplicateTarget(trip)
    setDuplicateName(`${trip.name} (Copy)`)
  }

  const closeDuplicateModal = () => {
    setDuplicateTarget(null)
    setDuplicateName('')
    setIsDuplicating(false)
  }

  const handleConfirmDuplicate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!duplicateTarget) return

    const trimmedName = duplicateName.trim() || `${duplicateTarget.name} (Copy)`
    setIsDuplicating(true)
    try {
      const duplicated = await duplicateTrip(duplicateTarget.id, trimmedName)
      closeDuplicateModal()
      // Seamlessly navigate to the duplicated trip's checklist
      navigate(`/trips/${duplicated.id}`)
    } catch {
      setIsDuplicating(false)
    }
  }

  const openDeleteModal = (trip: Trip) => {
    setDeleteTarget(trip)
  }

  const closeDeleteModal = () => {
    setDeleteTarget(null)
    setIsDeleting(false)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      await deleteTrip(deleteTarget.id)
      closeDeleteModal()
    } catch {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-sand/40 pb-4 sm:pb-5">
        <div>
          <Badge variant="sand" size="sm" className="mb-1.5 sm:mb-2">
            Trip Dashboard
          </Badge>
          <h1 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-ink-black">
            My Journeys
          </h1>
          <p className="font-sans text-xs sm:text-sm text-ink-black/70 mt-0.5 sm:mt-1 leading-normal sm:leading-relaxed">
            Review, duplicate, or inspect your planned travel itineraries.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <Button
            variant="secondary"
            onClick={() => setIsBackupModalOpen(true)}
            leftIcon={<HardDriveDownload className="w-4 h-4" aria-hidden="true" />}
            className="w-full sm:w-auto text-xs sm:text-sm font-medium"
            data-testid="dashboard-backup-btn"
          >
            Backup &amp; Restore
          </Button>
          <Link to="/wizard/new" className="w-full sm:w-auto">
            <Button
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
              className="w-full sm:w-auto text-xs sm:text-sm font-medium"
            >
              Plan a New Trip
            </Button>
          </Link>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div
          role="alert"
          className="bg-terracotta/10 border border-terracotta/30 text-ink-black p-4 rounded-card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-terracotta shrink-0" aria-hidden="true" />
            <span className="font-sans text-xs sm:text-sm font-medium">{error}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={() => loadTrips()}>
              Retry
            </Button>
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Initial Loading State */}
      {isLoading && trips.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-terracotta mx-auto" aria-hidden="true" />
          <p className="font-serif text-base text-ink-black/75">Loading your journeys...</p>
        </div>
      ) : trips.length === 0 ? (
        /* Empty State */
        <Card
          variant="polaroid"
          hasTape
          className="text-center py-8 px-4 sm:py-12 sm:px-6 max-w-lg mx-auto space-y-3 sm:space-y-4"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-sand/20 text-ink-black/70 flex items-center justify-center mx-auto">
            <Compass className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1 sm:space-y-1.5">
            <h2 className="font-serif font-bold text-lg sm:text-xl text-ink-black">
              No Journeys Planned Yet
            </h2>
            <p className="font-sans text-xs sm:text-sm text-ink-black/70 max-w-sm mx-auto leading-normal sm:leading-relaxed">
              Ready to embark on an adventure? Create your first trip to generate a personalized,
              categorized packing checklist.
            </p>
          </div>
          <div className="pt-1 sm:pt-2">
            <Link to="/wizard/new" className="inline-block w-full sm:w-auto">
              <Button
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                Start Trip Wizard
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        /* Saved Trips List */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-ink-black/60 font-sans">
            <span>{`${trips.length} ${trips.length === 1 ? 'Trip' : 'Trips'} Recorded`}</span>
            {isLoadingItems && (
              <span className="flex items-center gap-1.5 text-ink-black/50">
                <Loader2 className="w-3 h-3 animate-spin" />
                Updating readiness scores...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {trips.map((trip) => {
              const items = tripItemsMap[trip.id] || []
              const readiness = calculateReadinessScore(items, trip.dismissedItems)
              const packedItemsCount = items.filter(
                (item) => item.isPacked || (item.effectiveQuantity > 0 && item.packedQuantity >= item.effectiveQuantity)
              ).length
              const totalItemsCount = items.length

              return (
                <Card
                  key={trip.id}
                  variant="ticket"
                  padding="none"
                  className="p-4 sm:p-5 flex flex-col justify-between h-full space-y-4 hover:border-sand transition-all duration-200"
                >
                  <div className="space-y-3">
                    {/* Title & Duration Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <h2
                        className="font-serif font-bold text-base sm:text-lg text-ink-black leading-snug line-clamp-1"
                        title={trip.name}
                      >
                        {trip.name}
                      </h2>
                      <Badge variant="outline" size="sm" className="shrink-0">
                        {`${trip.durationDays} ${trip.durationDays === 1 ? 'Day' : 'Days'}`}
                      </Badge>
                    </div>

                    {/* Destination & Dates */}
                    <div className="space-y-1.5 text-xs text-ink-black/75">
                      <p className="flex items-center gap-1.5 font-medium text-ink-black">
                        <MapPin className="w-3.5 h-3.5 text-terracotta shrink-0" aria-hidden="true" />
                        <span className="truncate">{trip.destination}</span>
                      </p>
                      <p className="flex items-center gap-1.5 text-ink-black/60">
                        <Calendar className="w-3.5 h-3.5 text-sand shrink-0" aria-hidden="true" />
                        <span>{`${formatDisplayDate(trip.startDate)} – ${formatDisplayDate(trip.endDate)}`}</span>
                      </p>
                    </div>

                    {/* Metadata Chips: Travellers, Climate, Transport */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <Badge variant="sand" size="sm" icon={<Users className="w-3 h-3" />}>
                        {`${trip.totalTravellerCount} ${
                          trip.totalTravellerCount === 1 ? 'Traveller' : 'Travellers'
                        }`}
                      </Badge>
                      {trip.climate && (
                        <Badge variant="sand" size="sm" className="capitalize">
                          {trip.climate}
                        </Badge>
                      )}
                      {trip.transportModes && trip.transportModes.length > 0 && (
                        <Badge variant="outline" size="sm" className="capitalize">
                          {trip.transportModes.join(', ')}
                        </Badge>
                      )}
                    </div>

                    {/* Real-time Packing Readiness Progress Meter */}
                    <div className="pt-2 border-t border-sand/20 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-ink-black/80">
                          {`${readiness.percentage}% packed`}
                        </span>
                        <span className="text-ink-black/60 text-[11px]">
                          {totalItemsCount > 0
                            ? `${packedItemsCount} of ${totalItemsCount} items`
                            : 'No items yet'}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div
                        className="w-full bg-sand/25 h-2 rounded-full overflow-hidden"
                        role="progressbar"
                        aria-valuenow={readiness.percentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Packing readiness for ${trip.name}`}
                      >
                        <div
                          className={`h-full transition-all duration-300 ${
                            readiness.isFullyReady ? 'bg-forest-green' : 'bg-terracotta'
                          }`}
                          style={{ width: `${readiness.percentage}%` }}
                        />
                      </div>

                      {/* Critical Alert Guardrail / Readiness Tag */}
                      {readiness.hasOutstandingCritical && (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-terracotta pt-0.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                          <span>
                            {`${readiness.unpackedCriticalCount} critical ${
                              readiness.unpackedCriticalCount === 1 ? 'item' : 'items'
                            } unpacked`}
                          </span>
                        </div>
                      )}

                      {readiness.isFullyReady && (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-forest-green pt-0.5">
                          <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                          <span>Ready for adventure</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-sand/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDuplicateModal(trip)}
                        title="Duplicate Journey"
                        aria-label={`Duplicate journey ${trip.name}`}
                        className="p-1.5 min-h-[32px] text-ink-black/70 hover:text-ink-black"
                      >
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteModal(trip)}
                        title="Delete Journey"
                        aria-label={`Delete journey ${trip.name}`}
                        className="p-1.5 min-h-[32px] text-ink-black/60 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                    </div>

                    <Link to={`/trips/${trip.id}`}>
                      <Button
                        variant="secondary"
                        size="sm"
                        rightIcon={<ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />}
                        className="text-xs"
                      >
                        View Checklist
                      </Button>
                    </Link>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Duplicate Journey Modal */}
      <Modal
        isOpen={duplicateTarget !== null}
        onClose={closeDuplicateModal}
        title="Duplicate Journey"
        description="Create an independent copy of this itinerary and packing checklist."
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={closeDuplicateModal}
              disabled={isDuplicating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmDuplicate}
              isLoading={isDuplicating}
              leftIcon={<Copy className="w-3.5 h-3.5" />}
            >
              Duplicate Journey
            </Button>
          </>
        }
      >
        <form onSubmit={handleConfirmDuplicate} className="space-y-3">
          <div>
            <label
              htmlFor="duplicate-journey-name"
              className="block font-sans text-xs font-semibold text-ink-black mb-1.5"
            >
              New Journey Name
            </label>
            <input
              id="duplicate-journey-name"
              type="text"
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              placeholder="e.g. Alpine Expedition (Summer 2026)"
              required
              autoFocus
              className="w-full px-3 py-2 bg-warm-white border border-sand/50 rounded-card font-sans text-sm text-ink-black placeholder:text-ink-black/40 focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-transparent transition-all"
            />
          </div>
          <p className="font-sans text-xs text-ink-black/60">
            All checklist items and custom additions will be duplicated into a separate, isolated journey.
          </p>
        </form>
      </Modal>

      {/* Delete Journey Confirmation Modal */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={closeDeleteModal}
        title="Delete Journey"
        description="Are you sure you want to remove this journey?"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={closeDeleteModal}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmDelete}
              isLoading={isDeleting}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              className="bg-red-700 hover:bg-red-800 focus-visible:ring-red-600 text-warm-white"
            >
              Delete Journey
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-xs sm:text-sm text-ink-black/85">
            You are about to delete{' '}
            <strong className="font-semibold text-ink-black">
              &ldquo;{deleteTarget?.name}&rdquo;
            </strong>
            . This action cannot be undone.
          </p>
          <div className="bg-sand/15 rounded-card p-3 text-xs text-ink-black/75 flex items-start gap-2 border border-sand/30">
            <AlertTriangle className="w-4 h-4 text-terracotta shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              All associated checklist items, packed quantities, and dismissed item records for this
              trip will be permanently removed from storage.
            </span>
          </div>
        </div>
      </Modal>

      {/* Backup & Restore Modal */}
      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />
    </div>
  )
}
