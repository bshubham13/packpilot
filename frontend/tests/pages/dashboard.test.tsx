import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { useTripStore } from '../../src/stores/tripStore'
import { useChecklistStore } from '../../src/stores/checklistStore'
import { TripDashboardPage } from '../../src/pages/TripDashboardPage'
import { getStorageContext, createStorageContext } from '../../src/db/factory'
import type { Trip, PackingItem } from '../../src/types'

// In Node SSR test environment, ensure useSyncExternalStore reads live store snapshot
vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot())

const sampleTrip: Trip = {
  id: 'trip-123',
  name: 'Alpine Expedition',
  destination: 'Interlaken, Switzerland',
  startDate: '2026-07-10',
  endDate: '2026-07-17',
  durationDays: 8,
  climate: 'cold',
  transportModes: ['flight', 'train'],
  activities: ['trekking', 'adventure'],
  travellers: {
    adults: 2,
    teens: 0,
    children: 0,
    infants: 0,
  },
  totalTravellerCount: 2,
  personalPreferences: [],
  baggageConfig: {
    hasCabinBaggage: true,
    cabinWeightLimitKg: 7.0,
    hasCheckedBaggage: true,
    checkedWeightLimitKg: 23.0,
  },
  dismissedItems: [],
  engineVersion: '1.4.0',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
}

const sampleItems: PackingItem[] = [
  {
    id: 'item-1',
    tripId: 'trip-123',
    name: 'Thermal Jacket',
    itemSlug: 'wear-thermal-jacket',
    category: 'clothing',
    priority: 'critical',
    quantityStrategy: 'per_person',
    strategyConfig: {},
    baseQuantity: 2,
    effectiveQuantity: 2,
    packedQuantity: 2,
    isPacked: true,
    weightGrams: 800,
    isCustom: false,
    rulesTriggered: ['climate_cold'],
    reasons: ['Cold weather insulation'],
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
  },
  {
    id: 'item-2',
    tripId: 'trip-123',
    name: 'Trekking Poles',
    itemSlug: 'gear-trekking-poles',
    category: 'gear',
    priority: 'recommended',
    quantityStrategy: 'fixed',
    strategyConfig: {},
    baseQuantity: 1,
    effectiveQuantity: 1,
    packedQuantity: 0,
    isPacked: false,
    weightGrams: 500,
    isCustom: false,
    rulesTriggered: ['activity_trekking'],
    reasons: ['Mountain trekking stability'],
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
  },
]

describe('Trip Dashboard Page (Milestone 1 — Phase 6, Slice 6.2)', () => {
  beforeEach(async () => {
    // Reinitialize in-memory storage context for test isolation
    createStorageContext('memory')
    useTripStore.setState({
      trips: [],
      activeTrip: null,
      isLoading: false,
      isInitialized: true,
      error: null,
      storageType: 'memory',
      isStorageAvailable: true,
    })
    useChecklistStore.setState({
      tripId: null,
      items: [],
      dismissedRecords: [],
      isLoading: false,
      error: null,
    })
  })

  describe('Empty State', () => {
    it('renders the Polaroid empty state card when there are no saved trips', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/trips']}>
          <TripDashboardPage />
        </MemoryRouter>
      )

      expect(html).toContain('My Journeys')
      expect(html).toContain('No Journeys Planned Yet')
      expect(html).toContain('Ready to embark on an adventure?')
      expect(html).toContain('Start Trip Wizard')
      expect(html).toContain('href="/wizard/new"')
    })

    it('renders the top CTA button to plan a new trip', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/trips']}>
          <TripDashboardPage />
        </MemoryRouter>
      )

      expect(html).toContain('Plan a New Trip')
    })
  })

  describe('Populated Saved Trips State', () => {
    it('renders saved trip cards with real persisted trip data', () => {
      useTripStore.setState({
        trips: [sampleTrip],
        isInitialized: true,
        isLoading: false,
      })

      const html = renderToString(
        <MemoryRouter initialEntries={['/trips']}>
          <TripDashboardPage />
        </MemoryRouter>
      )

      expect(html).toContain('1 Trip Recorded')
      expect(html).toContain('Alpine Expedition')
      expect(html).toContain('Interlaken, Switzerland')
      expect(html).toContain('8 Days')
      expect(html).toContain('2 Travellers')
      expect(html).toContain('cold')
      expect(html).toContain('flight, train')
      expect(html).toContain('View Checklist')
      expect(html).toContain('href="/trips/trip-123"')
    })

    it('renders plural trip count correctly when multiple trips exist', () => {
      const secondTrip: Trip = {
        ...sampleTrip,
        id: 'trip-456',
        name: 'Kyoto Autumn Walk',
        destination: 'Kyoto, Japan',
      }

      useTripStore.setState({
        trips: [sampleTrip, secondTrip],
        isInitialized: true,
        isLoading: false,
      })

      const html = renderToString(
        <MemoryRouter initialEntries={['/trips']}>
          <TripDashboardPage />
        </MemoryRouter>
      )

      expect(html).toContain('2 Trips Recorded')
      expect(html).toContain('Alpine Expedition')
      expect(html).toContain('Kyoto Autumn Walk')
    })
  })

  describe('Error & Loading State Handling', () => {
    it('renders error banner with retry and dismiss buttons when an error is present', () => {
      useTripStore.setState({
        trips: [],
        error: 'Network connectivity timeout during trip synchronization',
        isLoading: false,
      })

      const html = renderToString(
        <MemoryRouter initialEntries={['/trips']}>
          <TripDashboardPage />
        </MemoryRouter>
      )

      expect(html).toContain('Network connectivity timeout during trip synchronization')
      expect(html).toContain('Retry')
      expect(html).toContain('Dismiss')
    })

    it('renders loading indicator when isLoading is true and trips are empty', () => {
      useTripStore.setState({
        trips: [],
        isLoading: true,
      })

      const html = renderToString(
        <MemoryRouter initialEntries={['/trips']}>
          <TripDashboardPage />
        </MemoryRouter>
      )

      expect(html).toContain('Loading your journeys...')
    })
  })

  describe('Trip Store Actions: Duplication, Deletion & Cascading', () => {
    it('duplicates a trip creating a genuinely independent copy with new ID', async () => {
      const storage = getStorageContext()
      await storage.trips.saveTripWithItems(sampleTrip, sampleItems)

      useTripStore.setState({
        trips: [sampleTrip],
        isInitialized: true,
      })

      const duplicated = await useTripStore.getState().duplicateTrip(sampleTrip.id, 'Alpine Expedition (Summer)')

      expect(duplicated.id).not.toBe(sampleTrip.id)
      expect(duplicated.name).toBe('Alpine Expedition (Summer)')
      expect(duplicated.destination).toBe(sampleTrip.destination)

      const tripsInStore = useTripStore.getState().trips
      expect(tripsInStore.length).toBe(2)
      expect(tripsInStore[0].id).toBe(duplicated.id)

      // Ensure child items were also duplicated independently
      const duplicatedItems = await storage.items.getItemsForTrip(duplicated.id)
      expect(duplicatedItems.length).toBe(sampleItems.length)
      expect(duplicatedItems[0].id).not.toBe(sampleItems[0].id)
      expect(duplicatedItems[0].tripId).toBe(duplicated.id)
    })

    it('deletes a trip and cascades to child items while clearing checklist state', async () => {
      const storage = getStorageContext()
      await storage.trips.saveTripWithItems(sampleTrip, sampleItems)

      useTripStore.setState({
        trips: [sampleTrip],
        activeTrip: sampleTrip,
        isInitialized: true,
      })
      useChecklistStore.setState({
        tripId: sampleTrip.id,
        items: sampleItems,
      })

      await useTripStore.getState().deleteTrip(sampleTrip.id)

      // Ensure removed from tripStore
      const tripsInStore = useTripStore.getState().trips
      expect(tripsInStore.length).toBe(0)
      expect(useTripStore.getState().activeTrip).toBeNull()

      // Ensure checklistStore cleared
      expect(useChecklistStore.getState().tripId).toBeNull()
      expect(useChecklistStore.getState().items.length).toBe(0)

      // Ensure items deleted from storage
      const itemsInStorage = await storage.items.getItemsForTrip(sampleTrip.id)
      expect(itemsInStorage.length).toBe(0)
    })
  })
})
