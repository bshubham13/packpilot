import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useTripStore } from '../../src/stores/tripStore'
import { useChecklistStore } from '../../src/stores/checklistStore'
import { ChecklistPage } from '../../src/pages/ChecklistPage'
import { createStorageContext, getStorageContext } from '../../src/db/factory'
import type { Trip, PackingItem } from '../../src/types'

// In Node SSR test environment, ensure useSyncExternalStore reads live store snapshot
vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot())

const mockTrip: Trip = {
  id: 'trip-alpine-101',
  name: 'Swiss Alpine Expedition',
  destination: 'Zermatt, Switzerland',
  startDate: '2026-08-10',
  endDate: '2026-08-17',
  durationDays: 8,
  climate: 'cold',
  transportModes: ['flight', 'train'],
  activities: ['trekking'],
  travellers: {
    adults: 2,
    teens: 0,
    children: 0,
    infants: 0,
    seniors: 0,
  },
  totalTravellerCount: 2,
  personalPreferences: ['first_aid'],
  baggageConfig: {
    hasCabinBaggage: true,
    cabinWeightLimitKg: 8.0,
    hasCheckedBaggage: true,
    checkedWeightLimitKg: 23.0,
  },
  dismissedItems: [],
  engineVersion: '1.4.0',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
}

const mockItems: PackingItem[] = [
  {
    id: 'item-passport',
    tripId: 'trip-alpine-101',
    name: 'Passport & Travel Visa',
    itemSlug: 'doc-passport',
    category: 'documents',
    priority: 'critical',
    quantityStrategy: 'per_person',
    generatedQuantity: 2,
    effectiveQuantity: 2,
    packedQuantity: 2,
    isPacked: true,
    weightGrams: 50,
    isShared: false,
    isCustom: false,
    reasons: ['Mandatory international identification'],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'item-thermal-top',
    tripId: 'trip-alpine-101',
    name: 'Thermal Base Layer Top',
    itemSlug: 'wear-thermal-top',
    category: 'clothing',
    priority: 'critical',
    quantityStrategy: 'per_person_per_day',
    generatedQuantity: 4,
    effectiveQuantity: 4,
    packedQuantity: 2, // Partial packing (2 of 4)
    isPacked: false,
    weightGrams: 200,
    isShared: false,
    isCustom: false,
    reasons: ['Cold weather core insulation'],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'item-hiking-boots',
    tripId: 'trip-alpine-101',
    name: 'Waterproof Hiking Boots',
    itemSlug: 'wear-hiking-boots',
    category: 'gear',
    priority: 'recommended',
    quantityStrategy: 'per_person',
    generatedQuantity: 2,
    effectiveQuantity: 2,
    packedQuantity: 0, // Unpacked
    isPacked: false,
    weightGrams: 1200,
    isShared: false,
    isCustom: false,
    reasons: ['Mountain trail traction & ankle support'],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'item-first-aid',
    tripId: 'trip-alpine-101',
    name: 'Compact Travel First Aid Kit',
    itemSlug: 'health-first-aid',
    category: 'health',
    priority: 'optional',
    quantityStrategy: 'fixed',
    generatedQuantity: 1,
    effectiveQuantity: 1,
    packedQuantity: 0,
    isPacked: false,
    weightGrams: 300,
    isShared: true,
    isCustom: false,
    reasons: ['Emergency field treatment'],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
]

function renderChecklist(tripId: string) {
  return renderToString(
    <MemoryRouter initialEntries={[`/trips/${tripId}`]}>
      <Routes>
        <Route path="/trips/:id" element={<ChecklistPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Packing Checklist Foundation (Slice 6.4A)', () => {
  beforeEach(async () => {
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

  describe('1. Loading & State Handling', () => {
    it('renders loading state when checklist is loading', () => {
      useChecklistStore.setState({
        tripId: 'trip-alpine-101',
        isLoading: true,
        items: [],
      })

      const html = renderChecklist('trip-alpine-101')
      expect(html).toContain('Opening Packing Journal...')
      expect(html).toContain('Retrieving journey details and checklist items')
    })

    it('renders missing trip (404) state when trip does not exist', () => {
      useTripStore.setState({
        trips: [],
        activeTrip: null,
        isLoading: false,
      })
      useChecklistStore.setState({
        tripId: 'non-existent-trip',
        isLoading: false,
        items: [],
      })

      const html = renderChecklist('non-existent-trip')
      expect(html).toContain('Journey Not Found')
      expect(html).toContain('Trip Record Unavailable')
      expect(html).toContain('Back to My Trips')
    })

    it('renders storage error state with retry option when an error occurs', () => {
      useTripStore.setState({
        trips: [],
        activeTrip: null,
        isLoading: false,
      })
      useChecklistStore.setState({
        tripId: 'trip-alpine-101',
        error: 'Database connection failed to open',
        isLoading: false,
      })

      const html = renderChecklist('trip-alpine-101')
      expect(html).toContain('Checklist Storage Error')
      expect(html).toContain('Database connection failed to open')
      expect(html).toContain('Retry Loading')
    })

    it('renders empty checklist state when trip exists but has no items', () => {
      useTripStore.setState({
        trips: [mockTrip],
        activeTrip: mockTrip,
        isLoading: false,
      })
      useChecklistStore.setState({
        tripId: 'trip-alpine-101',
        items: [],
        isLoading: false,
      })

      const html = renderChecklist('trip-alpine-101')
      expect(html).toContain('Packing Checklist is Empty')
      expect(html).toContain('There are currently no packing items recorded for this trip.')
      expect(html).toContain('Swiss Alpine Expedition')
    })
  })

  describe('2. Checklist Presentation & Grouping', () => {
    beforeEach(() => {
      useTripStore.setState({
        trips: [mockTrip],
        activeTrip: mockTrip,
        isLoading: false,
      })
      useChecklistStore.setState({
        tripId: 'trip-alpine-101',
        items: mockItems,
        isLoading: false,
      })
    })

    it('displays trip header with name, destination, and formatted dates', () => {
      const html = renderChecklist('trip-alpine-101')

      expect(html).toContain('Swiss Alpine Expedition')
      expect(html).toContain('Zermatt, Switzerland')
      expect(html).toContain('Aug 10, 2026 – Aug 17, 2026')
      expect(html).toContain('(8 days)')
    })

    it('groups packing items by category', () => {
      const html = renderChecklist('trip-alpine-101')

      expect(html).toContain('Travel Documents')
      expect(html).toContain('Passport &amp; Travel Visa')

      expect(html).toContain('Clothing &amp; Apparel')
      expect(html).toContain('Thermal Base Layer Top')

      expect(html).toContain('Outdoor &amp; Activity Gear')
      expect(html).toContain('Waterproof Hiking Boots')

      expect(html).toContain('Health &amp; Safety')
      expect(html).toContain('Compact Travel First Aid Kit')
    })

    it('distinguishes priorities with appropriate badges', () => {
      const html = renderChecklist('trip-alpine-101')

      expect(html).toContain('Critical')
      expect(html).toContain('Recommended')
      expect(html).toContain('Optional')
    })

    it('displays progress indicators for categories and overall checklist', () => {
      const html = renderChecklist('trip-alpine-101')

      // Total items: 4, Fully packed: 1 ('item-passport')
      expect(html).toContain('1 of 4 Packed (25%)')
      expect(html).toContain('1 / 1 packed') // documents category is complete
      expect(html).toContain('Complete')
    })
  })

  describe('3. Packing Interactions & Quantities (Store Integration)', () => {
    beforeEach(async () => {
      const storage = getStorageContext()
      await storage.trips.saveTripWithItems(mockTrip, mockItems)
      await useTripStore.getState().selectTrip('trip-alpine-101')
      await useChecklistStore.getState().loadItems('trip-alpine-101')
    })

    it('marks item as packed when togglePacked is invoked', async () => {
      expect(useChecklistStore.getState().items.find((i) => i.id === 'item-hiking-boots')?.isPacked).toBe(false)

      await useChecklistStore.getState().togglePacked('item-hiking-boots')

      const updated = useChecklistStore.getState().items.find((i) => i.id === 'item-hiking-boots')
      expect(updated?.isPacked).toBe(true)
      expect(updated?.packedQuantity).toBe(2)

      // Toggle back to unpacked
      await useChecklistStore.getState().togglePacked('item-hiking-boots')
      const unpacked = useChecklistStore.getState().items.find((i) => i.id === 'item-hiking-boots')
      expect(unpacked?.isPacked).toBe(false)
      expect(unpacked?.packedQuantity).toBe(0)
    })

    it('supports partial packing via setPackedQuantity', async () => {
      const item = useChecklistStore.getState().items.find((i) => i.id === 'item-thermal-top')
      expect(item?.effectiveQuantity).toBe(4)
      expect(item?.packedQuantity).toBe(2)
      expect(item?.isPacked).toBe(false)

      // Set to 3
      await useChecklistStore.getState().setPackedQuantity('item-thermal-top', 3)
      let updated = useChecklistStore.getState().items.find((i) => i.id === 'item-thermal-top')
      expect(updated?.packedQuantity).toBe(3)
      expect(updated?.isPacked).toBe(false)

      // Set to 4 (fully packed)
      await useChecklistStore.getState().setPackedQuantity('item-thermal-top', 4)
      updated = useChecklistStore.getState().items.find((i) => i.id === 'item-thermal-top')
      expect(updated?.packedQuantity).toBe(4)
      expect(updated?.isPacked).toBe(true)
    })

    it('clamps packed quantity so it cannot exceed effective quantity or fall below 0', async () => {
      // Try to exceed effectiveQuantity (4)
      await useChecklistStore.getState().setPackedQuantity('item-thermal-top', 10)
      let item = useChecklistStore.getState().items.find((i) => i.id === 'item-thermal-top')
      expect(item?.packedQuantity).toBe(4)

      // Try negative quantity
      await useChecklistStore.getState().setPackedQuantity('item-thermal-top', -5)
      item = useChecklistStore.getState().items.find((i) => i.id === 'item-thermal-top')
      expect(item?.packedQuantity).toBe(0)
      expect(item?.isPacked).toBe(false)
    })

    it('renders partial packing state and stepper counts in HTML', () => {
      const html = renderChecklist('trip-alpine-101')

      // Thermal top is partially packed (2/4)
      expect(html).toContain('Partial (2/4)')
      expect(html).toContain('2 / 4')
    })
  })

  describe('4. Stale Response Protection', () => {
    it('does not display items from another trip if route ID does not match store tripId', () => {
      useTripStore.setState({
        trips: [mockTrip],
        activeTrip: mockTrip,
        isLoading: false,
      })
      // Store has items from trip-alpine-101, but route requested trip-rome-202
      useChecklistStore.setState({
        tripId: 'trip-alpine-101',
        items: mockItems,
        isLoading: false,
      })

      const html = renderChecklist('trip-rome-202')

      // Should not render items from trip-alpine-101
      expect(html).not.toContain('Passport & Travel Visa')
      expect(html).not.toContain('Waterproof Hiking Boots')
    })
  })
})
