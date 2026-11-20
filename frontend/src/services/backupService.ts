/**
 * PackPilot — JSON Backup & Restore Engine
 * Pure offline-first backup creation, schema validation, and atomic restore.
 */

import type { StorageContext } from '../db/interfaces'
import { getStorageContext } from '../db/factory'
import type {
  PackPilotBackupPayload,
  BackupValidationResult,
  RestoreResult,
  RestoreOptions,
} from '../types/backup'
import {
  PACKPILOT_APP_ID,
  CURRENT_BACKUP_SCHEMA_VERSION,
} from '../types/backup'

/**
 * Checks whether a given string is a valid ISO 8601 date representation.
 */
function isValidDateString(val: unknown): boolean {
  if (typeof val !== 'string' || val.trim() === '') return false
  const timestamp = Date.parse(val)
  if (Number.isNaN(timestamp)) return false
  const dateObj = new Date(timestamp)
  return !Number.isNaN(dateObj.getTime())
}

/**
 * Validates a backup payload against the PackPilot schema specification.
 * Ensures data integrity, prevents future version incompatibilities,
 * rejects malformed entities, and enforces referential integrity.
 */
export function validateBackupPayload(data: unknown): BackupValidationResult {
  const errors: string[] = []

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      valid: false,
      errors: ['Backup payload must be a non-null JSON object'],
    }
  }

  const payload = data as Record<string, unknown>

  // 1. App Identifier Check
  if (payload.app !== PACKPILOT_APP_ID) {
    errors.push(
      `Invalid application identifier: expected '${PACKPILOT_APP_ID}', received '${String(payload.app)}'`
    )
  }

  // 2. Schema Version Check
  if (typeof payload.version !== 'number' || !Number.isInteger(payload.version)) {
    errors.push("Schema version 'version' must be an integer number")
  } else if (payload.version > CURRENT_BACKUP_SCHEMA_VERSION) {
    errors.push(
      `Unsupported backup schema version: ${payload.version}. Maximum supported schema version is ${CURRENT_BACKUP_SCHEMA_VERSION}.`
    )
  } else if (payload.version < 1) {
    errors.push(`Invalid schema version: ${payload.version}. Version must be >= 1.`)
  }

  // 3. Export Timestamp Check
  if (!isValidDateString(payload.exportedAt)) {
    errors.push(
      "Invalid or missing export timestamp: 'exportedAt' must be a valid ISO 8601 date string"
    )
  }

  // 4. Collection Array Checks
  if (!Array.isArray(payload.trips)) {
    errors.push("'trips' collection must be an array")
  }
  if (!Array.isArray(payload.items)) {
    errors.push("'items' collection must be an array")
  }
  if (!Array.isArray(payload.templates)) {
    errors.push("'templates' collection must be an array")
  }

  // Return early if basic collections are not arrays to prevent iteration errors
  if (errors.length > 0 && (!Array.isArray(payload.trips) || !Array.isArray(payload.items) || !Array.isArray(payload.templates))) {
    return { valid: false, errors }
  }

  const trips = (payload.trips || []) as Array<Record<string, unknown>>
  const items = (payload.items || []) as Array<Record<string, unknown>>
  const templates = (payload.templates || []) as Array<Record<string, unknown>>

  // 5. Trips Validation & Duplicate Check
  const tripIds = new Set<string>()
  for (let idx = 0; idx < trips.length; idx++) {
    const trip = trips[idx]
    if (!trip || typeof trip !== 'object' || Array.isArray(trip)) {
      errors.push(`Trip at index ${idx} must be a valid object`)
      continue
    }

    if (typeof trip.id !== 'string' || trip.id.trim() === '') {
      errors.push(`Trip at index ${idx} is missing a valid string 'id'`)
      continue
    }

    if (tripIds.has(trip.id)) {
      errors.push(`Duplicate trip ID found in backup: '${trip.id}'`)
    } else {
      tripIds.add(trip.id)
    }

    if (typeof trip.name !== 'string' || trip.name.trim() === '') {
      errors.push(`Trip '${trip.id}' is missing a valid string 'name'`)
    }

    if (!isValidDateString(trip.startDate)) {
      errors.push(`Trip '${trip.id}' has an invalid startDate: '${String(trip.startDate)}'`)
    }

    if (!isValidDateString(trip.endDate)) {
      errors.push(`Trip '${trip.id}' has an invalid endDate: '${String(trip.endDate)}'`)
    }

    if (!isValidDateString(trip.createdAt)) {
      errors.push(`Trip '${trip.id}' has an invalid createdAt date: '${String(trip.createdAt)}'`)
    }

    if (!isValidDateString(trip.updatedAt)) {
      errors.push(`Trip '${trip.id}' has an invalid updatedAt date: '${String(trip.updatedAt)}'`)
    }

    if (trip.dismissedItems !== undefined) {
      if (!Array.isArray(trip.dismissedItems)) {
        errors.push(`Trip '${trip.id}' has invalid 'dismissedItems': expected an array`)
      } else {
        const dItems = trip.dismissedItems as Array<Record<string, unknown>>
        for (let dIdx = 0; dIdx < dItems.length; dIdx++) {
          const dRecord = dItems[dIdx]
          if (!dRecord || typeof dRecord !== 'object' || Array.isArray(dRecord)) {
            errors.push(`Trip '${trip.id}' dismissedItem at index ${dIdx} must be a valid object`)
            continue
          }
          if (typeof dRecord.itemSlug !== 'string' || dRecord.itemSlug.trim() === '') {
            errors.push(`Trip '${trip.id}' dismissedItem at index ${dIdx} is missing 'itemSlug'`)
          }
          if (typeof dRecord.name !== 'string' || dRecord.name.trim() === '') {
            errors.push(`Trip '${trip.id}' dismissedItem at index ${dIdx} is missing 'name'`)
          }
          if (typeof dRecord.category !== 'string' || dRecord.category.trim() === '') {
            errors.push(`Trip '${trip.id}' dismissedItem at index ${dIdx} is missing 'category'`)
          }
          if (typeof dRecord.priority !== 'string' || dRecord.priority.trim() === '') {
            errors.push(`Trip '${trip.id}' dismissedItem at index ${dIdx} is missing 'priority'`)
          }
          if (!isValidDateString(dRecord.dismissedAt)) {
            errors.push(`Trip '${trip.id}' dismissedItem at index ${dIdx} has an invalid 'dismissedAt' date`)
          }
          if (!dRecord.originalItemSnapshot || typeof dRecord.originalItemSnapshot !== 'object' || Array.isArray(dRecord.originalItemSnapshot)) {
            errors.push(`Trip '${trip.id}' dismissedItem at index ${dIdx} is missing 'originalItemSnapshot' object`)
          } else {
            const snapshot = dRecord.originalItemSnapshot as Record<string, unknown>
            if (typeof snapshot.id !== 'string' || snapshot.id.trim() === '') {
              errors.push(`Trip '${trip.id}' dismissedItem at index ${dIdx} snapshot is missing 'id'`)
            }
            if (typeof snapshot.tripId !== 'string' || snapshot.tripId.trim() === '') {
              errors.push(`Trip '${trip.id}' dismissedItem at index ${dIdx} snapshot is missing 'tripId'`)
            }
            if (typeof snapshot.itemSlug !== 'string' || snapshot.itemSlug.trim() === '') {
              errors.push(`Trip '${trip.id}' dismissedItem at index ${dIdx} snapshot is missing 'itemSlug'`)
            }
          }
        }
      }
    }
  }

  // 6. Items Validation, Duplicate Check, & Referential Integrity Check
  const itemIds = new Set<string>()
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`Item at index ${idx} must be a valid object`)
      continue
    }

    if (typeof item.id !== 'string' || item.id.trim() === '') {
      errors.push(`Item at index ${idx} is missing a valid string 'id'`)
      continue
    }

    if (itemIds.has(item.id)) {
      errors.push(`Duplicate item ID found in backup: '${item.id}'`)
    } else {
      itemIds.add(item.id)
    }

    if (typeof item.tripId !== 'string' || item.tripId.trim() === '') {
      errors.push(`Item '${item.id}' is missing a valid string 'tripId'`)
    } else if (!tripIds.has(item.tripId)) {
      errors.push(
        `Referential integrity violation: Item '${item.id}' ('${String(item.name || 'unnamed')}') references unknown tripId '${item.tripId}'`
      )
    }

    if (typeof item.name !== 'string' || item.name.trim() === '') {
      errors.push(`Item '${item.id}' is missing a valid string 'name'`)
    }

    if (typeof item.itemSlug !== 'string' || item.itemSlug.trim() === '') {
      errors.push(`Item '${item.id}' is missing a valid string 'itemSlug'`)
    }

    if (typeof item.category !== 'string' || item.category.trim() === '') {
      errors.push(`Item '${item.id}' is missing a valid string 'category'`)
    }

    if (typeof item.priority !== 'string' || item.priority.trim() === '') {
      errors.push(`Item '${item.id}' is missing a valid string 'priority'`)
    }

    if (typeof item.effectiveQuantity !== 'number' || item.effectiveQuantity < 0 || !Number.isFinite(item.effectiveQuantity)) {
      errors.push(`Item '${item.id}' has an invalid effectiveQuantity: must be a finite non-negative number`)
    }

    if (typeof item.packedQuantity !== 'number' || item.packedQuantity < 0 || !Number.isFinite(item.packedQuantity)) {
      errors.push(`Item '${item.id}' has an invalid packedQuantity: must be a finite non-negative number`)
    }

    if (typeof item.isPacked !== 'boolean') {
      errors.push(`Item '${item.id}' has an invalid isPacked flag: must be a boolean`)
    }

    if (item.weightGrams !== undefined && item.weightGrams !== null) {
      if (typeof item.weightGrams !== 'number' || !Number.isFinite(item.weightGrams) || item.weightGrams < 0) {
        errors.push(`Item '${item.id}' has invalid weightGrams: must be a non-negative finite number`)
      }
    }

    if (item.userAdjustedQuantity !== undefined && item.userAdjustedQuantity !== null) {
      if (typeof item.userAdjustedQuantity !== 'number' || !Number.isFinite(item.userAdjustedQuantity) || item.userAdjustedQuantity < 0) {
        errors.push(`Item '${item.id}' has invalid userAdjustedQuantity: must be a non-negative finite number`)
      }
    }

    if (item.bagAssignment !== undefined && item.bagAssignment !== null) {
      if (item.bagAssignment !== 'cabin' && item.bagAssignment !== 'checked') {
        errors.push(`Item '${item.id}' has invalid bagAssignment: expected 'cabin' or 'checked'`)
      }
    }

    if (!isValidDateString(item.createdAt)) {
      errors.push(`Item '${item.id}' has an invalid createdAt date: '${String(item.createdAt)}'`)
    }

    if (!isValidDateString(item.updatedAt)) {
      errors.push(`Item '${item.id}' has an invalid updatedAt date: '${String(item.updatedAt)}'`)
    }
  }

  // 7. Templates Validation & Duplicate Check
  const templateIds = new Set<string>()
  for (let idx = 0; idx < templates.length; idx++) {
    const tmpl = templates[idx]
    if (!tmpl || typeof tmpl !== 'object' || Array.isArray(tmpl)) {
      errors.push(`Template at index ${idx} must be a valid object`)
      continue
    }

    if (typeof tmpl.id !== 'string' || tmpl.id.trim() === '') {
      errors.push(`Template at index ${idx} is missing a valid string 'id'`)
      continue
    }

    if (templateIds.has(tmpl.id)) {
      errors.push(`Duplicate template ID found in backup: '${tmpl.id}'`)
    } else {
      templateIds.add(tmpl.id)
    }

    if (typeof tmpl.name !== 'string' || tmpl.name.trim() === '') {
      errors.push(`Template '${tmpl.id}' is missing a valid string 'name'`)
    }

    if (!Array.isArray(tmpl.items)) {
      errors.push(`Template '${tmpl.id}' is missing a valid 'items' array`)
    } else {
      const tItems = tmpl.items as Array<Record<string, unknown>>
      for (let tIdx = 0; tIdx < tItems.length; tIdx++) {
        const tItem = tItems[tIdx]
        if (!tItem || typeof tItem !== 'object' || Array.isArray(tItem)) {
          errors.push(`Template '${tmpl.id}' item at index ${tIdx} must be a valid object`)
          continue
        }
        if (typeof tItem.name !== 'string' || tItem.name.trim() === '') {
          errors.push(`Template '${tmpl.id}' item at index ${tIdx} is missing 'name'`)
        }
        if (typeof tItem.itemSlug !== 'string' || tItem.itemSlug.trim() === '') {
          errors.push(`Template '${tmpl.id}' item at index ${tIdx} is missing 'itemSlug'`)
        }
        if (typeof tItem.category !== 'string' || tItem.category.trim() === '') {
          errors.push(`Template '${tmpl.id}' item at index ${tIdx} is missing 'category'`)
        }
        if (typeof tItem.defaultQuantity !== 'number' || !Number.isFinite(tItem.defaultQuantity) || tItem.defaultQuantity < 0) {
          errors.push(`Template '${tmpl.id}' item at index ${tIdx} has invalid defaultQuantity: must be a non-negative finite number`)
        }
        if (typeof tItem.priority !== 'string' || tItem.priority.trim() === '') {
          errors.push(`Template '${tmpl.id}' item at index ${tIdx} is missing 'priority'`)
        }
      }
    }

    if (!isValidDateString(tmpl.createdAt)) {
      errors.push(`Template '${tmpl.id}' has an invalid createdAt date: '${String(tmpl.createdAt)}'`)
    }

    if (!isValidDateString(tmpl.updatedAt)) {
      errors.push(`Template '${tmpl.id}' has an invalid updatedAt date: '${String(tmpl.updatedAt)}'`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? (payload as unknown as PackPilotBackupPayload) : undefined,
  }
}

/**
 * Creates a clean, versioned JSON backup payload representing all user-owned durable data.
 * Disposable API cache collections (geo_cache, weather_cache) are excluded.
 */
export async function exportBackup(storage?: StorageContext): Promise<PackPilotBackupPayload> {
  const store = storage || getStorageContext()
  const snapshot = await store.backup.createSnapshot()

  return {
    app: PACKPILOT_APP_ID,
    version: CURRENT_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    trips: snapshot.trips,
    items: snapshot.items,
    templates: snapshot.templates,
  }
}

/**
 * Serializes a backup payload into a formatted, human-readable JSON string.
 */
export function serializeBackup(payload: PackPilotBackupPayload): string {
  return JSON.stringify(payload, null, 2)
}

/**
 * Generates a standard default backup filename with YYYY-MM-DD timestamp.
 */
export function generateBackupFilename(date: Date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `packpilot-backup-${yyyy}-${mm}-${dd}.json`
}

/**
 * Restores a JSON backup into the application storage with strict schema validation
 * and full transaction atomicity (all-or-nothing rollback on any failure).
 */
export async function restoreBackup(
  backupData: string | unknown,
  options: RestoreOptions
): Promise<RestoreResult> {
  const mode = options.mode || 'replace'
  const conflictStrategy = options.conflictStrategy || 'skip'
  const store = options.storage || getStorageContext()

  // 1. Parse JSON if string is provided
  let parsed: unknown = backupData
  if (typeof backupData === 'string') {
    try {
      parsed = JSON.parse(backupData)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        mode,
        imported: { trips: 0, items: 0, templates: 0 },
        skipped: { trips: 0, items: 0, templates: 0 },
        conflicts: { trips: 0, items: 0, templates: 0 },
        errors: [`Invalid JSON format: ${msg}`],
      }
    }
  }

  // 2. Strict schema & referential integrity validation
  const validation = validateBackupPayload(parsed)
  if (!validation.valid || !validation.data) {
    return {
      success: false,
      mode,
      imported: { trips: 0, items: 0, templates: 0 },
      skipped: { trips: 0, items: 0, templates: 0 },
      conflicts: { trips: 0, items: 0, templates: 0 },
      errors: validation.errors,
    }
  }

  // 3. Perform atomic restoration in storage
  try {
    const restoreResult = await store.backup.atomicRestore(
      {
        trips: validation.data.trips,
        items: validation.data.items,
        templates: validation.data.templates,
      },
      mode,
      conflictStrategy
    )

    return {
      success: true,
      mode,
      imported: restoreResult.imported,
      skipped: restoreResult.skipped,
      conflicts: restoreResult.conflicts,
      errors: [],
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      mode,
      imported: { trips: 0, items: 0, templates: 0 },
      skipped: { trips: 0, items: 0, templates: 0 },
      conflicts: { trips: 0, items: 0, templates: 0 },
      errors: [`Storage transaction failed: ${msg}`],
    }
  }
}
