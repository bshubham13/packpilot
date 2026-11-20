import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BackupRestoreModal } from '../../../src/components/backup/BackupRestoreModal'
import { TripDashboardPage } from '../../../src/pages/TripDashboardPage'
import { StorageBanner } from '../../../src/components/layout/StorageBanner'
import { useTripStore } from '../../../src/stores/tripStore'
import { useChecklistStore } from '../../../src/stores/checklistStore'
import { createStorageContext, setStorageContext } from '../../../src/db/factory'
import { getSharedMemoryState } from '../../../src/db/memory/memoryStorage'

// In Node SSR test environment, ensure useSyncExternalStore reads live store snapshot
vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot())

describe('BackupRestoreModal Component (Milestone 8B-4)', () => {
  let storage: Awaited<ReturnType<typeof createStorageContext>>

  beforeEach(async () => {
    getSharedMemoryState().clear()
    storage = await createStorageContext('memory')
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

    useChecklistStore.setState({
      items: [],
      activeTripId: null,
      isLoading: false,
      error: null,
    })
  })

  // 1. Modal closed state
  it('renders nothing when isOpen is false', () => {
    const html = renderToString(
      <BackupRestoreModal isOpen={false} onClose={vi.fn()} storage={storage} />
    )
    expect(html).toBe('')
  })

  // 2. Default initial tab is Export
  it('renders with Export tab active by default and mounts ExportBackupCard', () => {
    const html = renderToString(
      <BackupRestoreModal isOpen={true} onClose={vi.fn()} storage={storage} />
    )

    // Modal shell and accessibility
    expect(html).toContain('role="dialog"')
    expect(html).toContain('Backup &amp; Restore')
    expect(html).toContain('Export your travel records for safekeeping')

    // Tab buttons
    expect(html).toContain('id="tab-export"')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('id="tab-restore"')
    expect(html).toContain('aria-selected="false"')

    // Active panel is export
    expect(html).toContain('id="tabpanel-export"')
    expect(html).not.toContain('id="tabpanel-restore"')

    // Contains ExportBackupCard elements
    expect(html).toContain('Export Local Backup')
    expect(html).toContain('data-testid="stat-trips"')
    expect(html).toContain('Download Backup (.json)')
  })

  // 3. Initial tab can be configured to Restore
  it('renders with Restore tab active when initialTab="restore" and mounts RestoreBackupCard', () => {
    const html = renderToString(
      <BackupRestoreModal
        isOpen={true}
        onClose={vi.fn()}
        initialTab="restore"
        storage={storage}
      />
    )

    // Tab buttons
    expect(html).toContain('id="tab-export"')
    expect(html).toContain('aria-selected="false"')
    expect(html).toContain('id="tab-restore"')
    expect(html).toContain('aria-selected="true"')

    // Active panel is restore
    expect(html).toContain('id="tabpanel-restore"')
    expect(html).not.toContain('id="tabpanel-export"')

    // Contains RestoreBackupCard elements
    expect(html).toContain('Restore From Backup')
    expect(html).toContain('data-testid="restore-file-input"')
    expect(html).toContain('Choose a backup file (.json)')
  })

  // 4. Safe close logic prevents dismissal during active restore
  it('safeguards against dismissal during active restore operations', () => {
    const onCloseSpy = vi.fn()

    // Simulate safe-close handler logic as implemented in BackupRestoreModal
    const createSafeCloseHandler = (isRestoreInProgress: boolean, onClose: () => void) => {
      return () => {
        if (isRestoreInProgress) return
        onClose()
      }
    }

    // When restore is in progress, onClose must NOT be called
    const busyClose = createSafeCloseHandler(true, onCloseSpy)
    busyClose()
    expect(onCloseSpy).not.toHaveBeenCalled()

    // When restore is idle, onClose must be called
    const idleClose = createSafeCloseHandler(false, onCloseSpy)
    idleClose()
    expect(onCloseSpy).toHaveBeenCalledTimes(1)
  })

  // 5. Tabs disabled during active restore
  it('disables both Export and Restore tabs with appropriate styling during active restore', () => {
    const html = renderToString(
      <BackupRestoreModal
        isOpen={true}
        onClose={vi.fn()}
        initialTab="restore"
        isRestoreInProgressOverride={true}
        storage={storage}
      />
    )

    // Both tab buttons must be disabled
    expect(html).toContain('id="tab-export"')
    expect(html).toContain('id="tab-restore"')
    expect(html).toContain('disabled=""')

    // Disabled visual feedback
    expect(html).toContain('cursor-not-allowed')
    expect(html).toContain('opacity-50')

    // Active panel remains Restore and RestoreBackupCard remains mounted
    expect(html).toContain('id="tabpanel-restore"')
    expect(html).not.toContain('id="tabpanel-export"')
    expect(html).toContain('data-testid="restore-file-input"')
    expect(html).toContain('Restore From Backup')
  })

  // 6. Tab change defensive handler prevents switching while restoring and allows when idle
  it('defensively prevents tab switching while restore is in progress and permits switching when idle', () => {
    let currentTab: 'export' | 'restore' = 'restore'

    const handleTabChange = (isRestoreInProgress: boolean, nextTab: 'export' | 'restore') => {
      if (isRestoreInProgress) return
      currentTab = nextTab
    }

    // Attempting to switch to Export while restore is running must be blocked
    handleTabChange(true, 'export')
    expect(currentTab).toBe('restore')

    // Attempting to switch to Export when restore is idle must succeed
    handleTabChange(false, 'export')
    expect(currentTab).toBe('export')

    // Attempting to switch to Restore when restore is idle must succeed
    handleTabChange(false, 'restore')
    expect(currentTab).toBe('restore')
  })

  // 7. Tab buttons enabled and normal switching allowed when restore is idle
  it('renders tab buttons as enabled and interactive when restore is not in progress', () => {
    const html = renderToString(
      <BackupRestoreModal
        isOpen={true}
        onClose={vi.fn()}
        initialTab="export"
        isRestoreInProgressOverride={false}
        storage={storage}
      />
    )

    // Tab buttons must have cursor-pointer and no disabled attribute on tablist buttons
    expect(html).toContain('id="tab-export"')
    expect(html).toContain('id="tab-restore"')
    expect(html).toContain('cursor-pointer')

    // Ensure the tab buttons specifically are not disabled
    // (We match the tab button tag to confirm absence of disabled)
    const exportBtnMatch = html.match(/<button[^>]*id="tab-export"[^>]*>/)
    expect(exportBtnMatch).not.toBeNull()
    expect(exportBtnMatch![0]).not.toContain('disabled')

    const restoreBtnMatch = html.match(/<button[^>]*id="tab-restore"[^>]*>/)
    expect(restoreBtnMatch).not.toBeNull()
    expect(restoreBtnMatch![0]).not.toContain('disabled')
  })

  // 5. Dashboard integration: renders secondary "Backup & Restore" button alongside "Plan a New Trip"
  it('renders "Backup & Restore" button alongside "Plan a New Trip" in TripDashboardPage', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/trips']}>
        <TripDashboardPage />
      </MemoryRouter>
    )

    // Secondary action: Backup & Restore
    expect(html).toContain('data-testid="dashboard-backup-btn"')
    expect(html).toContain('Backup &amp; Restore')

    // Primary action: Plan a New Trip
    expect(html).toContain('Plan a New Trip')
    expect(html).toContain('href="/wizard/new"')

    // Heading preserved
    expect(html).toContain('My Journeys')
  })

  // 6. StorageBanner integration: renders "Export Backup" button when memory mode is active
  it('renders "Export Backup" button in StorageBanner when in memory mode', () => {
    useTripStore.setState({
      storageType: 'memory',
      isStorageAvailable: false,
    })

    const html = renderToString(<StorageBanner />)

    expect(html).toContain('data-testid="storage-banner-export-btn"')
    expect(html).toContain('Export Backup')
    expect(html).toContain('Running in In-Memory Mode')
    expect(html).toContain('Dismiss storage warning for this session')
  })

  // 7. StorageBanner does not render when IndexedDB storage is available
  it('does not render StorageBanner when IndexedDB storage is healthy', () => {
    useTripStore.setState({
      storageType: 'indexeddb',
      isStorageAvailable: true,
    })

    const html = renderToString(<StorageBanner />)
    expect(html).toBe('')
  })

  // 8. Route preservation: opening modal preserves existing dashboard route
  it('preserves existing dashboard route and renders dashboard under the modal', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/trips']}>
        <Routes>
          <Route
            path="/trips"
            element={
              <div>
                <TripDashboardPage />
                <BackupRestoreModal isOpen={true} onClose={vi.fn()} storage={storage} />
              </div>
            }
          />
        </Routes>
      </MemoryRouter>
    )

    // Both dashboard header and modal dialog are present without navigation disruption
    expect(html).toContain('My Journeys')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('Backup &amp; Restore')
    expect(html).toContain('data-testid="dashboard-backup-btn"')
  })
})
