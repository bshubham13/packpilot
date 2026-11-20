/**
 * PackPilot — Export Backup Workflow Utility
 * Coordinates snapshot creation, serialization, filename generation, and browser download.
 */

import {
  exportBackup,
  serializeBackup,
  generateBackupFilename,
} from '../../services/backupService'
import { downloadJsonBlob } from '../../utils/download'
import { getStorageContext } from '../../db/factory'
import type { StorageContext } from '../../db/interfaces'
import type { PackPilotBackupPayload } from '../../types/backup'

/**
 * Executes the complete export workflow:
 * 1. Reads a consistent snapshot from storage via exportBackup.
 * 2. Serializes payload into formatted JSON via serializeBackup.
 * 3. Generates standardized filename via generateBackupFilename.
 * 4. Initiates browser download via downloadJsonBlob.
 */
export async function executeExportBackup(options?: {
  storage?: StorageContext
  downloadFn?: (content: string, filename: string) => boolean
}): Promise<{
  payload: PackPilotBackupPayload
  filename: string
  downloadSuccess: boolean
}> {
  const store = options?.storage || getStorageContext()
  const payload = await exportBackup(store)
  const serialized = serializeBackup(payload)
  const filename = generateBackupFilename()
  const downloadFn = options?.downloadFn || downloadJsonBlob
  const downloadSuccess = downloadFn(serialized, filename)

  if (!downloadSuccess) {
    throw new Error(
      'Browser download could not be initiated. Please check your browser popup or download settings.'
    )
  }

  return { payload, filename, downloadSuccess }
}
