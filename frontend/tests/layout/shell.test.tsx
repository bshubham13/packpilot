import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTripStore } from '../../src/stores/tripStore'
import { StorageBanner, Header, Layout } from '../../src/components/layout'
import { HomePage, TripDashboardPage, TripWizardPage, ChecklistPage } from '../../src/pages'
import { App } from '../../src/App'
import * as factoryModule from '../../src/db/factory'

// In Node SSR test environment, ensure useSyncExternalStore reads live store snapshot
// instead of frozen initial state from getInitialState
vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot())

describe('Application Shell, Router & Storage Banner (Milestone 1 — Phase 6, Slice 6.1)', () => {
  beforeEach(async () => {
    // Reset trip store state before each test
    useTripStore.setState({
      trips: [],
      activeTrip: null,
      isLoading: false,
      isInitialized: true, // Default to initialized for static layout renders
      error: null,
      storageType: 'indexeddb',
      isStorageAvailable: true,
    })
  })

  describe('StorageBanner Component', () => {
    it('renders the warning banner when running in memory mode', () => {
      useTripStore.setState({
        storageType: 'memory',
        isStorageAvailable: false,
      })

      const html = renderToString(<StorageBanner />)
      expect(html).toContain('Running in In-Memory Mode')
      expect(html).toContain('IndexedDB storage is unavailable or blocked')
      expect(html).toContain('Export your data as JSON once that feature is available')
      expect(html).toContain('Dismiss storage warning for this session')
    })

    it('renders null and stays hidden when running in IndexedDB mode', () => {
      useTripStore.setState({
        storageType: 'indexeddb',
        isStorageAvailable: true,
      })

      const html = renderToString(<StorageBanner />)
      expect(html).toBe('')
    })
  })

  describe('Header Component', () => {
    it('renders brand identity and functional navigation links', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/']}>
          <Header />
        </MemoryRouter>
      )

      expect(html).toContain('PackPilot')
      expect(html).toContain('Personal Travel Assistant')
      expect(html).toContain('href="/trips"')
      expect(html).toContain('My Trips')
      expect(html).toContain('href="/wizard/new"')
      expect(html).toContain('Plan a Trip')

      // Verifies no non-functional Templates or Settings links were created
      expect(html).not.toContain('Templates')
      expect(html).not.toContain('Settings')
    })
  })

  describe('Layout Component', () => {
    it('renders skip link, header, main content, and footer storage badge', () => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/']}>
          <Layout>
            <div data-testid="test-content">Welcome to PackPilot</div>
          </Layout>
        </MemoryRouter>
      )

      // Skip link
      expect(html).toContain('Skip to main content')
      expect(html).toContain('href="#main-content"')

      // Main container
      expect(html).toContain('id="main-content"')
      expect(html).toContain('Welcome to PackPilot')

      // Footer badge for IndexedDB
      expect(html).toContain('IndexedDB Local-First')
    })

    it('displays In-Memory session badge in footer when storage is memory fallback', () => {
      useTripStore.setState({
        storageType: 'memory',
        isStorageAvailable: false,
      })

      const html = renderToString(
        <MemoryRouter initialEntries={['/']}>
          <Layout>
            <div>Memory test</div>
          </Layout>
        </MemoryRouter>
      )

      expect(html).toContain('In-Memory Session')
      expect(html).not.toContain('IndexedDB Local-First')
    })
  })

  describe('Shell Route Placeholder Views', () => {
    function renderAppWithRoute(initialRoute: string): string {
      return renderToString(
        <MemoryRouter initialEntries={[initialRoute]}>
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/trips" element={<TripDashboardPage />} />
              <Route path="/wizard/new" element={<TripWizardPage />} />
              <Route path="/trips/:id" element={<ChecklistPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </MemoryRouter>
      )
    }

    it('renders the Home page at root "/"', () => {
      const html = renderAppWithRoute('/')
      expect(html).toContain('Pack with Confidence')
      expect(html).toContain('Travel with Ease')
      expect(html).toContain('100% Local-First')
      expect(html).toContain('Smart Recommendations')
      expect(html).toContain('Readiness &amp; Weight')
    })

    it('renders the Trip Dashboard page at "/trips" with empty state', () => {
      const html = renderAppWithRoute('/trips')
      expect(html).toContain('My Journeys')
      expect(html).toContain('No Journeys Planned Yet')
      expect(html).toContain('Start Trip Wizard')
    })

    it('renders the Trip Dashboard with trip cards when trips exist in store', () => {
      useTripStore.setState({
        trips: [
          {
            id: 'trip-alpine',
            name: 'Alps Alpine Trek',
            destination: 'Zermatt, Switzerland',
            startDate: '2026-08-01',
            endDate: '2026-08-07',
            durationDays: 7,
            totalTravellerCount: 2,
            transportModes: ['train'],
            activities: ['trekking'],
            climate: 'cold',
            accommodationType: 'hotel',
            travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 0 },
            personalPreferences: [],
            baggageConfig: { hasCabinBaggage: true, cabinWeightLimitKg: 7, hasCheckedBaggage: false, checkedWeightLimitKg: 23 },
            dismissedItems: [],
            engineVersion: '1.0.0',
            createdAt: '2026-08-01T00:00:00Z',
            updatedAt: '2026-08-01T00:00:00Z',
          },
        ],
      })

      const html = renderAppWithRoute('/trips')
      expect(html).toContain('Alps Alpine Trek')
      expect(html).toContain('Zermatt, Switzerland')
      expect(html).toContain('7 Days')
      expect(html).toContain('View Checklist')
    })

    it('renders the Trip Wizard page at "/wizard/new"', () => {
      const html = renderAppWithRoute('/wizard/new')
      expect(html).toContain('Plan a New Journey')
      expect(html).toContain('Trip Wizard')
      expect(html).toContain('Step 1 of 5')
      expect(html).toContain('Basics')
      expect(html).toContain('Travellers')
      expect(html).toContain('Back to My Trips')
    })

    it('renders the functional Checklist page at "/trips/:id"', () => {
      const html = renderAppWithRoute('/trips/trip-expedition-99')
      expect(html).toContain('Journey Not Found')
      expect(html).toContain('Trip Record Unavailable')
      expect(html).toContain('Back to My Trips')
    })
  })

  describe('Storage Initialization & StrictMode Safety', () => {
    it('deduplicates concurrent initialization calls (e.g. React StrictMode concurrent mount)', async () => {
      // Reset initialization status
      useTripStore.setState({ isInitialized: false, isLoading: false })

      const createStorageSpy = vi.spyOn(factoryModule, 'createStorageContext')

      // Call initialize multiple times concurrently
      await Promise.all([
        useTripStore.getState().initialize(),
        useTripStore.getState().initialize(),
        useTripStore.getState().initialize(),
      ])

      // Only one underlying storage context creation should occur
      expect(createStorageSpy).toHaveBeenCalledTimes(1)
      expect(useTripStore.getState().isInitialized).toBe(true)

      // Subsequent call when already initialized does not trigger another createStorageContext
      await useTripStore.getState().initialize()
      expect(createStorageSpy).toHaveBeenCalledTimes(1)

      createStorageSpy.mockRestore()
    })

    it('renders App loading screen while initialization is in progress', () => {
      useTripStore.setState({
        isInitialized: false,
        isLoading: true,
        error: null,
      })

      const html = renderToString(<App />)
      expect(html).toContain('PackPilot')
      expect(html).toContain('Initializing your personal travel journal...')
    })

    it('renders App error recovery screen when initialization fails', () => {
      useTripStore.setState({
        isInitialized: false,
        isLoading: false,
        error: 'Database permission denied: private browsing blocked access',
      })

      const html = renderToString(<App />)
      expect(html).toContain('Storage Initialization Issue')
      expect(html).toContain('Unable to Open Travel Journal')
      expect(html).toContain('Database permission denied: private browsing blocked access')
      expect(html).toContain('Retry')
      expect(html).toContain('Continue in Session Mode')
    })
  })
})
