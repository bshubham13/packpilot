/**
 * PackPilot — Backup & Restore Domain Types & Contracts
 * Specification Version: 1.0.0
 */

import type { Trip, PackingItem, PackingTemplate } from './index'
import type { StorageContext } from '../db/interfaces'

export const PACKPILOT_APP_ID = 'packpilot'
export const CURRENT_BACKUP_SCHEMA_VERSION = 1

export type RestoreMode = 'replace' | 'merge'
export type ConflictStrategy = 'skip' | 'overwrite'

export interface PackPilotBackupPayload {
  app: typeof PACKPILOT_APP_ID
  version: number
  exportedAt: string
  trips: Trip[]
  items: PackingItem[]
  templates: PackingTemplate[]
}

export interface BackupValidationResult {
  valid: boolean
  errors: string[]
  data?: PackPilotBackupPayload
}

export interface BackupCollectionCounts {
  trips: number
  items: number
  templates: number
}

export interface RestoreResult {
  success: boolean
  mode: RestoreMode
  imported: BackupCollectionCounts
  skipped: BackupCollectionCounts
  conflicts: BackupCollectionCounts
  errors: string[]
}

export interface RestoreOptions {
  mode: RestoreMode
  conflictStrategy?: ConflictStrategy
  storage?: StorageContext
}
