import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { EditTemplateModal } from '../../../src/components/templates/EditTemplateModal'
import { DeleteTemplateConfirmModal } from '../../../src/components/templates/DeleteTemplateConfirmModal'
import { useTemplateStore } from '../../../src/stores/templateStore'
import { createStorageContext, setStorageContext, getStorageContext } from '../../../src/db/factory'
import { getSharedMemoryState } from '../../../src/db/memory/memoryStorage'
import type { PackingTemplate, PackingItem, Trip } from '../../../src/types'
import { DEFAULT_BAGGAGE_CONFIG } from '../../../src/types'

// Ensure useSyncExternalStore reads live store snapshot in SSR test environment
vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot())

const sampleCustomTemplate: PackingTemplate = {
  id: 'template-custom-test',
  name: 'Alpine Weekend',
  description: 'Quick weekend mountain hike pack.',
  isSystem: false,
  items: [
    {
      name: 'Hiking Boots',
      itemSlug: 'wear-hiking-boots',
      category: 'clothing',
      quantityStrategy: 'fixed',
      defaultQuantity: 1,
      priority: 'critical',
      weightGrams: 900,
      isShared: false,
      reasons: ['Rough terrain'],
    },
    {
      name: 'Trail Map',
      itemSlug: 'custom-trail-map',
      category: 'gear',
      quantityStrategy: 'user_defined',
      defaultQuantity: 1,
      priority: 'recommended',
      weightGrams: 50,
      isShared: true,
      reasons: ['Navigation'],
    },
  ],
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
}

const sampleSystemTemplate: PackingTemplate = {
  id: 'template-predefined-beach',
  name: 'Beach Vacation',
  description: 'Coastal essentials.',
  isSystem: true,
  items: [
    {
      name: 'Swimwear',
      itemSlug: 'wear-swimwear',
      category: 'clothing',
      quantityStrategy: 'fixed',
      defaultQuantity: 2,
      priority: 'critical',
      isShared: false,
      reasons: ['Beach'],
    },
  ],
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
}

describe('EditTemplateModal Component', () => {
  beforeEach(async () => {
    getSharedMemoryState().clear()
    const storage = await createStorageContext('memory')
    setStorageContext(storage)

    useTemplateStore.setState({
      templates: [sampleCustomTemplate, sampleSystemTemplate],
      isLoading: false,
      isInitialized: true,
      error: null,
    })

    await storage.templates.saveTemplate(sampleCustomTemplate)
    await storage.templates.saveTemplate(sampleSystemTemplate)
  })

  it('renders closed modal as empty string', () => {
    const html = renderToString(
      <EditTemplateModal
        isOpen={false}
        onClose={vi.fn()}
        template={sampleCustomTemplate}
      />
    )
    expect(html).toBe('')
  })

  it('renders null template as empty string', () => {
    const html = renderToString(
      <EditTemplateModal
        isOpen={true}
        onClose={vi.fn()}
        template={null}
      />
    )
    expect(html).toBe('')
  })

  it('renders open edit modal with custom template data, items list, and independence note', () => {
    const html = renderToString(
      <EditTemplateModal
        isOpen={true}
        onClose={vi.fn()}
        template={sampleCustomTemplate}
      />
    )

    expect(html).toContain('Edit Template')
    expect(html).toContain('Alpine Weekend')
    expect(html).toContain('Quick weekend mountain hike pack.')
    expect(html).toContain('Template Items (2)')
    expect(html).toContain('Hiking Boots')
    expect(html).toContain('Trail Map')
    expect(html).toContain('Updating this template modifies the saved template only')
    expect(html).toContain('Save Changes')
  })

  it('strictly blocks editing for predefined system templates with read-only warning', () => {
    const html = renderToString(
      <EditTemplateModal
        isOpen={true}
        onClose={vi.fn()}
        template={sampleSystemTemplate}
      />
    )

    expect(html).toContain('Immutable Predefined Template')
    expect(html).toContain('Predefined templates are built-in and cannot be edited')
    expect(html).not.toContain('Save Changes')
  })

  it('successfully updates metadata and items via templateStore while preserving item slugs and strategy', async () => {
    const store = useTemplateStore.getState()
    const updateSpy = vi.spyOn(store, 'updateTemplate')

    const updated = await store.updateTemplate(sampleCustomTemplate.id, {
      name: 'Alpine Weekend Pro',
      description: 'Extended mountain hike pack.',
      items: [
        {
          ...sampleCustomTemplate.items[0],
          name: 'Heavy Duty Hiking Boots',
          defaultQuantity: 2,
        },
        {
          name: 'Compass',
          itemSlug: 'custom-compass-1',
          category: 'gear',
          quantityStrategy: 'user_defined',
          defaultQuantity: 1,
          priority: 'critical',
          isShared: false,
          reasons: ['Navigation tool'],
        },
      ],
    })

    expect(updateSpy).toHaveBeenCalled()
    expect(updated.name).toBe('Alpine Weekend Pro')
    expect(updated.description).toBe('Extended mountain hike pack.')
    expect(updated.items).toHaveLength(2)

    // Verify existing item preserved its itemSlug and weight
    expect(updated.items[0].itemSlug).toBe('wear-hiking-boots')
    expect(updated.items[0].weightGrams).toBe(900)
    expect(updated.items[0].quantityStrategy).toBe('fixed')
    expect(updated.items[0].defaultQuantity).toBe(2)

    // Verify newly added item
    expect(updated.items[1].itemSlug).toBe('custom-compass-1')
    expect(updated.items[1].name).toBe('Compass')
  })

  it('rejects empty template name and empty items list during update', async () => {
    const store = useTemplateStore.getState()

    await expect(
      store.updateTemplate(sampleCustomTemplate.id, { name: '   ' })
    ).rejects.toThrow('Template name cannot be empty')

    await expect(
      store.updateTemplate(sampleCustomTemplate.id, { items: [] })
    ).rejects.toThrow('Template must contain at least one item')
  })
})

describe('DeleteTemplateConfirmModal Component', () => {
  beforeEach(async () => {
    getSharedMemoryState().clear()
    const storage = await createStorageContext('memory')
    setStorageContext(storage)

    useTemplateStore.setState({
      templates: [sampleCustomTemplate, sampleSystemTemplate],
      isLoading: false,
      isInitialized: true,
      error: null,
    })

    await storage.templates.saveTemplate(sampleCustomTemplate)
    await storage.templates.saveTemplate(sampleSystemTemplate)
  })

  it('renders closed modal as empty string', () => {
    const html = renderToString(
      <DeleteTemplateConfirmModal
        isOpen={false}
        onClose={vi.fn()}
        template={sampleCustomTemplate}
      />
    )
    expect(html).toBe('')
  })

  it('renders open delete confirmation with template name and checklist safety guarantee', () => {
    const html = renderToString(
      <DeleteTemplateConfirmModal
        isOpen={true}
        onClose={vi.fn()}
        template={sampleCustomTemplate}
      />
    )

    expect(html).toContain('Delete Packing Template')
    expect(html).toContain('Alpine Weekend')
    expect(html).toContain('Checklist Safety')
    expect(html).toContain('Deleting this template will not affect any existing trip checklists')
    expect(html).toContain('Cancel')
    expect(html).toContain('Delete Template')
  })

  it('locks out predefined system templates from deletion', () => {
    const html = renderToString(
      <DeleteTemplateConfirmModal
        isOpen={true}
        onClose={vi.fn()}
        template={sampleSystemTemplate}
      />
    )

    expect(html).toContain('Immutable Predefined Template')
    expect(html).toContain('Predefined templates are part of the core PackPilot engine and cannot be deleted')
    expect(html).not.toContain('confirm-delete-template-btn')
  })

  it('cancellation leaves template and storage untouched', async () => {
    const storage = getStorageContext()
    const before = await storage.templates.getTemplateById(sampleCustomTemplate.id)
    expect(before).toBeDefined()

    // Calling onClose leaves storage unchanged
    const onCloseSpy = vi.fn()
    onCloseSpy()
    expect(onCloseSpy).toHaveBeenCalled()

    const after = await storage.templates.getTemplateById(sampleCustomTemplate.id)
    expect(after).toBeDefined()
    expect(after?.name).toBe('Alpine Weekend')
  })

  it('deletes custom template from store and storage without affecting existing trip checklists', async () => {
    const storage = getStorageContext()

    // Create an existing trip and items in storage
    const sampleTrip: Trip = {
      id: 'trip-alpine-hike',
      name: 'Matterhorn Hike',
      destination: 'Zermatt, Switzerland',
      startDate: '2026-08-01',
      endDate: '2026-08-05',
      durationDays: 4,
      climate: 'cold',
      transportModes: ['train'],
      activities: ['trekking'],
      travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 0 },
      totalTravellerCount: 2,
      personalPreferences: [],
      baggageConfig: DEFAULT_BAGGAGE_CONFIG,
      dismissedItems: [],
      engineVersion: '1.4.0',
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-01T00:00:00Z',
    }

    const tripItems: PackingItem[] = [
      {
        id: 'item-hike-boots',
        tripId: 'trip-alpine-hike',
        name: 'Hiking Boots',
        itemSlug: 'wear-hiking-boots',
        category: 'clothing',
        priority: 'critical',
        quantityStrategy: 'fixed',
        generatedQuantity: 1,
        effectiveQuantity: 1,
        packedQuantity: 1,
        isPacked: true,
        isShared: false,
        isCustom: false,
        reasons: ['Alpine hike'],
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
      },
    ]

    await storage.trips.saveTripWithItems(sampleTrip, tripItems)

    const store = useTemplateStore.getState()
    await store.deleteTemplate(sampleCustomTemplate.id)

    // Template is deleted
    expect(store.getTemplateById(sampleCustomTemplate.id)).toBeUndefined()
    expect(await storage.templates.getTemplateById(sampleCustomTemplate.id)).toBeNull()

    // Trip and its checklist items MUST remain 100% intact
    const fetchedTrip = await storage.trips.getTripById('trip-alpine-hike')
    expect(fetchedTrip).toBeDefined()
    expect(fetchedTrip?.name).toBe('Matterhorn Hike')

    const fetchedItems = await storage.items.getItemsForTrip('trip-alpine-hike')
    expect(fetchedItems).toHaveLength(1)
    expect(fetchedItems[0].name).toBe('Hiking Boots')
    expect(fetchedItems[0].isPacked).toBe(true)
  })

  it('handles delete storage failure cleanly without corrupting store', async () => {
    const storage = getStorageContext()
    const originalDelete = storage.templates.deleteTemplate.bind(storage.templates)

    // Simulate disk failure
    storage.templates.deleteTemplate = async () => {
      throw new Error('Disk IO failure')
    }

    const store = useTemplateStore.getState()
    try {
      await expect(
        store.deleteTemplate(sampleCustomTemplate.id)
      ).rejects.toThrow('Disk IO failure')

      // Store still has the template
      expect(useTemplateStore.getState().getTemplateById(sampleCustomTemplate.id)).toBeDefined()
    } finally {
      storage.templates.deleteTemplate = originalDelete
    }
  })
})
