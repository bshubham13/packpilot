import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { RestoreBackupCard } from '../../../src/components/backup/RestoreBackupCard'
import {
  parseAndValidateBackupText,
  readAndValidateBackupFile,
  executeRestoreWorkflow,
  MAX_BACKUP_FILE_SIZE_BYTES,
} from '../../../src/components/backup/restoreWorkflow'
import { createStorageContext, setStorageContext } from '../../../src/db/factory'
import { getSharedMemoryState } from '../../../src/db/memory/memoryStorage'
import * as restoreCoordinator from '../../../src/services/restoreCoordinator'
import type { Trip, PackingItem } from '../../../src/types'
import { DEFAULT_BAGGAGE_CONFIG } from '../../../src/types'
import {
  PACKPILOT_APP_ID,
  CURRENT_BACKUP_SCHEMA_VERSION,
  type PackPilotBackupPayload,
  type RestoreResult,
} from '../../../src/types/backup'

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

function createSamplePayload(
  trips: Trip[] = [createSampleTrip()],
  items: PackingItem[] = [createSampleItem()]
): PackPilotBackupPayload {
  return {
    app: PACKPILOT_APP_ID,
    version: CURRENT_BACKUP_SCHEMA_VERSION,
    exportedAt: '2026-08-01T12:00:00.000Z',
    trips,
    items,
    templates: [],
  }
}

describe('RestoreBackupCard Component & Workflow (Slice 8B-3)', () => {
  let storage: Awaited<ReturnType<typeof createStorageContext>>

  beforeEach(async () => {
    getSharedMemoryState().clear()
    storage = await createStorageContext('memory')
    setStorageContext(storage)
  })

  // 1. Valid JSON and schema validation
  it('validates a valid backup payload successfully', () => {
    const validJson = JSON.stringify(createSamplePayload())
    const result = parseAndValidateBackupText(validJson)

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.data?.trips).toHaveLength(1)
  })

  // 2. Invalid / Malformed JSON handling
  it('detects malformed JSON and returns clear error', () => {
    const malformedJson = '{ "app": "packpilot", invalid'
    const result = parseAndValidateBackupText(malformedJson)

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('The file does not contain valid JSON')
  })

  // 3. Empty file handling
  it('detects empty text and returns clear validation error', () => {
    const emptyResult = parseAndValidateBackupText('   ')

    expect(emptyResult.valid).toBe(false)
    expect(emptyResult.errors[0]).toContain('The selected file is empty (0 bytes)')
  })

  // 4. Unsupported schema and invalid application identifier
  it('rejects unsupported schema version and invalid app identifier', () => {
    const wrongAppJson = JSON.stringify({
      app: 'not-packpilot',
      version: CURRENT_BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-08-01T00:00:00Z',
      trips: [],
      items: [],
      templates: [],
    })
    const resApp = parseAndValidateBackupText(wrongAppJson)
    expect(resApp.valid).toBe(false)
    expect(resApp.errors[0]).toContain("Invalid application identifier: expected 'packpilot'")

    const futureVersionJson = JSON.stringify({
      app: PACKPILOT_APP_ID,
      version: 999,
      exportedAt: '2026-08-01T00:00:00Z',
      trips: [],
      items: [],
      templates: [],
    })
    const resVer = parseAndValidateBackupText(futureVersionJson)
    expect(resVer.valid).toBe(false)
    expect(resVer.errors[0]).toContain('Unsupported backup schema version: 999')
  })

  // 5. File size limit enforcement
  it('rejects files exceeding the 15 MB file size limit without reading full content', async () => {
    const oversizedFile = {
      size: MAX_BACKUP_FILE_SIZE_BYTES + 1024,
      name: 'giant-backup.json',
      text: vi.fn(),
    } as unknown as File

    const result = await readAndValidateBackupFile(oversizedFile)

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('exceeds the maximum allowed backup limit of 15 MB')
    expect(oversizedFile.text).not.toHaveBeenCalled()
  })

  // 6. Accurate preview counts rendering
  it('renders accurate preview counts only after validation succeeds', () => {
    const payload = createSamplePayload(
      [createSampleTrip('trip-1'), createSampleTrip('trip-2')],
      [createSampleItem('i-1'), createSampleItem('i-2'), createSampleItem('i-3')]
    )

    const html = renderToString(
      <RestoreBackupCard storage={storage} initialPayload={payload} />
    )

    // Preview section is displayed
    expect(html).toContain('data-testid="backup-preview-section"')
    expect(html).toContain('data-testid="preview-trips-count"')
    expect(html).toContain('>2</span>')
    expect(html).toContain('data-testid="preview-items-count"')
    expect(html).toContain('>3</span>')
    expect(html).toContain('data-testid="preview-templates-count"')
    expect(html).toContain('>0</span>')
    expect(html).toContain('Schema v1 (Compatible)')
    expect(html).toContain('2026-08-01 12:00:00 UTC')
  })

  // 7. No preview displayed when no file is selected
  it('does not render preview section when no file is selected', () => {
    const html = renderToString(<RestoreBackupCard storage={storage} />)

    expect(html).not.toContain('data-testid="backup-preview-section"')
    expect(html).toContain('Choose a backup file (.json)')
    expect(html).toContain('Select a valid backup file to preview and restore.')
  })

  // 8. Merge default mode and explanation
  it('defaults to merge mode and displays accurate non-destructive explanation', () => {
    const payload = createSamplePayload()
    const html = renderToString(
      <RestoreBackupCard storage={storage} initialPayload={payload} />
    )

    expect(html).toContain('data-testid="mode-merge-radio"')
    expect(html).toContain('checked=""')
    expect(html).toContain('Merge into existing data (Default)')
    expect(html).toContain('Existing trips with matching IDs are preserved as-is')
    // Replace confirmation must NOT be visible in merge mode
    expect(html).not.toContain('data-testid="replace-confirmation-box"')
    expect(html).toContain('Merge Backup Data')
  })

  // 9. Replace mode confirmation requirement
  it('requires explicit confirmation before enabling restore action in replace mode', () => {
    const payload = createSamplePayload()

    // Render in replace mode without confirmation
    const unconfirmedHtml = renderToString(
      <RestoreBackupCard
        storage={storage}
        initialPayload={payload}
        initialMode="replace"
      />
    )

    expect(unconfirmedHtml).toContain('data-testid="replace-confirmation-box"')
    expect(unconfirmedHtml).toContain('Permanent action: All current local trips and items will be erased.')
    expect(unconfirmedHtml).toContain('I understand and confirm that all existing local data will be replaced.')
    // Action button must be disabled
    expect(unconfirmedHtml).toContain('data-testid="restore-action-btn"')
    expect(unconfirmedHtml).toContain('disabled=""')
    expect(unconfirmedHtml).toContain('Replace and Restore All Data')
  })

  // 10. No storage mutation during file selection or preview
  it('never mutates storage during file selection, reading or preview validation', async () => {
    const initialTrip = createSampleTrip('local-trip')
    await storage.trips.saveTripWithItems(initialTrip, [])

    const restoreSpy = vi.spyOn(storage.backup, 'atomicRestore')

    // Read and validate a file payload
    const file = new File(
      [
        JSON.stringify(
          createSamplePayload(
            [createSampleTrip('incoming-trip')],
            [createSampleItem('incoming-item', 'incoming-trip')]
          )
        ),
      ],
      'test-backup.json',
      { type: 'application/json' }
    )

    const validation = await readAndValidateBackupFile(file)
    expect(validation.valid).toBe(true)

    // Verify storage was never touched
    expect(restoreSpy).not.toHaveBeenCalled()
    const trips = await storage.trips.getAllTrips()
    expect(trips).toHaveLength(1)
    expect(trips[0].id).toBe('local-trip')

    restoreSpy.mockRestore()
  })

  // 11. Duplicate restore prevention
  it('disables the restore button and indicates progress during active restoration', () => {
    const payload = createSamplePayload()
    const html = renderToString(
      <RestoreBackupCard
        storage={storage}
        initialPayload={payload}
        statusOverride={{ type: 'restoring' }}
      />
    )

    expect(html).toContain('Restoring Backup...')
    expect(html).toContain('disabled=""')
    expect(html).toContain('animate-spin')
  })

  // 12. Successful restore result presentation
  it('displays successful restore details with imported counts and skipped details', () => {
    const payload = createSamplePayload()
    const successResult: RestoreResult = {
      success: true,
      mode: 'merge',
      imported: { trips: 2, items: 12, templates: 1 },
      skipped: { trips: 1, items: 4, templates: 0 },
      conflicts: { trips: 0, items: 0, templates: 0 },
      errors: [],
      storageCommitted: true,
    }

    const html = renderToString(
      <RestoreBackupCard
        storage={storage}
        initialPayload={payload}
        statusOverride={{ type: 'success', result: successResult }}
      />
    )

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('data-testid="restore-success-banner"')
    expect(html).toContain('Restore completed successfully!')
    expect(html).toContain('Imported: 2 trips, 12 items, 1 templates (merge mode).')
    expect(html).toContain('Skipped: 1 existing trips, 4 items preserved.')
  })

  // 13. Storage restore failure handling (rolled back)
  it('accurately reports storage restore failure and assures user that existing records were preserved', () => {
    const payload = createSamplePayload()
    const failureResult: RestoreResult = {
      success: false,
      mode: 'replace',
      imported: { trips: 0, items: 0, templates: 0 },
      skipped: { trips: 0, items: 0, templates: 0 },
      conflicts: { trips: 0, items: 0, templates: 0 },
      errors: ['IndexedDB transaction quota exceeded'],
      storageCommitted: false,
    }

    const html = renderToString(
      <RestoreBackupCard
        storage={storage}
        initialPayload={payload}
        statusOverride={{ type: 'error', result: failureResult }}
      />
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('aria-live="assertive"')
    expect(html).toContain('data-testid="restore-storage-error-banner"')
    expect(html).toContain('Storage restore failed')
    expect(html).toContain('IndexedDB transaction quota exceeded')
    expect(html).toContain(
      'Storage transaction was rolled back. Existing database records were preserved without changes.'
    )
  })

  // 14. Storage committed but synchronization failed handling
  it('accurately warns when storage was committed but view could not refresh, offering reload without re-import', () => {
    const payload = createSamplePayload()
    const syncFailureResult: RestoreResult = {
      success: false,
      mode: 'replace',
      imported: { trips: 2, items: 10, templates: 0 },
      skipped: { trips: 0, items: 0, templates: 0 },
      conflicts: { trips: 0, items: 0, templates: 0 },
      errors: ['Post-restore synchronization failed: TripStore reload timed out'],
      storageCommitted: true,
      syncError: 'TripStore reload timed out',
    }

    const html = renderToString(
      <RestoreBackupCard
        storage={storage}
        initialPayload={payload}
        statusOverride={{ type: 'error', result: syncFailureResult }}
      />
    )

    expect(html).toContain('data-testid="restore-sync-error-banner"')
    expect(html).toContain('Data restored to storage, but view could not refresh')
    expect(html).toContain(
      'Your backup was successfully committed to browser storage, but the active screen view could not refresh automatically.'
    )
    expect(html).toContain(
      'Do NOT import this backup file again. Simply reload the page to refresh your view.'
    )
    expect(html).toContain('data-testid="reload-page-btn"')
    expect(html).toContain('Reload Page')
  })

  // 15. Workflow execution delegates to coordinateRestore
  it('delegates to coordinateRestore with expected options', async () => {
    const payload = createSamplePayload()
    const coordinatorSpy = vi.spyOn(restoreCoordinator, 'coordinateRestore').mockResolvedValueOnce({
      success: true,
      mode: 'merge',
      imported: { trips: 1, items: 1, templates: 0 },
      skipped: { trips: 0, items: 0, templates: 0 },
      conflicts: { trips: 0, items: 0, templates: 0 },
      errors: [],
      storageCommitted: true,
    })

    const result = await executeRestoreWorkflow(payload, 'merge', storage)

    expect(coordinatorSpy).toHaveBeenCalledWith(payload, {
      mode: 'merge',
      conflictStrategy: 'skip',
      storage,
    })
    expect(result.success).toBe(true)

    coordinatorSpy.mockRestore()
  })
})
