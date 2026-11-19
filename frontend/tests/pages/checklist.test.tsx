import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useTripStore } from '../../src/stores/tripStore'
import { useChecklistStore } from '../../src/stores/checklistStore'
import { ChecklistPage } from '../../src/pages/ChecklistPage'
import { createStorageContext, getStorageContext } from '../../src/db/factory'
import type { Trip, PackingItem, DismissedItemRecord } from '../../src/types'

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

describe('Packing Checklist Foundation & Item Management (Slices 6.4A & 6.4B)', () => {
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
        dismissedRecords: [],
        isLoading: false,
      })

      const html = renderChecklist('trip-alpine-101')
      expect(html).toContain('Packing Checklist is Empty')
      expect(html).toContain('There are currently no packing items recorded for this trip.')
      expect(html).toContain('Swiss Alpine Expedition')
      expect(html).toContain('Add Custom Item')
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
        dismissedRecords: [],
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

  describe('4. Custom Item Creation (Slice 6.4B)', () => {
    beforeEach(async () => {
      const storage = getStorageContext()
      await storage.trips.saveTripWithItems(mockTrip, mockItems)
      await useTripStore.getState().selectTrip('trip-alpine-101')
      await useChecklistStore.getState().loadItems('trip-alpine-101')
    })

    it('adds a custom item with user-defined attributes and persists it', async () => {
      const added = await useChecklistStore.getState().addCustomItem({
        name: 'UV Glacier Sunglasses',
        category: 'gear',
        priority: 'critical',
        quantity: 1,
        weightGrams: 85,
        notes: 'Category 4 UV polarized lens',
      })

      expect(added.id).toBeDefined()
      expect(added.name).toBe('UV Glacier Sunglasses')
      expect(added.isCustom).toBe(true)
      expect(added.priority).toBe('critical')
      expect(added.effectiveQuantity).toBe(1)
      expect(added.weightGrams).toBe(85)
      expect(added.notes).toBe('Category 4 UV polarized lens')

      // Verify in store state
      const itemsInStore = useChecklistStore.getState().items
      expect(itemsInStore.some((i) => i.name === 'UV Glacier Sunglasses')).toBe(true)

      // Verify in storage repository
      const storage = getStorageContext()
      const persisted = await storage.items.getItemById(added.id)
      expect(persisted).not.toBeNull()
      expect(persisted?.name).toBe('UV Glacier Sunglasses')
      expect(persisted?.isCustom).toBe(true)
    })

    it('renders the custom item badge in the checklist', () => {
      useTripStore.setState({ trips: [mockTrip], activeTrip: mockTrip })
      useChecklistStore.setState({
        tripId: 'trip-alpine-101',
        items: [
          ...mockItems,
          {
            id: 'item-custom-1',
            tripId: 'trip-alpine-101',
            name: 'Journal Notebook',
            itemSlug: 'custom-journal',
            category: 'miscellaneous',
            priority: 'optional',
            quantityStrategy: 'user_defined',
            generatedQuantity: 1,
            effectiveQuantity: 1,
            packedQuantity: 0,
            isPacked: false,
            isCustom: true,
            isShared: false,
            reasons: ['User-added custom travel item'],
            createdAt: '2026-08-01T10:00:00.000Z',
            updatedAt: '2026-08-01T10:00:00.000Z',
          },
        ],
      })

      const html = renderChecklist('trip-alpine-101')
      expect(html).toContain('Journal Notebook')
      expect(html).toContain('Custom')
    })
  })

  describe('5. Editing Existing Items & Clamping (Slice 6.4B)', () => {
    beforeEach(async () => {
      const storage = getStorageContext()
      await storage.trips.saveTripWithItems(mockTrip, mockItems)
      await useTripStore.getState().selectTrip('trip-alpine-101')
      await useChecklistStore.getState().loadItems('trip-alpine-101')
    })

    it('updates item name, category, priority, and quantity cleanly', async () => {
      const updated = await useChecklistStore.getState().updateItem('item-hiking-boots', {
        name: 'Heavy Mountaineering Crampons',
        category: 'gear',
        priority: 'critical',
        quantity: 3,
        weightGrams: 900,
        notes: '12-point steel crampons',
      })

      expect(updated?.name).toBe('Heavy Mountaineering Crampons')
      expect(updated?.priority).toBe('critical')
      expect(updated?.effectiveQuantity).toBe(3)
      expect(updated?.userAdjustedQuantity).toBe(3)
      expect(updated?.weightGrams).toBe(900)
      expect(updated?.notes).toBe('12-point steel crampons')

      // Verify in store
      const inStore = useChecklistStore.getState().items.find((i) => i.id === 'item-hiking-boots')
      expect(inStore?.name).toBe('Heavy Mountaineering Crampons')
      expect(inStore?.priority).toBe('critical')

      // Verify in storage
      const storage = getStorageContext()
      const inStorage = await storage.items.getItemById('item-hiking-boots')
      expect(inStorage?.name).toBe('Heavy Mountaineering Crampons')
    })

    it('clamps packed quantity when effective quantity decreases below packed quantity', async () => {
      // Thermal top currently has effectiveQuantity: 4, packedQuantity: 2
      // Pack 3 items
      await useChecklistStore.getState().setPackedQuantity('item-thermal-top', 3)
      expect(useChecklistStore.getState().items.find((i) => i.id === 'item-thermal-top')?.packedQuantity).toBe(3)

      // Decrease effective quantity to 2
      await useChecklistStore.getState().updateItem('item-thermal-top', {
        quantity: 2,
      })

      const item = useChecklistStore.getState().items.find((i) => i.id === 'item-thermal-top')
      expect(item?.effectiveQuantity).toBe(2)
      // Packed quantity must be clamped to 2 (cannot exceed new effective quantity)
      expect(item?.packedQuantity).toBe(2)
      expect(item?.isPacked).toBe(true) // 2 / 2 is fully packed
    })
  })

  describe('6. Delete Custom Items vs Dismiss Generated Recommendations (Slice 6.4B)', () => {
    beforeEach(async () => {
      const storage = getStorageContext()
      await storage.trips.saveTripWithItems(mockTrip, mockItems)
      await useTripStore.getState().selectTrip('trip-alpine-101')
      await useChecklistStore.getState().loadItems('trip-alpine-101')
    })

    it('permanently deletes custom items from store and database', async () => {
      const customItem = await useChecklistStore.getState().addCustomItem({
        name: 'Disposable Rain Poncho',
        category: 'clothing',
        priority: 'optional',
        quantity: 2,
      })

      expect(useChecklistStore.getState().items.some((i) => i.id === customItem.id)).toBe(true)

      // Delete custom item
      await useChecklistStore.getState().deleteItem(customItem.id)

      expect(useChecklistStore.getState().items.some((i) => i.id === customItem.id)).toBe(false)
      const storage = getStorageContext()
      const persisted = await storage.items.getItemById(customItem.id)
      expect(persisted).toBeNull()

      // Ensure it was NOT added to dismissed records
      expect(useChecklistStore.getState().dismissedRecords.some((d) => d.itemSlug === customItem.itemSlug)).toBe(false)
    })

    it('dismisses generated items by moving them to dismissed records with full snapshots', async () => {
      const dismissed = await useChecklistStore.getState().dismissItem('item-first-aid')

      expect(dismissed.itemSlug).toBe('health-first-aid')
      expect(dismissed.name).toBe('Compact Travel First Aid Kit')
      expect(dismissed.originalItemSnapshot).toBeDefined()
      expect(dismissed.originalItemSnapshot.id).toBe('item-first-aid')

      // Active items no longer contains first-aid
      expect(useChecklistStore.getState().items.some((i) => i.id === 'item-first-aid')).toBe(false)

      // Dismissed records contains the snapshot
      expect(useChecklistStore.getState().dismissedRecords.some((d) => d.itemSlug === 'health-first-aid')).toBe(true)

      // Storage trip contains dismissed item
      const storage = getStorageContext()
      const trip = await storage.trips.getTripById('trip-alpine-101')
      expect(trip?.dismissedItems.some((d) => d.itemSlug === 'health-first-aid')).toBe(true)
    })
  })

  describe('7. Dismissed Essentials Section & Restoration (Slice 6.4B)', () => {
    const mockDismissedRecord: DismissedItemRecord = {
      itemSlug: 'health-first-aid',
      name: 'Compact Travel First Aid Kit',
      category: 'health',
      priority: 'optional',
      reasons: ['Emergency field treatment'],
      dismissedAt: '2026-08-02T10:00:00.000Z',
      originalItemSnapshot: {
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
    }

    it('renders empty dismissed section when no items are dismissed', () => {
      useTripStore.setState({ trips: [mockTrip], activeTrip: mockTrip })
      useChecklistStore.setState({
        tripId: 'trip-alpine-101',
        items: mockItems,
        dismissedRecords: [],
      })

      const html = renderChecklist('trip-alpine-101')
      expect(html).toContain('Dismissed Items')
      expect(html).toContain('No dismissed items. All recommended essentials remain active in your packing checklist.')
    })

    it('renders dismissed item cards with restore button when items are dismissed', () => {
      useTripStore.setState({ trips: [mockTrip], activeTrip: mockTrip })
      useChecklistStore.setState({
        tripId: 'trip-alpine-101',
        items: mockItems.filter((i) => i.id !== 'item-first-aid'),
        dismissedRecords: [mockDismissedRecord],
      })

      const html = renderChecklist('trip-alpine-101')
      expect(html).toContain('Dismissed Items')
      expect(html).toContain('Compact Travel First Aid Kit')
      expect(html).toContain('Restore')
    })

    it('displays critical dismissed warning badge when critical essentials are dismissed', () => {
      const criticalDismissed: DismissedItemRecord = {
        itemSlug: 'doc-passport',
        name: 'Passport & Travel Visa',
        category: 'documents',
        priority: 'critical',
        reasons: ['Mandatory international identification'],
        dismissedAt: '2026-08-02T10:00:00.000Z',
        originalItemSnapshot: mockItems[0],
      }

      useTripStore.setState({ trips: [mockTrip], activeTrip: mockTrip })
      useChecklistStore.setState({
        tripId: 'trip-alpine-101',
        items: mockItems.filter((i) => i.id !== 'item-passport'),
        dismissedRecords: [criticalDismissed],
      })

      const html = renderChecklist('trip-alpine-101')
      expect(html).toContain('1 Critical Dismissed')
    })

    it('restores dismissed item from snapshot back into active checklist and clears dismissed record', async () => {
      const storage = getStorageContext()
      const tripWithDismissed = {
        ...mockTrip,
        dismissedItems: [mockDismissedRecord],
      }
      await storage.trips.saveTripWithItems(
        tripWithDismissed,
        mockItems.filter((i) => i.id !== 'item-first-aid')
      )
      await useTripStore.getState().selectTrip('trip-alpine-101')
      await useChecklistStore.getState().loadItems('trip-alpine-101')

      expect(useChecklistStore.getState().dismissedRecords.length).toBe(1)
      expect(useChecklistStore.getState().items.some((i) => i.id === 'item-first-aid')).toBe(false)

      // Restore
      const restored = await useChecklistStore.getState().restoreDismissedItem('health-first-aid')

      expect(restored.id).toBe('item-first-aid')
      expect(restored.name).toBe('Compact Travel First Aid Kit')

      // Active items now contains restored item
      expect(useChecklistStore.getState().items.some((i) => i.id === 'item-first-aid')).toBe(true)

      // Dismissed records in store no longer contains the record
      expect(useChecklistStore.getState().dismissedRecords.some((d) => d.itemSlug === 'health-first-aid')).toBe(false)

      // Trip in storage has dismissed record removed
      const updatedTrip = await storage.trips.getTripById('trip-alpine-101')
      expect(updatedTrip?.dismissedItems.some((d) => d.itemSlug === 'health-first-aid')).toBe(false)
    })
  })

  describe('8. Stale Response Protection', () => {
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
      expect(html).not.toContain('Passport &amp; Travel Visa')
      expect(html).not.toContain('Waterproof Hiking Boots')
    })
  })

  describe('9. Readiness Scoring & Category Progress (Slice 6.4C-A)', () => {
    beforeEach(async () => {
      const storage = getStorageContext()
      await storage.items.deleteItemsForTrip('trip-alpine-101')
      await storage.trips.saveTripWithItems(mockTrip, mockItems)
      await useTripStore.getState().selectTrip('trip-alpine-101')
      await useChecklistStore.getState().loadItems('trip-alpine-101')
    })

    it('renders overall readiness widget with weighted score, points ratio, and progress gauge', () => {
      const html = renderChecklist('trip-alpine-101')

      // Weighted readiness:
      // Passport (critical): 3 pts (2/2)
      // Thermal top (critical): 1.5 pts (2/4 partial)
      // Hiking boots (recommended): 0 pts (0/2)
      // First aid kit (optional): 0 pts (0/1)
      // Total: 4.5 / 9 points = 50%
      expect(html).toContain('Packing Readiness')
      expect(html).toContain('50%')
      expect(html).toContain('4.5 / 9 points')
      expect(html).toContain('1 of 4 items fully packed')
      expect(html).toContain('Needs Attention')
      expect(html).toContain('1 critical travel essential remaining')
      expect(html).toContain('Overall packing readiness score')
    })

    it('supports partial packing with proportional points in overall readiness', async () => {
      // Initially thermal top is 2 of 4 (1.5 pts) -> 50%
      let html = renderChecklist('trip-alpine-101')
      expect(html).toContain('4.5 / 9 points')
      expect(html).toContain('50%')

      // Set thermal top to 4 of 4 (fully packed -> 3 pts)
      await useChecklistStore.getState().setPackedQuantity('item-thermal-top', 4)

      // Total packed points: 3 + 3 = 6 / 9 points = 67%
      html = renderChecklist('trip-alpine-101')
      expect(html).toContain('6 / 9 points')
      expect(html).toContain('67%')
      // Critical item is fully packed, so no outstanding critical remaining
      expect(html).not.toContain('critical travel essential remaining')
      expect(html).toContain('In Progress')
    })

    it('renders category-wise readiness percentages and progress bars', () => {
      const html = renderChecklist('trip-alpine-101')

      // Documents category: Passport fully packed -> 100%
      expect(html).toContain('100% • 1 / 1 packed')
      expect(html).toContain('Complete')

      // Clothing category: Thermal top 2 of 4 packed -> 50%
      expect(html).toContain('50% • 0 / 1 packed')

      // Gear category: Hiking boots unpacked -> 0%
      expect(html).toContain('0% • 0 / 1 packed')

      // Health category: First aid kit unpacked -> 0%
      expect(html).toContain('Health &amp; Safety')
    })

    it('displays 0% readiness on an empty checklist', async () => {
      const emptyTrip: Trip = {
        ...mockTrip,
        id: 'trip-empty-readiness',
        name: 'Empty Readiness Journey',
      }
      const storage = getStorageContext()
      await storage.trips.saveTripWithItems(emptyTrip, [])
      await useTripStore.getState().selectTrip('trip-empty-readiness')
      await useChecklistStore.getState().loadItems('trip-empty-readiness')

      const html = renderChecklist('trip-empty-readiness')
      expect(html).toContain('Packing Checklist is Empty')
      expect(html).toContain('0% Readiness')
      expect(html).toContain('0 / 0 points')
    })

    it('excludes dismissed optional items from denominator without score penalty', async () => {
      // Dismiss optional first aid kit (1 point)
      await useChecklistStore.getState().dismissItem('item-first-aid')

      // Pack passport (3 pts), thermal top (3 pts), hiking boots (2 pts)
      await useChecklistStore.getState().setPackedQuantity('item-thermal-top', 4)
      await useChecklistStore.getState().setPackedQuantity('item-hiking-boots', 2)

      // Denominator should now be 3 + 3 + 2 = 8 points (optional item excluded)
      // Total packed points = 8 / 8 = 100%
      const html = renderChecklist('trip-alpine-101')
      expect(html).toContain('8 / 8 points')
      expect(html).toContain('100%')
      expect(html).toContain('Ready for Adventure')
    })

    it('prevents Ready for Adventure status when a critical essential is dismissed', async () => {
      // Pack passport (3 pts), hiking boots (2 pts), first aid (1 pt)
      await useChecklistStore.getState().setPackedQuantity('item-hiking-boots', 2)
      await useChecklistStore.getState().setPackedQuantity('item-first-aid', 1)

      // Dismiss critical thermal top
      await useChecklistStore.getState().dismissItem('item-thermal-top')

      // Active items total: 3 + 2 + 1 = 6 points, all packed -> 100%
      const html = renderChecklist('trip-alpine-101')
      expect(html).toContain('100%')
      expect(html).toContain('6 / 6 points')
      // Crucial safety check: MUST NOT say Ready for Adventure!
      expect(html).not.toContain('Ready for Adventure')
      expect(html).toContain('Needs Attention')
      expect(html).toContain('1 critical travel essential dismissed')
    })

    it('reactively updates readiness score after packing, editing, dismissal and restoration', async () => {
      // 1. Initial: 4.5 / 9 points = 50%
      let html = renderChecklist('trip-alpine-101')
      expect(html).toContain('50%')

      // 2. Pack boots (2 pts) -> 6.5 / 9 points = 72%
      await useChecklistStore.getState().setPackedQuantity('item-hiking-boots', 2)
      html = renderChecklist('trip-alpine-101')
      expect(html).toContain('6.5 / 9 points')
      expect(html).toContain('72%')

      // 3. Dismiss critical thermal top
      await useChecklistStore.getState().dismissItem('item-thermal-top')
      html = renderChecklist('trip-alpine-101')
      expect(html).toContain('1 critical travel essential dismissed')

      // 4. Restore dismissed thermal top
      await useChecklistStore.getState().restoreDismissedItem('wear-thermal-top')
      html = renderChecklist('trip-alpine-101')
      expect(html).toContain('Thermal Base Layer Top')
      expect(html).not.toContain('1 critical travel essential dismissed')
      expect(html).toContain('1 critical travel essential remaining')
    })
  })

  describe('10. Critical Missing Essentials Banner (Slice 6.4C-B)', () => {
    beforeEach(async () => {
      const storage = getStorageContext()
      await storage.items.deleteItemsForTrip('trip-alpine-101')
      await storage.trips.saveTripWithItems(mockTrip, mockItems)
      await useTripStore.getState().selectTrip('trip-alpine-101')
      await useChecklistStore.getState().loadItems('trip-alpine-101')
    })

    it('renders completely unpacked critical item in Not Packed section with Mark All Packed button', async () => {
      // Unpack passport completely
      await useChecklistStore.getState().setPackedQuantity('item-passport', 0)

      const html = renderChecklist('trip-alpine-101')

      // Banner should be visible
      expect(html).toContain('Critical Travel Essentials Requiring Action')
      expect(html).toContain('Not Packed (1)')
      expect(html).toContain('Passport &amp; Travel Visa')
      expect(html).toContain('0 / 2 packed')
      expect(html).toContain('Mark All Packed')
      expect(html).toContain('aria-label="Mark all 2 Passport &amp; Travel Visa as packed"')
    })

    it('renders partially packed critical item in Partially Packed section with Pack Remaining button', () => {
      // In mockItems, item-thermal-top is 2 of 4 (partially packed)
      const html = renderChecklist('trip-alpine-101')

      expect(html).toContain('Critical Travel Essentials Requiring Action')
      expect(html).toContain('Partially Packed (1)')
      expect(html).toContain('Thermal Base Layer Top')
      expect(html).toContain('2 of 4 packed (50%)')
      expect(html).toContain('2 remaining')
      expect(html).toContain('Pack Remaining')
      expect(html).toContain('aria-label="Pack remaining 2 Thermal Base Layer Top"')
    })

    it('renders multiple critical items across different states simultaneously', async () => {
      // 1. Passport: unpack completely (Not Packed)
      await useChecklistStore.getState().setPackedQuantity('item-passport', 0)
      // 2. Thermal top: partially packed (2 of 4, already partial)
      // 3. Add and dismiss a critical item
      const customCritical = await useChecklistStore.getState().addCustomItem({
        name: 'Prescription Inhaler',
        category: 'health',
        priority: 'critical',
        quantity: 1,
      })
      await useChecklistStore.getState().dismissItem(customCritical.id)

      const html = renderChecklist('trip-alpine-101')

      expect(html).toContain('Critical Travel Essentials Requiring Action')
      // Total count badge should show 3
      expect(html).toContain('Not Packed (1)')
      expect(html).toContain('Partially Packed (1)')
      expect(html).toContain('Dismissed Essentials (1)')
      expect(html).toContain('Prescription Inhaler')
      expect(html).toContain('Restore Essential')
    })

    it('renders dismissed critical item in Dismissed Essentials section and allows restoration', async () => {
      // Pack thermal top so it's not partial
      await useChecklistStore.getState().setPackedQuantity('item-thermal-top', 4)

      // Dismiss passport
      await useChecklistStore.getState().dismissItem('item-passport')

      let html = renderChecklist('trip-alpine-101')
      expect(html).toContain('Critical Travel Essentials Requiring Action')
      expect(html).toContain('Dismissed Essentials (1)')
      expect(html).toContain('Passport &amp; Travel Visa')
      expect(html).toContain('Dismissed Essential')
      expect(html).toContain('Restore Essential')

      // Restore passport
      await useChecklistStore.getState().restoreDismissedItem('doc-passport')

      // After restoration, passport is back in active list and not dismissed
      html = renderChecklist('trip-alpine-101')
      expect(html).not.toContain('Dismissed Essentials (1)')
    })

    it('quick-pack action marks critical item fully packed and updates readiness state', async () => {
      let html = renderChecklist('trip-alpine-101')
      expect(html).toContain('Partially Packed (1)')
      expect(html).toContain('50%')

      // Perform quick-pack action on thermal top (set to effectiveQuantity = 4)
      await useChecklistStore.getState().setPackedQuantity('item-thermal-top', 4)

      html = renderChecklist('trip-alpine-101')
      // Thermal top is now fully packed, so no critical items remain incomplete
      expect(html).not.toContain('Critical Travel Essentials Requiring Action')
      expect(html).toContain('67%')
    })

    it('banner disappears completely when all critical items are packed and none are dismissed', async () => {
      // Pack thermal top fully
      await useChecklistStore.getState().setPackedQuantity('item-thermal-top', 4)

      const html = renderChecklist('trip-alpine-101')
      // All critical items (passport & thermal top) are fully packed; 0 dismissed
      expect(html).not.toContain('Critical Travel Essentials Requiring Action')
      expect(html).not.toContain('data-testid="critical-essentials-banner"')
    })

    it('banner remains visible if a critical item is dismissed even when all active items are packed', async () => {
      // Pack all active items fully
      await useChecklistStore.getState().setPackedQuantity('item-thermal-top', 4)
      await useChecklistStore.getState().setPackedQuantity('item-hiking-boots', 2)
      await useChecklistStore.getState().setPackedQuantity('item-first-aid', 1)

      // Dismiss critical passport
      await useChecklistStore.getState().dismissItem('item-passport')

      const html = renderChecklist('trip-alpine-101')

      // All remaining active items are 100% packed, BUT critical item is dismissed!
      expect(html).toContain('100%')
      expect(html).toContain('Critical Travel Essentials Requiring Action')
      expect(html).toContain('Dismissed Essentials (1)')
      expect(html).toContain('Passport &amp; Travel Visa')
      expect(html).toContain('Restore Essential')
      expect(html).not.toContain('Ready for Adventure')
    })
  })

  describe('11. Luggage Weight UI Integration (Slice 6.4C-C3)', () => {
    beforeEach(async () => {
      const storage = getStorageContext()
      await storage.items.deleteItemsForTrip('trip-alpine-101')
      await storage.trips.saveTripWithItems(mockTrip, mockItems)
      await useTripStore.getState().selectTrip('trip-alpine-101')
      await useChecklistStore.getState().loadItems('trip-alpine-101')
    })

    it('renders luggage weight panel with cabin and checked baggage cards and combined weight', () => {
      const html = renderChecklist('trip-alpine-101')

      expect(html).toContain('data-testid="luggage-weight-panel"')
      expect(html).toContain('Luggage Weight &amp; Bag Allocation')
      expect(html).toContain('data-testid="cabin-luggage-card"')
      expect(html).toContain('data-testid="checked-luggage-card"')
      expect(html).toContain('data-testid="combined-weight-summary"')
      expect(html).toContain('Informational only (No pooled limit)')
    })

    it('displays unassigned items warning when items have no bag assignment', () => {
      // In mockItems, items have no bagAssignment
      const html = renderChecklist('trip-alpine-101')

      expect(html).toContain('data-testid="unassigned-items-warning"')
      expect(html).toContain('item(s) unassigned')
      expect(html).toContain('allocate to Cabin or Checked bag below')
    })

    it('updates panel immediately when assigning items to cabin and checked baggage', async () => {
      // Assign item-passport (2 * 50g = 100g = 0.1 kg) to cabin
      await useChecklistStore.getState().setBagAssignment('item-passport', 'cabin')

      // Assign item-thermal-top (4 * 200g = 800g = 0.8 kg) to checked
      await useChecklistStore.getState().setBagAssignment('item-thermal-top', 'checked')

      const html = renderChecklist('trip-alpine-101')

      // Cabin weight display: 0.1 / 8 kg
      expect(html).toContain('data-testid="cabin-weight-display"')
      expect(html).toContain('0.1 / 8 kg')
      expect(html).toContain('7.9 kg remaining')

      // Checked weight display: 0.8 / 23 kg
      expect(html).toContain('data-testid="checked-weight-display"')
      expect(html).toContain('0.8 / 23 kg')
      expect(html).toContain('22.2 kg remaining')

      // Check item row bag buttons reflect state
      expect(html).toContain('data-testid="assign-cabin-item-passport"')
      expect(html).toContain('data-testid="assign-checked-item-thermal-top"')
    })

    it('shows independent capacity warnings when cabin limit is exceeded', async () => {
      // Add a heavy item assigned to cabin (10 kg vs 8 kg limit)
      await useChecklistStore.getState().addCustomItem({
        name: 'Heavy Photography Kit',
        category: 'electronics',
        quantity: 1,
        weightGrams: 10000, // 10.0 kg
        bagAssignment: 'cabin',
      })

      const html = renderChecklist('trip-alpine-101')

      // Cabin exceeded warning
      expect(html).toContain('data-testid="cabin-exceeded-warning"')
      expect(html).toContain('Exceeds limit by 2 kg!')

      // Checked baggage remains normal (not exceeded)
      expect(html).not.toContain('data-testid="checked-exceeded-warning"')
      expect(html).toContain('23 kg remaining')
    })

    it('shows independent capacity warnings when checked limit is exceeded', async () => {
      // Add a heavy checked item (25 kg vs 23 kg limit)
      await useChecklistStore.getState().addCustomItem({
        name: 'Expedition Tent Hardware',
        category: 'gear',
        quantity: 1,
        weightGrams: 25000, // 25.0 kg
        bagAssignment: 'checked',
      })

      const html = renderChecklist('trip-alpine-101')

      // Checked exceeded warning
      expect(html).toContain('data-testid="checked-exceeded-warning"')
      expect(html).toContain('Exceeds limit by 2 kg!')

      // Cabin baggage remains normal (not exceeded)
      expect(html).not.toContain('data-testid="cabin-exceeded-warning"')
    })

    it('displays warning when items have unknown weight', async () => {
      // Add custom item with unknown weight (undefined)
      await useChecklistStore.getState().addCustomItem({
        name: 'Local Souvenir Woodwork',
        category: 'miscellaneous',
        quantity: 2,
        weightGrams: undefined,
        bagAssignment: 'cabin',
      })

      const html = renderChecklist('trip-alpine-101')

      expect(html).toContain('data-testid="unknown-weights-warning"')
      expect(html).toContain('have unknown weight')
      expect(html).toContain('excluded from baggage weight calculations')
      expect(html).toContain('cabin item(s) have unestimated weight')
    })

    it('displays disabled baggage type as Not Configured without silently reassigning items', async () => {
      // Trip where checked baggage is disabled
      const tripWithoutChecked: Trip = {
        ...mockTrip,
        id: 'trip-cabin-only',
        baggageConfig: {
          hasCabinBaggage: true,
          cabinWeightLimitKg: 7.0,
          hasCheckedBaggage: false,
          checkedWeightLimitKg: 23.0,
        },
      }
      const storage = getStorageContext()
      await storage.trips.saveTripWithItems(tripWithoutChecked, [
        {
          ...mockItems[0],
          tripId: 'trip-cabin-only',
          bagAssignment: 'checked', // Item assigned to checked, but checked is disabled!
        },
      ])
      await useTripStore.getState().selectTrip('trip-cabin-only')
      await useChecklistStore.getState().loadItems('trip-cabin-only')

      const html = renderChecklist('trip-cabin-only')

      expect(html).toContain('data-testid="checked-luggage-card"')
      expect(html).toContain('Not Configured')
      expect(html).toContain('Checked baggage is not configured for this trip')
      expect(html).toContain('Warning: 1 item(s) allocated to unconfigured checked baggage')

      // Confirm checked button on item row is disabled
      expect(html).toContain('disabled=""')
      expect(html).toContain('Checked baggage is not configured for this trip')
    })

    it('persists bag assignments across store reload', async () => {
      await useChecklistStore.getState().setBagAssignment('item-passport', 'cabin')
      await useChecklistStore.getState().setBagAssignment('item-thermal-top', 'checked')

      // Simulate full page refresh / reload
      useChecklistStore.setState({ items: [], tripId: null })
      await useChecklistStore.getState().loadItems('trip-alpine-101')

      const html = renderChecklist('trip-alpine-101')

      expect(html).toContain('0.1 / 8 kg')
      expect(html).toContain('0.8 / 23 kg')
    })

    it('supports bag assignment and explicit unassignment in add and edit modals', async () => {
      // 1. Add item with bag assignment via store action (which modals call)
      const newItem = await useChecklistStore.getState().addCustomItem({
        name: 'Travel Journal',
        category: 'miscellaneous',
        quantity: 1,
        weightGrams: 200,
        bagAssignment: 'cabin',
      })
      expect(newItem.bagAssignment).toBe('cabin')

      let html = renderChecklist('trip-alpine-101')
      expect(html).toContain('Travel Journal')

      // 2. Edit item to change bag assignment to checked
      const updatedItem = await useChecklistStore.getState().updateItem(newItem.id, {
        bagAssignment: 'checked',
      })
      expect(updatedItem?.bagAssignment).toBe('checked')

      // 3. Edit item to explicitly unassign
      const unassignedItem = await useChecklistStore.getState().updateItem(newItem.id, {
        bagAssignment: undefined,
      })
      expect(unassignedItem?.bagAssignment).toBeUndefined()

      html = renderChecklist('trip-alpine-101')
      expect(html).toContain('data-testid="unassigned-items-warning"')
    })
  })
})
