/**
 * PackPilot — Restore Backup Workflow Utility
 * Milestone 8B-3: File inspection, size validation, schema validation, and coordinated restore trigger.
 */

import { validateBackupPayload } from '../../services/backupService'
import { coordinateRestore } from '../../services/restoreCoordinator'
import type { StorageContext } from '../../db/interfaces'
import type {
  PackPilotBackupPayload,
  BackupValidationResult,
  RestoreResult,
  RestoreMode,
} from '../../types/backup'

/**
 * Maximum permitted backup file size (15 MB).
 * PackPilot backups contain text-based JSON of trips and items.
 * 15 MB is sufficient for tens of thousands of records while preventing browser memory exhaustion.
 */
export const MAX_BACKUP_FILE_SIZE_BYTES = 15 * 1024 * 1024 // 15 MB

/**
 * Parses raw JSON string and runs strict PackPilot schema validation.
 * Never mutates storage or Zustand stores.
 */
export function parseAndValidateBackupText(text: string): BackupValidationResult {
  if (!text || text.trim() === '') {
    return {
      valid: false,
      errors: ['The selected file is empty (0 bytes). Please choose a valid PackPilot backup file.'],
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      valid: false,
      errors: [`The file does not contain valid JSON: ${msg}`],
    }
  }

  return validateBackupPayload(parsed)
}

/**
 * Reads a File object from the browser file picker, performs size safety checks,
 * and validates the backup payload against the schema specification.
 */
export async function readAndValidateBackupFile(file: File): Promise<BackupValidationResult> {
  // 1. Empty file check
  if (file.size === 0) {
    return {
      valid: false,
      errors: ['The selected file is empty (0 bytes). Please choose a valid PackPilot backup file.'],
    }
  }

  // 2. Oversized file protection (do not silently truncate)
  if (file.size > MAX_BACKUP_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2)
    return {
      valid: false,
      errors: [
        `File size (${sizeMb} MB) exceeds the maximum allowed backup limit of 15 MB. The file was not processed.`,
      ],
    }
  }

  // 3. Read text using file.text() or FileReader fallback
  let text = ''
  if (typeof file.text === 'function') {
    text = await file.text()
  } else {
    text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read backup file'))
      reader.readAsText(file)
    })
  }

  // 4. Parse and validate content
  return parseAndValidateBackupText(text)
}

/**
 * Executes coordinated restoration with the existing Milestone 8B-1 lifecycle coordinator.
 * Guaranteed to respect the exclusive mutation barrier and maintain Zustand synchronization.
 */
export async function executeRestoreWorkflow(
  payload: PackPilotBackupPayload,
  mode: RestoreMode,
  storage?: StorageContext
): Promise<RestoreResult> {
  return await coordinateRestore(payload, {
    mode,
    conflictStrategy: 'skip',
    storage,
  })
}
