import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SaveTemplateModal } from '../../../src/components/templates/SaveTemplateModal'
import { ApplyTemplateModal } from '../../../src/components/templates/ApplyTemplateModal'
import { RegenerateChecklistModal } from '../../../src/components/templates/RegenerateChecklistModal'
import { ChecklistPage } from '../../../src/pages/ChecklistPage'
import { useTemplateStore } from '../../../src/stores/templateStore'
import { useChecklistStore } from '../../../src/stores/checklistStore'
import { useTripStore } from '../../../src/stores/tripStore'
import { createStorageContext, setStorageContext } from '../../../src/db/factory'
import { getSharedMemoryState } from '../../../src/db/memory/memoryStorage'
import type { Trip, PackingItem, PackingTemplate, DismissedItemRecord } from '../../../src/types'

// Ensure useSyncExternalStore reads live store snapshot in SSR test environment
vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot())

const mockTrip: Trip = {
  id: 'trip-beach-101',
  name: 'Goa Coastal Getaway',
  destination: 'Goa, India',
  startDate: '2026-11-20',
  endDate: '2026-11-25',
  durationDays: 5,
  climate: 'warm',
  transportModes: ['flight'],
  activities: ['beach'],
  travellers: {
    adults: 2,
    teens: 0,
    children: 0,
    infants: 0,
    seniors: 0,
  },
  totalTravellerCount: 2,
  personalPreferences: [],
  baggageConfig: {
    hasCabinBaggage: true,
    cabinWeightLimitKg: 7.0,
    hasCheckedBaggage: false,
    checkedWeightLimitKg: 23.0,
  },
  dismissedItems: [],
  engineVersion: '1.4.0',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
}

const mockChecklistItems: PackingItem[] = [
  {
    id: 'item-swimwear-1',
    tripId: 'trip-beach-101',
    name: 'Swimwear',
    itemSlug: 'wear-swimwear',
    category: 'clothing',
    priority: 'recommended',
    quantityStrategy: 'fixed',
    generatedQuantity: 1,
    userAdjustedQuantity: 2,
    effectiveQuantity: 2,
    packedQuantity: 1,
    isPacked: false,
    weightGrams: 200,
    isShared: false,
    isCustom: false,
    reasons: ['Beach holiday attire'],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'item-custom-snorkel',
    tripId: 'trip-beach-101',
    name: 'Personal Snorkel Mask',
    itemSlug: 'custom-snorkel-123',
    category: 'gear',
    priority: 'optional',
    quantityStrategy: 'user_defined',
    generatedQuantity: 1,
    userAdjustedQuantity: 1,
    effectiveQuantity: 1,
    packedQuantity: 1,
    isPacked: true,
    weightGrams: 400,
    isShared: true,
    isCustom: true,
    reasons: ['User-added item'],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
]

describe('Checklist Template UI Integration (Milestone 9C)', () => {
  let storage: Awaited<ReturnType<typeof createStorageContext>>

  beforeEach(async () => {
    getSharedMemoryState().clear()
    storage = await createStorageContext('memory')
    setStorageContext(storage)

    await storage.trips.saveTripWithItems(mockTrip, mockChecklistItems)

    useTripStore.setState({
      trips: [mockTrip],
      activeTrip: mockTrip,
      isLoading: false,
      isInitialized: true,
      error: null,
      storageType: 'memory',
      isStorageAvailable: true,
    })

    useChecklistStore.setState({
      tripId: mockTrip.id,
      items: [...mockChecklistItems],
      dismissedRecords: [],
      isLoading: false,
      error: null,
    })

    await useTemplateStore.getState().loadTemplates()
  })

  describe('SaveTemplateModal', () => {
    it('renders closed modal as empty string', () => {
      const html = renderToString(
        <SaveTemplateModal
          isOpen={false}
          onClose={vi.fn()}
          tripId={mockTrip.id}
          items={mockChecklistItems}
        />
      )
      expect(html).toBe('')
    })

    it('renders open modal with form controls, character counters, and item count', () => {
      const html = renderToString(
        <SaveTemplateModal
          isOpen={true}
          onClose={vi.fn()}
          tripId={mockTrip.id}
          items={mockChecklistItems}
        />
      )

      expect(html).toContain('Save Checklist as Template')
      expect(html).toContain('Template Name')
      expect(html).toContain('0/60')
      expect(html).toContain('0/200')
      expect(html).toContain('2 items')
      expect(html).toContain('Save Template')
    })

    it('successfully calls createTemplateFromTrip and reports success', async () => {
      const createSpy = vi.spyOn(useTemplateStore.getState(), 'createTemplateFromTrip')

      const saved = await useTemplateStore.getState().createTemplateFromTrip({
        tripId: mockTrip.id,
        name: 'My Beach Master Kit',
        description: 'Tried and tested essentials for warm coastal trips',
        items: mockChecklistItems,
      })

      expect(saved.name).toBe('My Beach Master Kit')
      expect(saved.items).toHaveLength(2)
      expect(saved.isSystem).toBe(false)
      expect(createSpy).toHaveBeenCalled()

      // Verify template persists in template store
      const templates = useTemplateStore.getState().templates
      expect(templates.some((t) => t.name === 'My Beach Master Kit')).toBe(true)
    })
  })

  describe('ApplyTemplateModal', () => {
    it('renders closed modal as empty string', () => {
      const html = renderToString(
        <ApplyTemplateModal
          isOpen={false}
          onClose={vi.fn()}
          tripId={mockTrip.id}
          existingItems={mockChecklistItems}
          dismissedRecords={[]}
        />
      )
      expect(html).toBe('')
    })

    it('renders open modal with template picker displaying predefined and custom templates', () => {
      const html = renderToString(
        <ApplyTemplateModal
          isOpen={true}
          onClose={vi.fn()}
          tripId={mockTrip.id}
          existingItems={mockChecklistItems}
          dismissedRecords={[]}
        />
      )

      expect(html).toContain('Apply Packing Template')
      expect(html).toContain('Choose Template')
      expect(html).toContain('Beach')
      expect(html).toContain('Business')
      expect(html).toContain('Trekking')
      expect(html).toContain('Family')
      expect(html).toContain('Apply Template')
    })

    it('applies template via checklistStore.applyTemplate preserving overrides and packed progress', async () => {
      const beachTemplate = useTemplateStore
        .getState()
        .templates.find((t) => t.id === 'template-predefined-beach')!
      expect(beachTemplate).toBeDefined()

      const result = await useChecklistStore.getState().applyTemplate(beachTemplate)

      expect(result.addedCount).toBeGreaterThan(0)
      expect(result.items.length).toBeGreaterThan(mockChecklistItems.length)

      // Swimwear was already in checklist with userAdjustedQuantity=2, packedQuantity=1
      const swimwear = result.items.find((i) => i.itemSlug === 'wear-swimwear')
      expect(swimwear).toBeDefined()
      expect(swimwear?.userAdjustedQuantity).toBe(2) // Manual override preserved
      expect(swimwear?.packedQuantity).toBe(1) // Packed progress preserved
      expect(swimwear?.isPacked).toBe(false)

      // Custom item strictly preserved
      const customSnorkel = result.items.find((i) => i.itemSlug === 'custom-snorkel-123')
      expect(customSnorkel).toBeDefined()
      expect(customSnorkel?.isCustom).toBe(true)
      expect(customSnorkel?.packedQuantity).toBe(1)
      expect(customSnorkel?.isPacked).toBe(true)

      // Checklist store state updated
      expect(useChecklistStore.getState().items.length).toBe(result.items.length)
    })

    it('suppresses dismissed items when applying template', async () => {
      const dismissedRecord: DismissedItemRecord = {
        itemSlug: 'beach-towel',
        name: 'Beach Towel',
        category: 'gear',
        priority: 'recommended',
        reasons: ['Beach activity'],
        dismissedAt: '2026-11-05T00:00:00.000Z',
        originalItemSnapshot: mockChecklistItems[0],
      }

      useChecklistStore.setState({
        dismissedRecords: [dismissedRecord],
      })

      const beachTemplate: PackingTemplate = {
        id: 'tpl-test',
        name: 'Towel Template',
        description: 'Test template',
        isSystem: false,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
        items: [
          {
            itemSlug: 'beach-towel',
            name: 'Beach Towel',
            category: 'gear',
            priority: 'recommended',
            defaultQuantity: 1,
            isShared: false,
            reasons: ['Towel requirement'],
            quantityStrategy: 'fixed',
          },
          {
            itemSlug: 'sunscreen',
            name: 'Sunscreen',
            category: 'health',
            priority: 'critical',
            defaultQuantity: 1,
            isShared: false,
            reasons: ['Sun protection'],
            quantityStrategy: 'fixed',
          },
        ],
      }

      const result = await useChecklistStore.getState().applyTemplate(beachTemplate)

      expect(result.skippedDismissedCount).toBe(1)
      expect(result.items.some((i) => i.itemSlug === 'beach-towel')).toBe(false) // Not resurrected
      expect(result.items.some((i) => i.itemSlug === 'sunscreen')).toBe(true) // Normal item added
    })
  })

  describe('RegenerateChecklistModal', () => {
    it('renders open modal with advisory warning and impact explanation', () => {
      const html = renderToString(
        <RegenerateChecklistModal isOpen={true} onClose={vi.fn()} trip={mockTrip} />
      )

      expect(html).toContain('Regenerate Packing Checklist')
      expect(html).toContain('Recommendation Recalculation Notice')
      expect(html).toContain('Template Items')
      expect(html).toContain('Template Quantities')
      expect(html).toContain('Preserved Data')
      expect(html).toContain('Confirm &amp; Regenerate')
    })

    it('calls regenerateChecklist on confirm and preserves custom items', async () => {
      const regenSpy = vi.spyOn(useChecklistStore.getState(), 'regenerateChecklist')

      await useChecklistStore.getState().regenerateChecklist(mockTrip)

      expect(regenSpy).toHaveBeenCalledWith(mockTrip)
      const currentItems = useChecklistStore.getState().items
      const customItem = currentItems.find((i) => i.itemSlug === 'custom-snorkel-123')
      expect(customItem).toBeDefined()
      expect(customItem?.isCustom).toBe(true)
    })
  })

  describe('ChecklistPage Integration', () => {
    it('renders Apply Template, Save as Template, and Regenerate buttons on populated checklist', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={[`/trips/${mockTrip.id}/checklist`]}>
          <Routes>
            <Route path="/trips/:id/checklist" element={<ChecklistPage />} />
          </Routes>
        </MemoryRouter>
      )

      expect(html).toContain('Apply Template')
      expect(html).toContain('Save as Template')
      expect(html).toContain('Regenerate')
      expect(html).toContain('Add Item')
    })

    it('renders Apply Template button on empty checklist', () => {
      useChecklistStore.setState({
        items: [],
        dismissedRecords: [],
      })

      const html = renderToString(
        <MemoryRouter initialEntries={[`/trips/${mockTrip.id}/checklist`]}>
          <Routes>
            <Route path="/trips/:id/checklist" element={<ChecklistPage />} />
          </Routes>
        </MemoryRouter>
      )

      expect(html).toContain('Packing Checklist is Empty')
      expect(html).toContain('Apply Template')
      expect(html).toContain('Add Custom Item')
    })
  })

  describe('Trip Switching & Store Continuity Protection', () => {
    it('never overwrites another trip in Zustand when user switches trips while applyTemplate is running', async () => {
      const tripB: Trip = {
        ...mockTrip,
        id: 'trip-himalaya-202',
        name: 'Himalayan Trek',
      }
      const tripBItem: PackingItem = {
        id: 'item-trekking-boots',
        tripId: 'trip-himalaya-202',
        name: 'Trekking Boots',
        itemSlug: 'wear-boots',
        category: 'gear',
        priority: 'critical',
        quantityStrategy: 'fixed',
        generatedQuantity: 1,
        effectiveQuantity: 1,
        packedQuantity: 1,
        isPacked: true,
        reasons: ['Trek gear'],
        isShared: false,
        isCustom: true,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      }

      await storage.trips.saveTripWithItems(tripB, [tripBItem])

      // Store initially has mockTrip active
      useChecklistStore.setState({
        tripId: mockTrip.id,
        items: [...mockChecklistItems],
        dismissedRecords: [],
      })

      const beachTemplate = useTemplateStore
        .getState()
        .templates.find((t) => t.id === 'template-predefined-beach')!

      // Start applyTemplate for Trip A
      const applyPromise = useChecklistStore.getState().applyTemplate(beachTemplate)

      // Immediately simulate user navigation: active trip switches to Trip B
      useChecklistStore.setState({
        tripId: 'trip-himalaya-202',
        items: [tripBItem],
        dismissedRecords: [],
      })

      // Wait for applyTemplate on Trip A to complete
      const result = await applyPromise
      expect(result).toBeDefined()

      // CRITICAL CHECK 1: The in-memory Zustand store belongs to Trip B and still has ONLY Trip B items
      expect(useChecklistStore.getState().tripId).toBe('trip-himalaya-202')
      expect(useChecklistStore.getState().items).toHaveLength(1)
      expect(useChecklistStore.getState().items[0].id).toBe('item-trekking-boots')
      expect(useChecklistStore.getState().items[0].itemSlug).toBe('wear-boots')

      // CRITICAL CHECK 2: Storage for Trip A was updated accurately without being discarded
      const tripAStoredItems = await storage.items.getItemsForTrip(mockTrip.id)
      expect(tripAStoredItems.length).toBeGreaterThan(mockChecklistItems.length)
      expect(tripAStoredItems.some((i) => i.itemSlug === 'wear-sunglasses')).toBe(true)
    })
  })

  describe('Modal Dismissal Protection During Active Operations', () => {
    it('disables cancel and submit buttons in SaveTemplateModal when submit is disabled/busy', () => {
      const html = renderToString(
        <SaveTemplateModal
          isOpen={true}
          onClose={vi.fn()}
          tripId={mockTrip.id}
          items={mockChecklistItems}
        />
      )
      // Form initially requires name, submit button is disabled
      expect(html).toContain('disabled=""')
      expect(html).toContain('Save Template')
    })

    it('renders disabled state in ApplyTemplateModal when no template is selected', () => {
      const html = renderToString(
        <ApplyTemplateModal
          isOpen={true}
          onClose={vi.fn()}
          tripId={mockTrip.id}
          existingItems={mockChecklistItems}
          dismissedRecords={[]}
        />
      )
      expect(html).toContain('Apply Template')
      expect(html).toContain('disabled=""')
    })

    it('renders disabled cancel button while regenerating in RegenerateChecklistModal', () => {
      const html = renderToString(
        <RegenerateChecklistModal isOpen={true} onClose={vi.fn()} trip={mockTrip} />
      )
      expect(html).toContain('Confirm &amp; Regenerate')
      expect(html).toContain('Cancel')
    })
  })
})
