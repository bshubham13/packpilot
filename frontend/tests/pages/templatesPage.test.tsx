import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { HomePage, TemplatesPage } from '../../src/pages'
import { Header } from '../../src/components/layout/Header'
import { Layout } from '../../src/components/layout'
import { useTemplateStore } from '../../src/stores/templateStore'
import { useTripStore } from '../../src/stores/tripStore'
import { createStorageContext, setStorageContext } from '../../src/db/factory'
import { getSharedMemoryState } from '../../src/db/memory/memoryStorage'
import type { PackingTemplate } from '../../src/types'

// Ensure useSyncExternalStore reads live store snapshot in SSR test environment
vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot())

const mockSystemTemplate: PackingTemplate = {
  id: 'template-predefined-beach',
  name: 'Beach Vacation',
  description: 'Essential sun protection, swimwear, coastal gear, and seaside comfort.',
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

const mockCustomTemplate: PackingTemplate = {
  id: 'template-custom-safari',
  name: 'Serengeti Safari Kit',
  description: 'Neutral tones, binoculars, telephoto lens, and dust protection.',
  isSystem: false,
  items: [
    {
      name: 'Binoculars 10x42',
      itemSlug: 'custom-binoculars',
      category: 'gear',
      quantityStrategy: 'fixed',
      defaultQuantity: 1,
      priority: 'critical',
      weightGrams: 650,
      isShared: true,
      reasons: ['Wildlife spotting'],
    },
  ],
  createdAt: '2026-11-20T12:00:00.000Z',
  updatedAt: '2026-11-20T12:00:00.000Z',
}

describe('TemplatesPage Component & Routing Integration', () => {
  beforeEach(async () => {
    getSharedMemoryState().clear()
    const storage = await createStorageContext('memory')
    setStorageContext(storage)

    useTripStore.setState({
      trips: [],
      activeTrip: null,
      isLoading: false,
      isInitialized: true,
      error: null,
      storageType: 'memory',
      isStorageAvailable: true,
    })

    useTemplateStore.setState({
      templates: [mockSystemTemplate, mockCustomTemplate],
      isLoading: false,
      isInitialized: true,
      error: null,
    })
  })

  it('renders page header, search input, filter tabs, and template cards', () => {
    const html = renderToString(
      <MemoryRouter>
        <TemplatesPage />
      </MemoryRouter>
    )

    // Header and context
    expect(html).toContain('Packing Templates')
    expect(html).toContain('Browse curated packing foundations')

    // Filter tabs with counts
    expect(html).toContain('All (2)')
    expect(html).toContain('Custom (1)')
    expect(html).toContain('Predefined (1)')

    // Search input
    expect(html).toContain('Search templates...')

    // Template Cards rendered
    expect(html).toContain('Beach Vacation')
    expect(html).toContain('Serengeti Safari Kit')
  })

  it('renders system template with View Details only and no Edit/Delete actions', () => {
    const html = renderToString(
      <MemoryRouter>
        <TemplatesPage />
      </MemoryRouter>
    )

    expect(html).toContain('view-template-btn-template-predefined-beach')
    expect(html).not.toContain('edit-template-btn-template-predefined-beach')
    expect(html).not.toContain('delete-template-btn-template-predefined-beach')
  })

  it('renders custom template with View, Edit, and Delete actions', () => {
    const html = renderToString(
      <MemoryRouter>
        <TemplatesPage />
      </MemoryRouter>
    )

    expect(html).toContain('view-template-btn-template-custom-safari')
    expect(html).toContain('edit-template-btn-template-custom-safari')
    expect(html).toContain('delete-template-btn-template-custom-safari')
  })

  it('renders empty custom templates state when no custom templates exist', () => {
    // Only system template in store
    useTemplateStore.setState({
      templates: [mockSystemTemplate],
      isLoading: false,
      isInitialized: true,
      error: null,
    })

    const html = renderToString(
      <MemoryRouter>
        <TemplatesPage />
      </MemoryRouter>
    )

    // Tabs reflect 0 custom templates
    expect(html).toContain('Custom (0)')
  })

  it('header navigation contains functional Templates link', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/templates']}>
        <Header />
      </MemoryRouter>
    )

    expect(html).toContain('href="/templates"')
    expect(html).toContain('Templates')
    expect(html).toContain('href="/trips"')
    expect(html).toContain('My Trips')
  })

  it('renders TemplatesPage at "/templates" route in application router', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/templates']}>
        <Routes>
          <Route path="/templates" element={<TemplatesPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(html).toContain('Packing Templates')
    expect(html).toContain('Beach Vacation')
    expect(html).toContain('Serengeti Safari Kit')
  })

  it('existing application routes remain fully functional', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/templates" element={<TemplatesPage />} />
          </Routes>
        </Layout>
      </MemoryRouter>
    )

    expect(html).toContain('Pack with Confidence')
  })
})
