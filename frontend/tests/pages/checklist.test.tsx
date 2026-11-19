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
})
