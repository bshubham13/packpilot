import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ExportBackupCard } from '../../../src/components/backup/ExportBackupCard'
import { executeExportBackup } from '../../../src/components/backup/exportWorkflow'
import { createStorageContext, setStorageContext } from '../../../src/db/factory'
import { getSharedMemoryState } from '../../../src/db/memory/memoryStorage'
import * as backupService from '../../../src/services/backupService'
import type { Trip, PackingItem } from '../../../src/types'
import { DEFAULT_BAGGAGE_CONFIG } from '../../../src/types'
import { PACKPILOT_APP_ID, CURRENT_BACKUP_SCHEMA_VERSION } from '../../../src/types/backup'

function createSampleTrip(id = 'trip-1', name = 'Swiss Alps'): Trip {
  return {
    id,
    name,
    destination: 'Zermatt, Switzerland',
    origin: 'Geneva, Switzerland',
    startDate: '2026-08-01',
    endDate: '2026-08-07',
    durationDays: 7,
    totalTravellerCount: 2,
    transportModes: ['train'],
    activities: ['trekking'],
    climate: 'mixed',
    accommodationType: 'hotel',
    travellers: { adults: 2, teens: 0, children: 0, infants: 0, seniors: 0 },
    personalPreferences: [],
    baggageConfig: DEFAULT_BAGGAGE_CONFIG,
    dismissedItems: [],
    engineVersion: '1.4.0',
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-08-01T08:00:00Z',
  }
}

function createSampleItem(id = 'item-1', tripId = 'trip-1', name = 'Hiking Socks'): PackingItem {
  return {
    id,
    tripId,
    name,
    itemSlug: 'wear-hiking-socks',
    category: 'clothing',
    priority: 'recommended',
    quantityStrategy: 'fixed',
    generatedQuantity: 3,
    effectiveQuantity: 3,
    packedQuantity: 1,
    isPacked: false,
    isShared: false,
    isCustom: false,
    reasons: ['Hiking'],
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-08-01T08:00:00Z',
  }
}

describe('ExportBackupCard Component (Slice 8B-2)', () => {
  let storage: Awaited<ReturnType<typeof createStorageContext>>

  beforeEach(async () => {
    getSharedMemoryState().clear()
    storage = await createStorageContext('memory')
    setStorageContext(storage)
  })

  // 1. Renders accurate record counts
  it('renders accurate record counts in the local data summary', () => {
    const summary = { trips: 3, items: 25, templates: 2 }
    const html = renderToString(
      <ExportBackupCard storage={storage} initialSummary={summary} />
    )

    expect(html).toContain('Export Local Backup')
    expect(html).toContain('Current Data Summary')
    expect(html).toContain('aria-label="3 Trips"')
    expect(html).toContain('3</span>')
    expect(html).toContain('aria-label="25 Checklist Items"')
    expect(html).toContain('25</span>')
    expect(html).toContain('aria-label="2 Templates"')
    expect(html).toContain('2</span>')
    expect(html).toContain('Ready to package 3 trips into JSON.')
  })

  // 2. Handles empty backup state correctly
  it('handles empty backup state correctly with appropriate messaging', () => {
    const emptySummary = { trips: 0, items: 0, templates: 0 }
    const html = renderToString(
      <ExportBackupCard storage={storage} initialSummary={emptySummary} />
    )

    expect(html).toContain('aria-label="0 Trips"')
    expect(html).toContain('aria-label="0 Checklist Items"')
    expect(html).toContain('aria-label="0 Templates"')
    expect(html).toContain('No trips recorded yet. An empty backup will be generated.')
  })

  // 3. Explains local-first security and user guidance
  it('explains that the backup is a local JSON file that users should keep safe', () => {
    const html = renderToString(<ExportBackupCard storage={storage} />)

    expect(html).toContain('PackPilot stores data locally in your browser')
    expect(html).toContain('Keep it somewhere safe (such as personal cloud storage or an external drive)')
  })

  // 4. Shows loading state
  it('renders exporting/loading state with disabled button and spinner indicator', () => {
    const html = renderToString(
      <ExportBackupCard
        storage={storage}
        statusOverride={{ type: 'exporting' }}
      />
    )

    expect(html).toContain('Exporting Backup...')
    expect(html).toContain('disabled=""')
    expect(html).toContain('animate-spin')
  })

  // 5. Shows success state with details and accessible announcement
  it('renders success state with filename, count details, and polite aria announcement', () => {
    const successStatus = {
      type: 'success' as const,
      filename: 'packpilot-backup-2026-08-01.json',
      exportedAt: '2026-08-01T12:00:00Z',
      counts: { trips: 2, items: 14, templates: 0 },
    }

    const html = renderToString(
      <ExportBackupCard
        storage={storage}
        statusOverride={successStatus}
      />
    )

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Backup downloaded successfully!')
    expect(html).toContain('Saved as packpilot-backup-2026-08-01.json (2 trips, 14 items, 0 templates)')
  })

  // 6. Shows error state with details and assertive aria announcement
  it('renders error state with failure message and assertive aria announcement', () => {
    const errorStatus = {
      type: 'error' as const,
      error: 'Storage snapshot read failure: QuotaExceededError',
    }

    const html = renderToString(
      <ExportBackupCard
        storage={storage}
        statusOverride={errorStatus}
      />
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('aria-live="assertive"')
    expect(html).toContain('Export failed')
    expect(html).toContain('Storage snapshot read failure: QuotaExceededError')
  })

  // 7. Calls the correct export, serialization, and filename generation functions
  it('calls exportBackup, serializeBackup, generateBackupFilename, and downloadJsonBlob', async () => {
    const trip = createSampleTrip('trip-1')
    const item = createSampleItem('item-1', 'trip-1')
    await storage.trips.saveTripWithItems(trip, [item])

    const exportSpy = vi.spyOn(backupService, 'exportBackup')
    const serializeSpy = vi.spyOn(backupService, 'serializeBackup')
    const filenameSpy = vi.spyOn(backupService, 'generateBackupFilename')

    const mockDownload = vi.fn(() => true)

    const result = await executeExportBackup({
      storage,
      downloadFn: mockDownload,
    })

    expect(exportSpy).toHaveBeenCalledTimes(1)
    expect(serializeSpy).toHaveBeenCalledTimes(1)
    expect(filenameSpy).toHaveBeenCalledTimes(1)
    expect(mockDownload).toHaveBeenCalledTimes(1)

    // Check payload structure
    expect(result.payload.app).toBe(PACKPILOT_APP_ID)
    expect(result.payload.version).toBe(CURRENT_BACKUP_SCHEMA_VERSION)
    expect(result.payload.trips).toHaveLength(1)
    expect(result.payload.items).toHaveLength(1)

    // Check download parameters
    const [downloadedContent, downloadedFilename] = mockDownload.mock.calls[0]
    expect(downloadedFilename).toMatch(/^packpilot-backup-\d{4}-\d{2}-\d{2}\.json$/)
    const parsed = JSON.parse(downloadedContent)
    expect(parsed.app).toBe('packpilot')
    expect(parsed.trips[0].id).toBe('trip-1')

    exportSpy.mockRestore()
    serializeSpy.mockRestore()
    filenameSpy.mockRestore()
  })

  // 8. Handles empty storage export correctly
  it('generates a valid, parseable backup when storage is completely empty', async () => {
    const mockDownload = vi.fn(() => true)

    const result = await executeExportBackup({
      storage,
      downloadFn: mockDownload,
    })

    expect(result.payload.trips).toEqual([])
    expect(result.payload.items).toEqual([])
    expect(result.payload.templates).toEqual([])

    const [content] = mockDownload.mock.calls[0]
    const parsed = JSON.parse(content)
    expect(parsed.trips).toEqual([])
    expect(parsed.items).toEqual([])
    expect(parsed.templates).toEqual([])
  })

  // 9. Handles download failure appropriately
  it('throws a descriptive error when the browser download helper returns false', async () => {
    const mockFailingDownload = vi.fn(() => false)

    await expect(
      executeExportBackup({
        storage,
        downloadFn: mockFailingDownload,
      })
    ).rejects.toThrow('Browser download could not be initiated')
  })

  // 10. Handles storage read failure during export
  it('propagates storage errors when snapshot creation fails', async () => {
    vi.spyOn(storage.backup, 'createSnapshot').mockRejectedValueOnce(
      new Error('IndexedDB Transaction Aborted')
    )

    await expect(
      executeExportBackup({
        storage,
      })
    ).rejects.toThrow('IndexedDB Transaction Aborted')
  })

  // 11. Shows success state only after successful download, not on failure
  it('does not display success state when download fails', () => {
    const errorHtml = renderToString(
      <ExportBackupCard
        storage={storage}
        statusOverride={{ type: 'error', error: 'Download failed' }}
      />
    )

    expect(errorHtml).not.toContain('Backup downloaded successfully!')
    expect(errorHtml).toContain('Export failed')
  })

  // 12. Displays accurate counts from the generated backup payload rather than stale counts
  it('updates summary counts with accurate counts from the backup payload', () => {
    const successStatus = {
      type: 'success' as const,
      filename: 'packpilot-backup-2026-08-01.json',
      exportedAt: '2026-08-01T12:00:00Z',
      counts: { trips: 5, items: 32, templates: 1 },
    }

    // Render with initialSummary showing 2 trips, but statusOverride showing accurate counts of 5
    const html = renderToString(
      <ExportBackupCard
        storage={storage}
        initialSummary={{ trips: 2, items: 10, templates: 0 }}
        statusOverride={successStatus}
      />
    )

    expect(html).toContain('5 trips, 32 items, 1 templates')
  })

  // 13. Prevents duplicate simultaneous export actions
  it('prevents duplicate simultaneous export actions by disabling the action during active export', () => {
    const exportingHtml = renderToString(
      <ExportBackupCard
        storage={storage}
        statusOverride={{ type: 'exporting' }}
      />
    )

    expect(exportingHtml).toContain('disabled=""')
    expect(exportingHtml).toContain('Exporting Backup...')
    expect(exportingHtml).not.toContain('Download Backup (.json)</button>')
  })
})
